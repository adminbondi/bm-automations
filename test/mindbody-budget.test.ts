import { describe, expect, it } from "vitest";
import { createSessionToken } from "../src/auth";
import { createApp } from "../src/index";
import { mindbodySignature } from "../src/signature";
import { parseMindbodyEvent } from "../src/mindbody/events";
import { chunkIds, MEASURED_EVENTS_PER_DAY, monthlyCalls, MINDBODY_ALERT, MINDBODY_CALLER, resourcesToFetch } from "../src/mindbody/budget";
import { findSeed } from "../src/automations/seed";
import { runScheduled } from "../src/pipeline/cron";
import { sydneyDate } from "../src/time";
import { d1Database, Repo } from "../src/db/repo";
import { asD1, openSqlite, testEnv } from "./helpers";

const STAFF = {
  MINDBODY_API_KEY: "key",
  MINDBODY_STAFF_USERNAME: "staff",
  MINDBODY_STAFF_PASSWORD: "pw",
};

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

function clientEvent(messageId: string, extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    messageId,
    eventId: "client.created",
    eventData: {
      siteId: 9853,
      clientId: "100",
      email: "ada@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      mobilePhone: "0412345678",
      creationDateTime: "2026-10-11T00:00:00Z",
      isLiabilityReleased: true,
      sendPromotionalEmails: false,
      sendPromotionalTexts: true,
      birthDateTime: "1990-03-01T00:00:00Z",
      ...extra,
    },
  });
}

function bookingEvent(messageId: string, extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    messageId,
    eventId: "classRosterBookingStatus.updated",
    eventData: {
      siteId: 9853,
      clientId: "100",
      clientEmail: "ada@example.com",
      clientFirstName: "Ada",
      signedInStatus: "SignedIn",
      itemName: "10 Pack",
      clientsNumberOfVisitsAtSite: 4,
      clientPassSessionsRemaining: 2,
      clientPassExpirationDateTime: "2026-12-01T00:00:00Z",
      classStartDateTime: "2026-10-11T00:00:00Z",
      ...extra,
    },
  });
}

async function post(app: ReturnType<typeof createApp>, env: Env, body: string) {
  const signature = await mindbodySignature(body, "sign-key");
  return app.fetch(new Request("https://automations.example/webhooks/mindbody", {
    method: "POST",
    headers: { "X-Mindbody-Signature": signature, "Content-Type": "application/json" },
    body,
  }), env, {} as ExecutionContext);
}

