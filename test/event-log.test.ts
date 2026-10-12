import { describe, expect, it } from "vitest";
import { createSessionToken } from "../src/auth";
import { createApp } from "../src/index";
import { mindbodySignature } from "../src/signature";
import { formatSydney } from "../src/time";
import { asD1, openSqlite, testEnv } from "./helpers";

const NOW = new Date("2026-10-11T00:00:00.000Z");
const OCCURRED = "2026-10-10T22:30:00.000Z";

function harness() {
  const sqlite = openSqlite();
  const env = testEnv(asD1(sqlite));
  const app = createApp({
    now: () => NOW,
    fetchImpl: async () => {
      throw new Error("unexpected fetch");
    },
  });
  return { sqlite, env, app };
}

function clientBody(messageId: string, extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    messageId,
    eventId: "client.created",
    eventInstanceOriginationDateTime: OCCURRED,
    eventData: {
      siteId: 9853,
      clientId: "100",
      email: "ada@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      mobilePhone: "0412345678",
      creationDateTime: "2026-10-11T00:00:00.000Z",
      ...extra,
    },
  });
}

async function post(
  app: ReturnType<typeof createApp>,
  env: Env,
  body: string,
  headers: Record<string, string> = {},
) {
  const signature = await mindbodySignature(body, "sign-key");
  return app.fetch(new Request("https://automations.example/webhooks/mindbody", {
    method: "POST",
    headers: { "X-Mindbody-Signature": signature, "Content-Type": "application/json", ...headers },
    body,
  }), env, {} as ExecutionContext);
}

type EventRow = {
  id: number;
  message_id: string;
  event_id: string;
  client_id: string | null;
  site_id: string | null;
  occurred_at: string | null;
  received_at: string;
  ignored_reason: string | null;
};

type MatchRow = {
  event_log_id: number;
  automation_id: number;
  automation_key: string;
  phase: string;
  outcome: string;
  reason: string | null;
  would_send: number;
};

function events(sqlite: ReturnType<typeof openSqlite>): EventRow[] {
  return sqlite.prepare(`SELECT * FROM event_log ORDER BY id`).all() as EventRow[];
}

function matches(sqlite: ReturnType<typeof openSqlite>): MatchRow[] {
  return sqlite.prepare(`SELECT event_log_id, automation_id, automation_key, phase, outcome, reason, would_send FROM event_log_matches ORDER BY id`).all() as MatchRow[];
}

