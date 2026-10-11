import { describe, expect, it } from "vitest";
import { createApp } from "../src/index";
import { asD1, emptySnapshot, openSqlite, testEnv } from "./helpers";
import { d1Database, Repo } from "../src/db/repo";

describe("external lead webhook", () => {
  it("rejects a missing secret and a bad token, then plans the disabled welcome", async () => {
    const sqlite = openSqlite();
    const env = testEnv(asD1(sqlite), { LEAD_WEBHOOK_SECRET: "lead-secret" });
    const repo = new Repo(d1Database(asD1(sqlite)), () => "2026-10-11T00:00:00.000Z");
    await repo.ensureSeed();
    const calls: string[] = [];
    const app = createApp({
      now: () => new Date("2026-10-11T00:00:00Z"),
      snapshotClient: async () => emptySnapshot({ profile: { email: "bondi@balancemoves.com.au", phone: "+61400000000", firstName: "Ada", lastName: null, createdAt: "2026-10-11T00:00:00Z", waiverSigned: false } }),
      fetchImpl: async (input) => {
        calls.push(String(input));
        return new Response("{}", { status: 200 });
      },
    });
    const body = JSON.stringify({
      messageId: "lead-1",
      eventId: "lead.created",
      eventData: { clientId: "55", email: "bondi@balancemoves.com.au", mobilePhone: "+61400000000", firstName: "Ada" },
    });
    const locked = await app.fetch(new Request("https://automations.example/webhooks/lead", { method: "POST", body }), testEnv(asD1(openSqlite())), {} as ExecutionContext);
    expect(locked.status).toBe(401);
    const bad = await app.fetch(new Request("https://automations.example/webhooks/lead", {
      method: "POST",
      headers: { "X-Lead-Token": "nope" },
      body,
    }), env, {} as ExecutionContext);
    expect(bad.status).toBe(401);
    const ok = await app.fetch(new Request("https://automations.example/webhooks/lead", {
      method: "POST",
      headers: { "X-Lead-Token": "lead-secret" },
      body,
    }), env, {} as ExecutionContext);
    expect(ok.status).toBe(200);
    const payload = await ok.json() as { plans: { key: string; reason: string }[] };
    expect(payload.plans.find((plan) => plan.key === "external-immediate-text")?.reason).toBe("automation_disabled");
    expect(calls.some((url) => url.includes("/api/tx") || url.includes("twilio"))).toBe(false);
  });
});
