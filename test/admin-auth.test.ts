import { describe, expect, it } from "vitest";
import { createSessionToken, STATE_COOKIE } from "../src/auth";
import { createApp } from "../src/index";
import { asD1, openSqlite, testEnv } from "./helpers";

function harness(extra: Record<string, string> = {}, now = new Date("2026-10-11T00:00:00Z")) {
  const calls: string[] = [];
  const sqlite = openSqlite();
  const env = testEnv(asD1(sqlite), extra);
  const app = createApp({
    now: () => now,
    fetchImpl: async (input) => {
      calls.push(String(input));
      throw new Error("unexpected fetch");
    },
  });
  return { app, env, calls };
}

async function session(email: string): Promise<string> {
  return createSessionToken("session-secret", email);
}

describe("google admin auth", () => {
  it("rejects an admin call with no cookie", async () => {
    const { app, env } = harness();
    const response = await app.fetch(new Request("https://automations.example/admin/settings"), env, {} as ExecutionContext);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
  });

  it("rejects a signed-in account that is not on the allowlist", async () => {
    const { app, env } = harness();
    const token = await session("stranger@example.com");
    const response = await app.fetch(new Request("https://automations.example/admin/automations", {
      headers: { Cookie: `bm_automations_session=${token}` },
    }), env, {} as ExecutionContext);
    expect(response.status).toBe(401);
  });

  it("rejects a Google callback when the state cookie does not match", async () => {
    const { app, env, calls } = harness({
      GOOGLE_CLIENT_ID: "client",
      GOOGLE_CLIENT_SECRET: "secret",
    });
    const response = await app.fetch(new Request("https://automations.example/auth/google/callback?code=abc&state=nope", {
      headers: { Cookie: `${STATE_COOKIE}=expected` },
    }), env, {} as ExecutionContext);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("cancelled or the session expired");
    expect(calls).toEqual([]);
  });

  it("returns settings to an allowlisted session without secret material", async () => {
    const { app, env } = harness();
    const token = await session("owner@balancemoves.com.au");
    const headers = { Cookie: `bm_automations_session=${token}`, "Content-Type": "application/json" };
    const saved = await app.fetch(new Request("https://automations.example/admin/settings", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ listmonk: { apiUser: "api-user", apiToken: "super-secret-token" }, twilio: { accountSid: "AC123secret", authToken: "twilio-auth" } }),
    }), env, {} as ExecutionContext);
    expect(saved.status).toBe(200);
    const view = await app.fetch(new Request("https://automations.example/admin/settings", { headers }), env, {} as ExecutionContext);
    const text = await view.text();
    const body = JSON.parse(text) as { listmonk: { connected: boolean }; twilio: { connected: boolean } };
    expect(body.listmonk.connected).toBe(true);
    expect(body.twilio.connected).toBe(true);
    expect(text).not.toContain("super-secret-token");
    expect(text).not.toContain("twilio-auth");
    expect(text).not.toContain("AC123secret");
    expect(text).not.toContain("settings-key");
  });
});
