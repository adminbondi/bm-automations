import { describe, expect, it } from "vitest";
import { readSession, SESSION_COOKIE } from "../src/auth";
import { HANDOFF_APP, signHandoffCode, type HandoffClaims } from "../src/handoff";
import { createApp } from "../src/index";
import { asD1, openSqlite, testEnv } from "./helpers";

const SECRET = "handoff-test-secret";
const NOW = Date.now();

function harness(extra: Record<string, string> = {}) {
  const sqlite = openSqlite();
  const env = testEnv(asD1(sqlite), extra);
  const app = createApp({
    now: () => new Date(NOW),
    fetchImpl: async () => {
      throw new Error("unexpected fetch");
    },
  });
  return { app, env };
}

function claims(partial: Partial<HandoffClaims> = {}): HandoffClaims {
  return {
    email: "owner@balancemoves.com.au",
    app: HANDOFF_APP,
    exp: NOW + 60_000,
    jti: "code-1",
    ...partial,
  };
}

async function code(partial: Partial<HandoffClaims> = {}, secret = SECRET): Promise<string> {
  return signHandoffCode(secret, claims(partial));
}

describe("staff home handoff", () => {
  it("accepts a valid code and sets the session cookie", async () => {
    const { app, env } = harness({ HANDOFF_SECRET: SECRET, GOOGLE_CLIENT_ID: "client", GOOGLE_CLIENT_SECRET: "secret" });
    const response = await app.fetch(
      new Request(`https://automations.example/auth/handoff?code=${encodeURIComponent(await code())}`),
      env,
      {} as ExecutionContext,
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/");
    const setCookie = response.headers.get("Set-Cookie") ?? "";
    expect(setCookie.startsWith(`${SESSION_COOKIE}=`)).toBe(true);
    const token = setCookie.slice(SESSION_COOKIE.length + 1).split(";")[0] ?? "";
    const session = await readSession("session-secret", `${SESSION_COOKIE}=${token}`, NOW);
    expect(session?.email).toBe("owner@balancemoves.com.au");
    const home = await app.fetch(new Request("https://automations.example/", {
      headers: { Cookie: `${SESSION_COOKIE}=${token}` },
    }), env, {} as ExecutionContext);
    expect(home.status).toBe(303);
    expect(home.headers.get("Location")).toBe("/automations");
    expect(await response.text()).not.toContain("Sign in with Google");
  });

  it("rejects a bad signature", async () => {
    const { app, env } = harness({ HANDOFF_SECRET: SECRET });
    const signed = await code();
    const response = await app.fetch(
      new Request(`https://automations.example/auth/handoff?code=${encodeURIComponent(`${signed}x`)}`),
      env,
      {} as ExecutionContext,
    );
    expect(response.status).toBe(400);
    expect(response.headers.get("Set-Cookie")).toBeNull();
  });

  it("rejects a code for a different app", async () => {
    const { app, env } = harness({ HANDOFF_SECRET: SECRET });
    const response = await app.fetch(
      new Request(`https://automations.example/auth/handoff?code=${encodeURIComponent(await code({ app: "links" }))}`),
      env,
      {} as ExecutionContext,
    );
    expect(response.status).toBe(400);
    expect(response.headers.get("Set-Cookie")).toBeNull();
  });

  it("rejects an expired code", async () => {
    const { app, env } = harness({ HANDOFF_SECRET: SECRET });
    const response = await app.fetch(
      new Request(`https://automations.example/auth/handoff?code=${encodeURIComponent(await code({ exp: NOW - 1 }))}`),
      env,
      {} as ExecutionContext,
    );
    expect(response.status).toBe(400);
    expect(response.headers.get("Set-Cookie")).toBeNull();
  });

  it("keeps Google login when the handoff secret is unset", async () => {
    const { app, env } = harness({ GOOGLE_CLIENT_ID: "client", GOOGLE_CLIENT_SECRET: "secret" });
    const page = await app.fetch(new Request("https://automations.example/"), env, {} as ExecutionContext);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("Sign in with Google");
    const login = await app.fetch(new Request("https://automations.example/login"), env, {} as ExecutionContext);
    expect(login.status).toBe(302);
    expect(login.headers.get("Location") ?? "").toContain("accounts.google.com");
    const admin = await app.fetch(new Request("https://automations.example/admin/settings"), env, {} as ExecutionContext);
    expect(admin.status).toBe(401);
    const handoff = await app.fetch(
      new Request(`https://automations.example/auth/handoff?code=${encodeURIComponent(await code())}`),
      env,
      {} as ExecutionContext,
    );
    expect(handoff.status).toBe(404);
    expect(handoff.headers.get("Set-Cookie")).toBeNull();
  });

  it("sends staff routes to home and leaves webhooks and health alone", async () => {
    const { app, env } = harness({
      HANDOFF_SECRET: SECRET,
      HOME_ORIGIN: "https://home.example/",
      GOOGLE_CLIENT_ID: "client",
      GOOGLE_CLIENT_SECRET: "secret",
    });
    const home = "https://home.example/login?return=automations";
    const staff = await app.fetch(new Request("https://automations.example/automations"), env, {} as ExecutionContext);
    expect(staff.status).toBe(302);
    expect(staff.headers.get("Location")).toBe(home);
    expect(await staff.text()).not.toContain("Sign in with Google");
    const admin = await app.fetch(new Request("https://automations.example/admin/automations"), env, {} as ExecutionContext);
    expect(admin.status).toBe(302);
    expect(admin.headers.get("Location")).toBe(home);
    const login = await app.fetch(new Request("https://automations.example/login"), env, {} as ExecutionContext);
    expect(login.headers.get("Location")).toBe(home);
    const health = await app.fetch(new Request("https://automations.example/health"), env, {} as ExecutionContext);
    expect(health.status).toBe(200);
    expect(health.headers.get("Location")).toBeNull();
    const webhook = await app.fetch(new Request("https://automations.example/webhooks/mindbody", { method: "POST", body: "{}" }), env, {} as ExecutionContext);
    expect(webhook.status).not.toBe(302);
    expect(webhook.headers.get("Location")).toBeNull();
    const lead = await app.fetch(new Request("https://automations.example/webhooks/lead", { method: "POST", body: "{}" }), env, {} as ExecutionContext);
    expect(lead.status).not.toBe(302);
    expect(lead.headers.get("Location")).toBeNull();
  });
});
