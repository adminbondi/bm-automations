import { describe, expect, it } from "vitest";
import { createSessionToken } from "../src/auth";
import { createApp } from "../src/index";
import { asD1, openSqlite, testEnv } from "./helpers";

function app(now = new Date("2026-10-11T00:00:00Z"), extra: Record<string, string> = {}) {
  const calls: { url: string; body: string }[] = [];
  const sqlite = openSqlite();
  const env = testEnv(asD1(sqlite), {
    ADMIN_EMAILS: "bondi@balancemoves.com.au,owner@balancemoves.com.au",
    SMS_ALLOWLIST: "+61400000000",
    LISTMONK_API_USER: "api",
    LISTMONK_API_TOKEN: "token",
    TWILIO_ACCOUNT_SID: "AC123",
    TWILIO_AUTH_TOKEN: "auth",
    TWILIO_FROM_NUMBER: "+61411112222",
    MINDBODY_API_KEY: "key",
    MINDBODY_STAFF_USERNAME: "staff",
    MINDBODY_STAFF_PASSWORD: "pw",
    ...extra,
  });
  const server = createApp({
    now: () => now,
    fetchImpl: async (input, init) => {
      const url = String(input);
      calls.push({ url, body: String(init?.body ?? "") });
      if (url.includes("/api/tx") || url.includes("api.twilio.com")) return new Response("{}", { status: 200 });
      if (url.endsWith("/usertoken/issue")) return Response.json({ AccessToken: "tok" });
      if (url.includes("searchText")) {
        return Response.json({
          Clients: [{ Id: "100", FirstName: "Ada", LastName: "Lovelace", Email: "ada@example.com", MobilePhone: "0412 000 111" }],
        });
      }
      if (url.includes("/client/clientservices")) return Response.json({ ClientServices: [] });
      if (url.includes("/client/clientcontracts")) return Response.json({ Contracts: [] });
      if (url.includes("/client/clientvisits")) return Response.json({ Visits: [], PaginationResponse: { TotalResults: 0 } });
      if (url.includes("/client/clients")) {
        return Response.json({
          Clients: [{
            Id: "100",
            FirstName: "Ada",
            LastName: "Lovelace",
            Email: "ada@example.com",
            MobilePhone: "0412 000 111",
            CreationDate: "2026-10-01T00:00:00",
          }],
        });
      }
      return new Response("not found", { status: 404 });
    },
  });
  return { server, env, calls, sqlite };
}

async function cookie(email: string): Promise<string> {
  const token = await createSessionToken("session-secret", email);
  return `bm_automations_session=${token}`;
}

