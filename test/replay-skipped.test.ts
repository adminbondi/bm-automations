import { describe, expect, it } from "vitest";
import { createApp } from "../src/index";
import { d1Database, Repo } from "../src/db/repo";
import { asD1, openSqlite, testEnv } from "./helpers";

describe("replay skipped subscriber_missing", () => {
  it("sends when REPLAY_TOKEN matches and a skip row exists", async () => {
    const calls: { url: string; body: string }[] = [];
    const sqlite = openSqlite();
    const env = testEnv(asD1(sqlite), {
      LISTMONK_API_USER: "api",
      LISTMONK_API_TOKEN: "token",
      REPLAY_TOKEN: "replay-secret",
      DEV_MODE: "false",
    });
    const repo = new Repo(d1Database(asD1(sqlite)), () => "2026-11-09T10:50:00.000Z");
    await repo.ensureSeed();
    await repo.updateAutomation(73, { enabled: true });
    await repo.upsertClient({
      clientId: "100025122",
      email: "thibomfim+truco@gmail.com",
      phone: null,
      firstName: "Thiago",
      lastName: "Truco",
      createdAt: "2026-11-09T10:44:00Z",
    });
    await repo.recordSend({
      dedupeKey: "automation:73:client:100025122",
      automationId: 73,
      clientId: "100025122",
      channel: "email",
      templateId: 14,
      email: "thibomfim+truco@gmail.com",
      phone: null,
      status: "skipped_no_subscriber",
      detail: "subscriber_missing",
    });
    const app = createApp({
      now: () => new Date("2026-11-09T10:50:00Z"),
      fetchImpl: async (input, init) => {
        const url = String(input);
        calls.push({ url, body: String(init?.body ?? "") });
        if (url.includes("/api/subscribers")) {
          return new Response(JSON.stringify({
            data: {
              results: [{
                id: 128,
                uuid: "sub-128",
                email: "thibomfim+truco@gmail.com",
                status: "enabled",
                lists: [{ id: 1 }],
              }],
            },
          }), { status: 200 });
        }
        if (url.includes("/api/tx")) return new Response("{}", { status: 200 });
        return new Response("not found", { status: 404 });
      },
    });

    const unauthorized = await app.fetch(new Request("https://automations.example/admin/replay-skipped", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer wrong" },
      body: JSON.stringify({ clientId: "100025122" }),
    }), env, {} as ExecutionContext);
    expect(unauthorized.status).toBe(401);

    const sent = await app.fetch(new Request("https://automations.example/admin/replay-skipped", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer replay-secret" },
      body: JSON.stringify({ clientId: "100025122", automationKey: "bf-intro-moment-1" }),
    }), env, {} as ExecutionContext);
    expect(sent.status).toBe(200);
    expect(await sent.json()).toMatchObject({ ok: true, status: "sent", clientId: "100025122" });
    expect(calls.some((call) => call.url.includes("/api/tx"))).toBe(true);
    expect(await repo.hasSent("automation:73:client:100025122")).toBe(true);
  });
});