describe("Mindbody call budget", () => {
  it("reads profile, consent, visits, credits, and expiry from the webhook", () => {
    const client = parseMindbodyEvent(JSON.parse(clientEvent("m-parse")));
    expect(client?.emailOptOut).toBe(true);
    expect(client?.smsOptOut).toBe(false);
    expect(client?.birthDate).toBe("1990-03-01");
    expect(client?.waiverSigned).toBe(true);
    expect(client?.profileInPayload).toBe(true);
    const booking = parseMindbodyEvent(JSON.parse(bookingEvent("m-book", { clientPassSessionsRemaining: 0 })));
    expect(booking?.visitCount).toBe(4);
    expect(booking?.creditsRemaining).toBe(0);
    expect(booking?.passExpiration).toBe("2026-12-01");
    expect(booking?.visitStart).toBe("2026-10-11");
  });

  it("makes 0 Mindbody calls for a typical client or booking event", async () => {
    const calls: string[] = [];
    const sqlite = openSqlite();
    const env = testEnv(asD1(sqlite));
    const app = createApp({
      now: () => new Date("2026-10-11T00:00:00Z"),
      fetchImpl: async (input) => {
        calls.push(String(input));
        throw new Error("outbound");
      },
    });
    const created = await post(app, env, clientEvent("m-client"));
    expect(created.status).toBe(200);
    const createdBody = await created.json() as { plans: { key: string; reason: string; email: string | null }[] };
    expect(createdBody.plans.find((plan) => plan.key === "lead-immediate")).toMatchObject({
      reason: "automation_disabled",
      email: "ada@example.com",
    });
    const booked = await post(app, env, bookingEvent("m-visit"));
    expect(booked.status).toBe(200);
    expect(calls).toEqual([]);
    expect(monthlyCalls(MEASURED_EVENTS_PER_DAY, 0)).toBe(0);
    expect(monthlyCalls(MEASURED_EVENTS_PER_DAY, 5)).toBe(66_000);
  });

  it("matches under 3 credits from the booking payload with 0 Mindbody calls", async () => {
    const calls: string[] = [];
    const sqlite = openSqlite();
    const env = testEnv(asD1(sqlite), STAFF);
    const repo = new Repo(d1Database(asD1(sqlite)), () => "2026-10-11T00:00:00.000Z");
    await repo.ensureSeed();
    const seeded = await repo.getAutomation(72);
    expect(seeded?.enabled).toBe(false);
    expect(seeded?.key).toBe("red-flag-under-3-credits");
    expect(seeded?.filters).toEqual({ maxRemaining: 2 });
    await repo.updateAutomation(72, { enabled: true });
    const rule = findSeed("red-flag-under-3-credits");
    rule.enabled = true;
    const low = parseMindbodyEvent(JSON.parse(bookingEvent("m-red-low", { clientPassSessionsRemaining: 2 })));
    const high = parseMindbodyEvent(JSON.parse(bookingEvent("m-red-high", { clientPassSessionsRemaining: 3 })));
    expect(resourcesToFetch([rule], low)).toEqual([]);
    expect(resourcesToFetch([rule], high)).toEqual([]);
    const app = createApp({
      now: () => new Date("2026-10-11T00:00:00Z"),
      fetchImpl: async (input) => {
        calls.push(String(input));
        throw new Error("outbound");
      },
    });
    const matched = await post(app, env, bookingEvent("m-red-low", { clientPassSessionsRemaining: 2 }));
    expect(matched.status).toBe(200);
    const matchedBody = await matched.json() as { plans: { key: string; reason: string }[] };
    expect(matchedBody.plans.find((plan) => plan.key === "red-flag-under-3-credits")?.reason).toBe("template_missing");
    const booked = JSON.parse(bookingEvent("m-red-book", { clientPassSessionsRemaining: 1 }));
    booked.eventId = "classRosterBooking.created";
    const created = await post(app, env, JSON.stringify(booked));
    expect(created.status).toBe(200);
    const createdBody = await created.json() as { plans: { key: string; reason: string }[] };
    expect(createdBody.plans.find((plan) => plan.key === "red-flag-under-3-credits")?.reason).toBe("template_missing");
    const above = await post(app, env, bookingEvent("m-red-high", { clientPassSessionsRemaining: 3 }));
    expect(above.status).toBe(200);
    const aboveBody = await above.json() as { plans: { key: string; reason: string }[] };
    expect(aboveBody.plans.find((plan) => plan.key === "red-flag-under-3-credits")?.reason).toBe("remaining_above_max");
    expect(calls).toEqual([]);
    expect((await repo.getAutomation(72))?.enabled).toBe(true);
    const fresh = openSqlite();
    const freshRepo = new Repo(d1Database(asD1(fresh)), () => "2026-10-11T00:00:00.000Z");
    await freshRepo.ensureSeed();
    expect((await freshRepo.getAutomation(72))?.enabled).toBe(false);
  });

  it("uses payload credits with 0 calls, then caches a fetch the rule still needs", async () => {
    const calls: string[] = [];
    const sqlite = openSqlite();
    const env = testEnv(asD1(sqlite), STAFF);
    const repo = new Repo(d1Database(asD1(sqlite)), () => "2026-10-11T00:00:00.000Z");
    await repo.ensureSeed();
    await repo.updateAutomation(1, {
      enabled: true,
      triggerEvents: ["classRosterBookingStatus.updated"],
      scheduleOnEvents: [],
      timingKind: "immediate",
      filters: { exactRemaining: 2, signedInStatus: "SignedIn" },
      skipRules: { skipIfAlreadySent: true },
    });
    const app = createApp({
      now: () => new Date("2026-10-11T00:00:00Z"),
      fetchImpl: async (input) => {
        const url = String(input);
        calls.push(url);
        if (url.endsWith("/usertoken/issue")) return json({ AccessToken: "tok" });
        if (url.includes("/client/clientservices")) {
          return json({ ClientServices: [{ Name: "10 Pack", ExpirationDate: "2026-12-01", Current: true, Remaining: 2 }] });
        }
        throw new Error(`unexpected ${url}`);
      },
    });
    const covered = await post(app, env, bookingEvent("m-covered"));
    expect(covered.status).toBe(200);
    const coveredBody = await covered.json() as { plans: { key: string; reason: string }[] };
    expect(coveredBody.plans.find((plan) => plan.key === "lead-immediate")?.reason).toBe("dev_allowlist");
    expect(calls).toEqual([]);

    const missing = await post(app, env, bookingEvent("m-fetch", { clientPassSessionsRemaining: undefined }));
    expect(missing.status).toBe(200);
    expect(calls.filter((url) => url.includes("/usertoken/issue"))).toHaveLength(1);
    expect(calls.filter((url) => url.includes("/client/clientservices"))).toHaveLength(1);
    expect(calls.some((url) => url.includes("/client/clientvisits") || url.includes("/client/clientcontracts"))).toBe(false);

    const cached = await post(app, env, bookingEvent("m-cached", { clientPassSessionsRemaining: undefined }));
    expect(cached.status).toBe(200);
    expect(calls.filter((url) => url.includes("/client/clientservices"))).toHaveLength(1);
    const usage = await repo.mindbodyUsage("2026-10");
    expect(usage.find((row) => row.caller === MINDBODY_CALLER)?.count).toBe(2);
  });

  it("alerts at 4,000 and skips an expired-cache refresh at 5,000", async () => {
    const lines: string[] = [];
    const original = console.log;
    console.log = (...args: unknown[]) => {
      lines.push(args.map(String).join(" "));
    };
    const calls: string[] = [];
    const sqlite = openSqlite();
    const env = testEnv(asD1(sqlite), STAFF);
    const repo = new Repo(d1Database(asD1(sqlite)), () => "2026-10-11T00:00:00.000Z");
    await repo.ensureSeed();
    await repo.updateAutomation(1, {
      enabled: true,
      triggerEvents: ["classRosterBookingStatus.updated"],
      scheduleOnEvents: [],
      timingKind: "immediate",
      filters: { exactRemaining: 2, signedInStatus: "SignedIn" },
      skipRules: {},
    });
    await repo.addMindbodyCalls(MINDBODY_CALLER, "2026-10", 3_999, MINDBODY_ALERT);
    const app = createApp({
      now: () => new Date("2026-10-11T00:00:00Z"),
      fetchImpl: async (input) => {
        const url = String(input);
        calls.push(url);
        if (url.endsWith("/usertoken/issue")) return json({ AccessToken: "tok" });
        if (url.includes("/client/clientservices")) {
          return json({ ClientServices: [{ Name: "10 Pack", Remaining: 2, Current: true, ExpirationDate: "2026-12-01" }] });
        }
        throw new Error(`unexpected ${url}`);
      },
    });
    try {
      const first = await post(app, env, bookingEvent("m-alert", { clientPassSessionsRemaining: undefined }));
      expect(first.status).toBe(200);
      expect(lines.some((line) => line.includes("\"event\":\"mindbody_budget_alert\"") && line.includes("\"count\":4000"))).toBe(true);
      await repo.addMindbodyCalls("mb-chatwoot-sync", "2026-10", 1_000, MINDBODY_ALERT);
      await repo.putClientCache(
        "100",
        "services",
        JSON.stringify([{ name: "10 Pack", expirationSydney: "2026-12-01", current: true, remaining: 2 }]),
        "2026-10-01T00:00:00.000Z",
        "2026-10-01T06:00:00.000Z",
      );
      const before = calls.length;
      const held = await post(app, env, bookingEvent("m-cap", { clientPassSessionsRemaining: undefined }));
      expect(held.status).toBe(200);
      const heldBody = await held.json() as { plans: { key: string; reason: string }[] };
      expect(heldBody.plans.find((plan) => plan.key === "lead-immediate")?.reason).toBe("dev_allowlist");
      expect(calls.length).toBe(before);
      expect(lines.some((line) => line.includes("mindbody_recheck_skipped"))).toBe(true);
    } finally {
      console.log = original;
    }
  });

  it("batches cron profile lookups and reuses the staff token", async () => {
    const calls: string[] = [];
    const now = new Date("2026-01-15T22:00:00Z");
    const sqlite = openSqlite();
    const env = testEnv(asD1(sqlite), STAFF);
    const repo = new Repo(d1Database(asD1(sqlite)), () => now.toISOString());
    await repo.ensureSeed();
    await repo.updateAutomation(1, {
      enabled: true,
      timingKind: "birthday_day",
      triggerEvents: ["cron"],
      scheduleOnEvents: [],
      timingOffsetDays: null,
      filters: {},
      skipRules: {},
    });
    const today = sydneyDate(now);
    await repo.enqueueJob({ automationId: 1, clientId: "100", templateId: 5, dueOn: today, payload: {} });
    await repo.enqueueJob({ automationId: 1, clientId: "200", templateId: 5, dueOn: today, payload: {} });
    const deps = {
      now: () => now,
      fetchImpl: async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        calls.push(`${init?.method ?? "GET"} ${url}`);
        if (url.endsWith("/usertoken/issue")) return json({ AccessToken: "tok" });
        if (url.includes("/client/clients")) {
          expect(url).toContain("100");
          expect(url).toContain("200");
          return json({
            Clients: [
              { Id: "100", FirstName: "Ada", Email: "ada@example.com", BirthDate: "1990-01-16" },
              { Id: "200", FirstName: "Bea", Email: "bea@example.com", BirthDate: "1991-05-02" },
            ],
          });
        }
        throw new Error(`unexpected ${url}`);
      },
    };
    const first = await runScheduled(env, deps);
    expect(first.ran).toBe(true);
    expect(calls.filter((call) => call.includes("/usertoken/issue"))).toHaveLength(1);
    expect(calls.filter((call) => call.includes("/client/clients"))).toHaveLength(1);
    expect(calls.some((call) => call.includes("/client/clientservices") || call.includes("/client/clientvisits"))).toBe(false);
    const second = await runScheduled(env, deps);
    expect(second.ran).toBe(true);
    expect(calls.filter((call) => call.includes("api.mindbodyonline.com"))).toHaveLength(2);
    expect(chunkIds(Array.from({ length: 201 }, (_, index) => String(index)))).toHaveLength(2);
  });

  it("shows the monthly total on Settings", async () => {
    const sqlite = openSqlite();
    const env = testEnv(asD1(sqlite));
    const repo = new Repo(d1Database(asD1(sqlite)), () => "2026-10-11T00:00:00.000Z");
    await repo.addMindbodyCalls(MINDBODY_CALLER, "2026-10", 12, MINDBODY_ALERT);
    await repo.addMindbodyCalls("mb-chatwoot-sync", "2026-10", 30, MINDBODY_ALERT);
    const app = createApp({
      now: () => new Date("2026-10-11T00:00:00Z"),
      fetchImpl: async () => {
        throw new Error("outbound");
      },
    });
    const token = await createSessionToken("session-secret", "owner@balancemoves.com.au");
    const response = await app.fetch(new Request("https://automations.example/settings", {
      headers: { Cookie: `bm_automations_session=${token}` },
    }), env, {} as ExecutionContext);
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("Mindbody API calls");
    expect(html).toContain("42 of 5,000");
    expect(html).toContain("October 2026");
    expect(html).toContain("bm-automations 12");
    expect(html).toContain("mb-chatwoot-sync 30");
    expect(html).toContain("Within budget");
    const api = await app.fetch(new Request("https://automations.example/admin/settings", {
      headers: { Cookie: `bm_automations_session=${token}` },
    }), env, {} as ExecutionContext);
    const body = await api.json() as { mindbody: { calls: number; alertAt: number; cap: number } };
    expect(body.mindbody).toMatchObject({ calls: 42, alertAt: 4000, cap: 5000 });
  });
});