describe("event log", () => {
  it("records a disabled webhook, skips a non-match, and does not insert a duplicate message id", async () => {
    const { sqlite, env, app } = harness();
    const body = clientBody("m-evt-1");
    const response = await post(app, env, body);
    expect(response.status).toBe(200);
    const payload = await response.json() as {
      ok: boolean;
      dryRun: boolean;
      plans: { key: string; phase: string; reason: string }[];
    };
    expect(payload.ok).toBe(true);
    expect(payload.dryRun).toBe(false);
    expect(payload.plans.find((plan) => plan.key === "lead-immediate")?.reason).toBe("automation_disabled");

    const rows = events(sqlite);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      message_id: "m-evt-1",
      event_id: "client.created",
      client_id: "100",
      site_id: "9853",
      occurred_at: OCCURRED,
      received_at: NOW.toISOString(),
      ignored_reason: null,
    });
    const stored = JSON.stringify({ rows, matches: matches(sqlite) });
    expect(stored).not.toContain("ada@example.com");
    expect(stored).not.toContain("0412345678");
    expect(stored).not.toContain("Lovelace");
    expect(stored).not.toContain(body);

    const matchRows = matches(sqlite);
    expect(matchRows.map((row) => `${row.automation_key}:${row.phase}`).sort()).toEqual(
      payload.plans.map((plan) => `${plan.key}:${plan.phase}`).sort(),
    );
    expect(matchRows.find((row) => row.automation_key === "lead-immediate")).toMatchObject({
      reason: "automation_disabled",
      would_send: 0,
      outcome: "skip",
      phase: "trigger",
    });
    expect(matchRows.find((row) => row.automation_key === "unused-lead-immediate-text")).toMatchObject({
      reason: "automation_disabled",
      would_send: 0,
    });
    expect(matchRows.some((row) => row.reason === "automation_disabled")).toBe(true);
    expect(matchRows.filter((row) => row.reason === "automation_disabled").every((row) => row.would_send === 0)).toBe(true);
    expect(matchRows.every((row) => row.would_send === 0)).toBe(true);
    expect(matchRows.find((row) => row.automation_key === "trial-purchased")).toBeUndefined();

    const again = await post(app, env, body);
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ duplicate: true });
    expect(events(sqlite)).toHaveLength(1);
    expect(matches(sqlite)).toHaveLength(matchRows.length);

    const dry = clientBody("m-evt-dry");
    const preview = await post(app, env, dry, { "X-Dry-Run": "true" });
    expect(preview.status).toBe(200);
    const previewBody = await preview.json() as { dryRun: boolean; plans: { key: string; reason: string }[] };
    expect(previewBody.dryRun).toBe(true);
    expect(previewBody.plans.find((plan) => plan.key === "lead-immediate")?.reason).toBe("automation_disabled");
    expect(events(sqlite).map((row) => row.message_id)).toEqual(["m-evt-1"]);
  });

  it("deletes rows older than 14 days when a new event is inserted", async () => {
    const { sqlite, env, app } = harness();
    const insert = (messageId: string, receivedAt: string) => {
      sqlite.prepare(
        `INSERT INTO event_log (message_id, event_id, client_id, site_id, occurred_at, received_at, ignored_reason)
         VALUES (?, 'client.updated', 'old', '9853', ?, ?, NULL)`,
      ).run(messageId, receivedAt, receivedAt);
      const row = sqlite.prepare(`SELECT id FROM event_log WHERE message_id = ?`).get(messageId) as { id: number };
      sqlite.prepare(
        `INSERT INTO event_log_matches (event_log_id, automation_id, automation_key, phase, outcome, reason, would_send)
         VALUES (?, 3, 'trial-purchased', 'trigger', 'skip', 'automation_disabled', 0)`,
      ).run(row.id);
    };
    insert("stale", "2026-09-26T00:00:00.000Z");
    insert("boundary", "2026-09-27T00:00:00.000Z");
    insert("recent", "2026-09-28T00:00:00.000Z");

    const response = await post(app, env, clientBody("m-evt-new"));
    expect(response.status).toBe(200);
    const ids = events(sqlite).map((row) => row.message_id);
    expect(ids).not.toContain("stale");
    expect(ids).toEqual(expect.arrayContaining(["boundary", "recent", "m-evt-new"]));
    const orphans = sqlite.prepare(
      `SELECT COUNT(*) AS n FROM event_log_matches m LEFT JOIN event_log e ON e.id = m.event_log_id WHERE e.id IS NULL`,
    ).get() as { n: number };
    expect(orphans.n).toBe(0);
    const kept = sqlite.prepare(
      `SELECT automation_key FROM event_log_matches WHERE event_log_id = (SELECT id FROM event_log WHERE message_id = 'recent')`,
    ).get() as { automation_key: string };
    expect(kept.automation_key).toBe("trial-purchased");
    expect(sqlite.prepare(`SELECT id FROM event_log WHERE message_id = 'stale'`).get()).toBeUndefined();
  });

  it("shows the newest events behind the Google session, with filters and no sample data", async () => {
    const { env, app } = harness();
    const anon = await app.fetch(new Request("https://automations.example/events"), env, {} as ExecutionContext);
    expect(anon.status).toBe(200);
    expect(await anon.text()).toContain("Sign in with a Google account");

    const token = await createSessionToken("session-secret", "owner@balancemoves.com.au");
    const headers = { Cookie: `bm_automations_session=${token}` };
    const empty = await app.fetch(new Request("https://automations.example/events", { headers }), env, {} as ExecutionContext);
    const emptyHtml = await empty.text();
    expect(empty.status).toBe(200);
    expect(emptyHtml).toContain("No events yet");
    expect(emptyHtml).toContain(">Events<");
    expect(emptyHtml).toContain("href=\"/events\" class=\"on\"");
    expect(emptyHtml).not.toContain("Example data");
    expect(emptyHtml).not.toContain("Alex Example");
    expect(emptyHtml).not.toContain("ada@example.com");

    const body = clientBody("m-evt-page");
    expect((await post(app, env, body)).status).toBe(200);
    const page = await app.fetch(new Request("https://automations.example/events", { headers }), env, {} as ExecutionContext);
    const html = await page.text();
    expect(html).toContain("client.created");
    expect(html).toContain("data-l=\"Client id\">100");
    expect(html).toContain(formatSydney(NOW));
    expect(html).toContain(formatSydney(new Date(OCCURRED)));
    expect(html).toContain("lead-immediate");
    expect(html).toContain("automation_disabled");
    expect(html.indexOf("client.created")).toBeLessThan(html.indexOf("lead-immediate"));
    expect(html).not.toContain("trial-purchased");
    expect(html).not.toContain("ada@example.com");
    expect(html).not.toContain("0412345678");
    expect(html).not.toContain("Example data");
    expect(html).not.toContain("No events yet");

    const filtered = await app.fetch(new Request("https://automations.example/events?type=client.created&client=100", { headers }), env, {} as ExecutionContext);
    const filteredHtml = await filtered.text();
    expect(filteredHtml).toContain("lead-immediate");
    expect(filteredHtml).toContain("data-l=\"Client id\">100");

    const missed = await app.fetch(new Request("https://automations.example/events?type=clientSale.created&client=999", { headers }), env, {} as ExecutionContext);
    const missedHtml = await missed.text();
    expect(missedHtml).toContain("No events match these filters.");
    expect(missedHtml).not.toContain("lead-immediate");
    expect(missedHtml).not.toContain("Example data");
  });
});
