import { describe, expect, it } from "vitest";
import { createApp } from "../src/index";
import { mindbodySignature } from "../src/signature";
import { asD1, emptySnapshot, openSqlite, testEnv, visit } from "./helpers";
import { d1Database, Repo } from "../src/db/repo";

function harness(options: {
  now?: Date;
  extra?: Record<string, string>;
  snapshot?: ReturnType<typeof emptySnapshot>;
}) {
  const calls: string[] = [];
  const sqlite = openSqlite();
  const env = testEnv(asD1(sqlite), options.extra);
  const repo = new Repo(d1Database(asD1(sqlite)), () => "2026-10-11T00:00:00.000Z");
  const app = createApp({
    now: () => options.now ?? new Date("2026-10-11T00:00:00Z"),
    snapshotClient: async () => options.snapshot ?? emptySnapshot(),
    fetchImpl: async (input, init) => {
      const url = String(input);
      calls.push(`${init?.method ?? "GET"} ${url}`);
      if (url.includes("/api/subscribers")) {
        return new Response(JSON.stringify({ data: { results: [{ id: 1, uuid: "sub", email: "bondi@balancemoves.com.au", status: "enabled", lists: [] }] } }), { status: 200 });
      }
      if (url.includes("/api/tx") || url.includes("api.twilio.com")) {
        return new Response("{}", { status: 200 });
      }
      return new Response("not found", { status: 404 });
    },
  });
  return { app, env, repo, calls };
}

async function post(app: ReturnType<typeof createApp>, env: Env, body: string) {
  const signature = await mindbodySignature(body, "sign-key");
  return app.fetch(new Request("https://automations.example/webhooks/mindbody", {
    method: "POST",
    headers: { "X-Mindbody-Signature": signature, "Content-Type": "application/json" },
    body,
  }), env, {} as ExecutionContext);
}

describe("dev send safety", () => {
  it("does not call listmonk for a client outside the allowlist", async () => {
    const { app, env, repo, calls } = harness({});
    await repo.ensureSeed();
    await repo.updateAutomation(1, { enabled: true });
    const body = JSON.stringify({
      messageId: "m-ada",
      eventId: "client.created",
      eventData: { siteId: 9853, clientId: "100", email: "ada@example.com", firstName: "Ada", creationDateTime: "2026-10-11T00:00:00Z" },
    });
    const response = await post(app, env, body);
    expect(response.status).toBe(200);
    expect(calls.some((call) => call.includes("/api/tx"))).toBe(false);
    const payload = await response.json() as { plans: { key: string; reason: string }[] };
    expect(payload.plans.find((plan) => plan.key === "lead-immediate")?.reason).toBe("dev_allowlist");
  });

  it("does not call listmonk while the automation is disabled", async () => {
    const { app, env, calls } = harness({
      snapshot: emptySnapshot({ profile: { email: "bondi@balancemoves.com.au", phone: null, firstName: "Ada", lastName: null, createdAt: "2026-10-11T00:00:00Z", waiverSigned: false } }),
    });
    const body = JSON.stringify({
      messageId: "m-bondi",
      eventId: "client.created",
      eventData: { siteId: 9853, clientId: "100", email: "bondi@balancemoves.com.au", firstName: "Ada", creationDateTime: "2026-10-11T00:00:00Z" },
    });
    const response = await post(app, env, body);
    expect(response.status).toBe(200);
    expect(calls.some((call) => call.includes("/api/tx"))).toBe(false);
    const payload = await response.json() as { plans: { key: string; reason: string }[] };
    expect(payload.plans.find((plan) => plan.key === "lead-immediate")?.reason).toBe("automation_disabled");
  });

  it("sends only after the row is enabled and the address is allowlisted", async () => {
    const { app, env, repo, calls } = harness({
      extra: { LISTMONK_API_USER: "api", LISTMONK_API_TOKEN: "token" },
    });
    await repo.ensureSeed();
    await repo.updateAutomation(1, { enabled: true });
    const body = JSON.stringify({
      messageId: "m-send",
      eventId: "client.created",
      eventData: { siteId: 9853, clientId: "100", email: "bondi@balancemoves.com.au", firstName: "Ada", creationDateTime: "2026-10-11T00:00:00Z" },
    });
    const response = await post(app, env, body);
    expect(response.status).toBe(200);
    expect(calls.some((call) => call.includes("/api/tx"))).toBe(true);
  });

  it("holds an allowlisted review text during quiet hours", async () => {
    const { app, env, repo, calls } = harness({
      now: new Date("2026-10-11T10:00:00Z"),
      extra: { SMS_ALLOWLIST: "+61400000000", TWILIO_ACCOUNT_SID: "AC123", TWILIO_AUTH_TOKEN: "token", TWILIO_FROM_NUMBER: "+61411110000" },
      snapshot: emptySnapshot({
        profile: { email: "ada@example.com", phone: "+61400000000", firstName: "Ada", lastName: "Lovelace", createdAt: "2026-08-01T00:00:00Z", waiverSigned: false },
        visits: [1, 2, 3].map((id) => visit({ id, serviceName: "2 Week Intro Pass" })),
        services: [{ name: "2 Week Intro Pass", expirationSydney: "2026-10-20", current: true }],
      }),
    });
    await repo.ensureSeed();
    await repo.updateAutomation(11, { enabled: true });
    const body = JSON.stringify({
      messageId: "m-sms",
      eventId: "classRosterBookingStatus.updated",
      eventData: { siteId: 9853, clientId: "100", clientEmail: "ada@example.com", signedInStatus: "SignedIn", itemName: "2 Week Intro Pass" },
    });
    const response = await post(app, env, body);
    expect(response.status).toBe(200);
    expect(calls.some((call) => call.includes("api.twilio.com"))).toBe(false);
    const payload = await response.json() as { plans: { key: string; reason: string; renderedMessage: string | null }[] };
    const plan = payload.plans.find((item) => item.key === "trial-google-review-text");
    expect(plan?.reason).toBe("quiet_hours");
    expect(plan?.renderedMessage).toContain("Ada");
    const jobs = await repo.dueJobs("2026-10-11");
    expect(jobs.find((job) => job.automationId === 11)).toMatchObject({ status: "pending", reason: "quiet_hours", dueOn: "2026-10-11" });
  });

  it("rejects a bad signature", async () => {
    const { app, env, calls } = harness({});
    const response = await app.fetch(new Request("https://automations.example/webhooks/mindbody", {
      method: "POST",
      headers: { "X-Mindbody-Signature": "sha256=nope" },
      body: "{}",
    }), env, {} as ExecutionContext);
    expect(response.status).toBe(401);
    expect(calls).toEqual([]);
  });
});