function post(path: string, cookieHeader: string, fields: Record<string, string>) {
  return new Request(`https://automations.example${path}`, {
    method: "POST",
    headers: { Cookie: cookieHeader, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  }) as unknown as Parameters<ReturnType<typeof createApp>["fetch"]>[0];
}

describe("automation send test", () => {
  it("previews a skip or a send without contacting anyone", async () => {
    const { server, env, calls } = app();
    const headers = { Cookie: await cookie("owner@balancemoves.com.au") };
    const page = await server.fetch(new Request("https://automations.example/automations/1", { headers }), env, {} as ExecutionContext);
    const html = await page.text();
    expect(html).toContain("Send test");
    expect(html).toContain("Bypasses dedupe and quiet hours");
    expect(html).toContain("This automation is off.");
    expect(html).not.toContain("Send test to me");

    const skip = await server.fetch(post("/automations/1/preview", headers.Cookie, {
      source: "sample",
      sampleFirst: "Priya",
      samplePack: "2 Week Intro Pass",
      recipient: "owner@balancemoves.com.au",
    }), env, {} as ExecutionContext);
    const skipped = await skip.text();
    expect(skip.status).toBe(200);
    expect(skipped).toContain("Would skip");
    expect(skipped).toContain("already has a purchase");
    expect(skipped).toContain("FirstName: Priya");
    expect(skipped).toContain("Send test would be refused");

    const ready = await server.fetch(post("/automations/1/preview", headers.Cookie, {
      source: "sample",
      sampleFirst: "Priya",
    }), env, {} as ExecutionContext);
    expect(await ready.text()).toContain("Would send");
    expect(calls.some((call) => call.url.includes("/api/tx") || call.url.includes("api.twilio.com"))).toBe(false);
  });

  it("sends only to a test recipient, even when the automation is off, deduped, and inside quiet hours", async () => {
    const quiet = app(new Date("2026-10-11T10:00:00Z"));
    const headers = { Cookie: await cookie("bondi@balancemoves.com.au") };
    quiet.sqlite.prepare(
      `INSERT INTO send_log (dedupe_key, automation_id, client_id, channel, template_id, email, phone, status, detail, created_at)
       VALUES ('automation:1:client:100', 1, '100', 'email', 5, 'ada@example.com', NULL, 'sent', 'already', '2026-10-01T00:00:00.000Z')`,
    ).run();

    const blocked = await quiet.server.fetch(post("/automations/1/test", headers.Cookie, {
      source: "client",
      clientId: "100",
      recipient: "owner@balancemoves.com.au",
    }), quiet.env, {} as ExecutionContext);
    expect(blocked.headers.get("Location")).toContain("test_not_allowlisted");
    expect(quiet.calls.some((call) => call.url.includes("mindbodyonline.com") || call.url.includes("/api/tx"))).toBe(false);

    const sent = await quiet.server.fetch(post("/automations/1/test", headers.Cookie, {
      source: "client",
      clientId: "100",
      recipient: "bondi@balancemoves.com.au",
    }), quiet.env, {} as ExecutionContext);
    expect(sent.headers.get("Location")).toContain("test_sent");
    const tx = quiet.calls.find((call) => call.url.includes("/api/tx"));
    const payload = JSON.parse(tx?.body ?? "{}") as { subscriber_email?: string; data?: { FirstName?: string; Email?: string } };
    expect(payload.subscriber_email).toBe("bondi@balancemoves.com.au");
    expect(payload.data?.FirstName).toBe("Ada");
    expect(payload.data?.Email).toBe("ada@example.com");
    expect(quiet.calls.some((call) => call.url.includes("api.twilio.com"))).toBe(false);
    expect(quiet.calls.some((call) => call.url.includes("0412") || call.url.includes("61412000111"))).toBe(false);

    const row = await quiet.server.fetch(new Request("https://automations.example/admin/automations/1", { headers }), quiet.env, {} as ExecutionContext);
    const body = await row.json() as { automation: { enabled: boolean } };
    expect(body.automation.enabled).toBe(false);
    const log = await quiet.server.fetch(new Request("https://automations.example/log?status=test", { headers }), quiet.env, {} as ExecutionContext);
    const logHtml = await log.text();
    expect(logHtml).toContain("TEST");
    expect(logHtml).toContain("bondi@balancemoves.com.au");
    expect(logHtml).toContain("Client not contacted");
    expect(logHtml).not.toContain("ada@example.com");
    const statuses = quiet.sqlite.prepare(`SELECT status, email, dedupe_key FROM send_log ORDER BY id`).all() as { status: string; email: string; dedupe_key: string }[];
    expect(statuses.map((item) => item.status)).toEqual(["sent", "test"]);
    expect(statuses[1]?.email).toBe("bondi@balancemoves.com.au");
    expect(statuses[1]?.dedupe_key.startsWith("test:")).toBe(true);
  });

  it("texts an allowlisted mobile during quiet hours and leaves the client number alone", async () => {
    const { server, env, calls } = app(new Date("2026-10-11T10:00:00Z"));
    const headers = { Cookie: await cookie("bondi@balancemoves.com.au") };
    const held = await server.fetch(new Request("https://automations.example/admin/settings/test/twilio", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ to: "+61400000000" }),
    }), env, {} as ExecutionContext);
    expect(held.status).toBe(409);

    const missing = await server.fetch(post("/automations/10/test", headers.Cookie, {
      source: "sample",
      sampleFirst: "Priya",
      samplePhone: "+61499999999",
      recipient: "+61400000000",
    }), env, {} as ExecutionContext);
    expect(missing.headers.get("Location")).toContain("test_not_allowlisted");
    expect(calls.some((call) => call.url.includes("api.twilio.com"))).toBe(false);

    const saved = await server.fetch(post("/settings/test-recipients", headers.Cookie, {
      testRecipients: "bondi@balancemoves.com.au\n+61400000000",
    }), env, {} as ExecutionContext);
    expect(saved.headers.get("Location")).toContain("notice=saved");

    const ok = await server.fetch(post("/automations/10/test", headers.Cookie, {
      source: "sample",
      sampleFirst: "Priya",
      samplePhone: "+61499999999",
      samplePack: "2 Week Intro Pass",
      sampleCreated: "2026-10-04",
      recipient: "0400 000 000",
    }), env, {} as ExecutionContext);
    expect(ok.headers.get("Location")).toContain("test_sent");
    const sms = calls.find((call) => call.url.includes("api.twilio.com"));
    expect(sms?.body).toContain("To=%2B61400000000");
    expect(sms?.body).toContain("Priya");
    expect(sms?.body).not.toContain("61499999999");
    const settings = await server.fetch(new Request("https://automations.example/admin/settings", { headers }), env, {} as ExecutionContext);
    const json = await settings.json() as { testRecipients: string };
    expect(json.testRecipients).toContain("+61400000000");
  });

  it("lists Mindbody search hits on the edit form", async () => {
    const { server, env } = app();
    const headers = { Cookie: await cookie("bondi@balancemoves.com.au") };
    const page = await server.fetch(new Request("https://automations.example/automations/1?clientQ=Ada", { headers }), env, {} as ExecutionContext);
    const html = await page.text();
    expect(html).toContain("Ada Lovelace");
    expect(html).toContain("ada@example.com");
    expect(html).toContain('value="100"');
    const settings = await server.fetch(new Request("https://automations.example/settings", { headers }), env, {} as ExecutionContext);
    const settingsHtml = await settings.text();
    expect(settingsHtml).toContain("Test recipients");
    expect(settingsHtml).toContain("bondi@balancemoves.com.au");
  });
});
