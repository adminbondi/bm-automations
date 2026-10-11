import { describe, expect, it } from "vitest";
import { createSessionToken } from "../src/auth";
import { createApp } from "../src/index";
import { asD1, openSqlite, testEnv } from "./helpers";

function app(now = new Date("2026-10-11T00:00:00Z")) {
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
  });
  const server = createApp({
    now: () => now,
    fetchImpl: async (input, init) => {
      const url = String(input);
      calls.push({ url, body: String(init?.body ?? "") });
      if (url.includes("/api/subscribers")) {
        return new Response(JSON.stringify({ data: { results: [{ id: 1, uuid: "sub", email: "bondi@balancemoves.com.au", status: "enabled", lists: [] }] } }), { status: 200 });
      }
      if (url.includes("/api/tx") || url.includes("api.twilio.com")) return new Response("{}", { status: 200 });
      return new Response("not found", { status: 404 });
    },
  });
  return { server, env, calls };
}

async function cookie(email: string): Promise<string> {
  const token = await createSessionToken("session-secret", email);
  return `bm_automations_session=${token}`;
}

describe("test sends stay on the dev allowlist", () => {
  it("emails only bondi@balancemoves.com.au", async () => {
    const { server, env, calls } = app();
    const blocked = await server.fetch(new Request("https://automations.example/automations/1/test", {
      method: "POST",
      headers: { Cookie: await cookie("owner@balancemoves.com.au"), "Content-Type": "application/x-www-form-urlencoded" },
      body: "",
    }), env, {} as ExecutionContext);
    expect(blocked.headers.get("Location")).toContain("not_allowlisted");
    expect(calls.some((call) => call.url.includes("/api/tx"))).toBe(false);

    const allowed = await server.fetch(new Request("https://automations.example/automations/1/test", {
      method: "POST",
      headers: { Cookie: await cookie("bondi@balancemoves.com.au"), "Content-Type": "application/x-www-form-urlencoded" },
      body: "",
    }), env, {} as ExecutionContext);
    expect(allowed.headers.get("Location")).toContain("email_ok");
    const sent = calls.find((call) => call.url.includes("/api/tx"));
    expect(sent?.body).toContain("bondi@balancemoves.com.au");
    expect(sent?.body).not.toContain("owner@");
  });

  it("texts only an allowlisted test number, and not during quiet hours", async () => {
    const quiet = app(new Date("2026-10-11T10:00:00Z"));
    const held = await quiet.server.fetch(new Request("https://automations.example/admin/settings/test/twilio", {
      method: "POST",
      headers: { Cookie: await cookie("bondi@balancemoves.com.au"), "Content-Type": "application/json" },
      body: JSON.stringify({ to: "+61400000000" }),
    }), quiet.env, {} as ExecutionContext);
    expect(held.status).toBe(409);
    expect(quiet.calls.some((call) => call.url.includes("api.twilio.com"))).toBe(false);

    const { server, env, calls } = app(new Date("2026-10-10T22:00:00Z"));
    const foreign = await server.fetch(new Request("https://automations.example/admin/settings/test/twilio", {
      method: "POST",
      headers: { Cookie: await cookie("bondi@balancemoves.com.au"), "Content-Type": "application/json" },
      body: JSON.stringify({ to: "+61411111111" }),
    }), env, {} as ExecutionContext);
    expect(foreign.status).toBe(403);
    const ok = await server.fetch(new Request("https://automations.example/automations/10/test", {
      method: "POST",
      headers: { Cookie: await cookie("bondi@balancemoves.com.au"), "Content-Type": "application/x-www-form-urlencoded" },
      body: "testPhone=%2B61400000000",
    }), env, {} as ExecutionContext);
    expect(ok.headers.get("Location")).toContain("twilio_ok");
    const sms = calls.find((call) => call.url.includes("api.twilio.com"));
    expect(sms?.body).toContain("%2B61400000000");
    expect(sms?.body).not.toContain("61411111111");
  });
});
