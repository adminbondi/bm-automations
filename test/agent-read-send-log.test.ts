import { describe, expect, it } from "vitest";
import { createSessionToken } from "../src/auth";
import { createApp } from "../src/index";
import { asD1, openSqlite, testEnv, testRepo } from "./helpers";

function harness(extra: Record<string, string> = {}) {
  const sqlite = openSqlite();
  const env = testEnv(asD1(sqlite), extra);
  const app = createApp({
    now: () => new Date("2026-11-09T00:00:00Z"),
    fetchImpl: async () => {
      throw new Error("unexpected fetch");
    },
  });
  return { app, env, sqlite };
}

async function seedSendLog(sqlite: ReturnType<typeof openSqlite>): Promise<void> {
  const repo = testRepo(sqlite);
  await repo.ensureSeed();
  await repo.recordSend({
    dedupeKey: "dedupe-1",
    automationId: 1,
    clientId: "100025122",
    channel: "email",
    templateId: 14,
    email: "Buyer@Example.com",
    phone: null,
    status: "sent",
    detail: null,
  });
  await repo.recordSend({
    dedupeKey: "dedupe-2",
    automationId: 2,
    clientId: "100025000",
    channel: "email",
    templateId: 15,
    email: "other@example.com",
    phone: null,
    status: "skipped_no_subscriber",
    detail: "subscriber_missing",
  });
}

describe("AGENT_READ_TOKEN send-log auth", () => {
  it("returns 200 on GET /admin/send-log with a valid bearer token", async () => {
    const { app, env, sqlite } = harness({ AGENT_READ_TOKEN: "agent-read-secret" });
    await seedSendLog(sqlite);
    const response = await app.fetch(
      new Request("https://automations.example/admin/send-log?limit=10", {
        headers: { Authorization: "Bearer agent-read-secret" },
      }),
      env,
      {} as ExecutionContext,
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { sendLog: { clientId: string; email: string | null }[] };
    expect(body.sendLog.length).toBeGreaterThan(0);
    expect(body.sendLog[0]).toMatchObject({
      id: expect.any(Number),
      dedupeKey: expect.any(String),
      automationId: expect.any(Number),
      clientId: expect.any(String),
      channel: expect.any(String),
      status: expect.any(String),
      createdAt: expect.any(String),
    });
  });

  it("rejects the agent token on other admin routes and non-GET send-log", async () => {
    const { app, env } = harness({ AGENT_READ_TOKEN: "agent-read-secret" });
    const headers = { Authorization: "Bearer agent-read-secret" };
    const settings = await app.fetch(
      new Request("https://automations.example/admin/settings", { headers }),
      env,
      {} as ExecutionContext,
    );
    expect(settings.status).toBe(401);
    const automations = await app.fetch(
      new Request("https://automations.example/admin/automations", { headers }),
      env,
      {} as ExecutionContext,
    );
    expect(automations.status).toBe(401);
    const postLog = await app.fetch(
      new Request("https://automations.example/admin/send-log", { method: "POST", headers }),
      env,
      {} as ExecutionContext,
    );
    expect(postLog.status).toBe(401);
  });

  it("rejects a wrong or missing bearer token", async () => {
    const { app, env } = harness({ AGENT_READ_TOKEN: "agent-read-secret" });
    const wrong = await app.fetch(
      new Request("https://automations.example/admin/send-log", {
        headers: { Authorization: "Bearer wrong-token" },
      }),
      env,
      {} as ExecutionContext,
    );
    expect(wrong.status).toBe(401);
    const missing = await app.fetch(
      new Request("https://automations.example/admin/send-log"),
      env,
      {} as ExecutionContext,
    );
    expect(missing.status).toBe(401);
  });

  it("rejects bearer auth when AGENT_READ_TOKEN is unset", async () => {
    const { app, env } = harness();
    const response = await app.fetch(
      new Request("https://automations.example/admin/send-log", {
        headers: { Authorization: "Bearer anything" },
      }),
      env,
      {} as ExecutionContext,
    );
    expect(response.status).toBe(401);
  });

  it("still allows staff cookie auth for send-log and other admin routes", async () => {
    const { app, env, sqlite } = harness({ AGENT_READ_TOKEN: "agent-read-secret" });
    await seedSendLog(sqlite);
    const token = await createSessionToken("session-secret", "owner@balancemoves.com.au");
    const headers = { Cookie: `bm_automations_session=${token}` };
    const log = await app.fetch(new Request("https://automations.example/admin/send-log", { headers }), env, {} as ExecutionContext);
    expect(log.status).toBe(200);
    const settings = await app.fetch(new Request("https://automations.example/admin/settings", { headers }), env, {} as ExecutionContext);
    expect(settings.status).toBe(200);
  });

  it("filters send-log by email, clientId, since, until, and status", async () => {
    const { app, env, sqlite } = harness({ AGENT_READ_TOKEN: "agent-read-secret" });
    await seedSendLog(sqlite);
    const response = await app.fetch(
      new Request(
        "https://automations.example/admin/send-log?email=buyer@example.com&clientId=100025122&status=sent&since=2026-10-01T00:00:00.000Z&until=2026-10-31T00:00:00.000Z&automationId=1&limit=20",
        { headers: { Authorization: "Bearer agent-read-secret" } },
      ),
      env,
      {} as ExecutionContext,
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { sendLog: { clientId: string; email: string | null; status: string; automationId: number }[] };
    expect(body.sendLog).toHaveLength(1);
    expect(body.sendLog[0]).toMatchObject({
      clientId: "100025122",
      email: "Buyer@Example.com",
      status: "sent",
      automationId: 1,
    });
  });
});
