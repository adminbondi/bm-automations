import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/index";
import { MERGE_FIELDS } from "../src/merge/fields";
import { mindbodySignature } from "../src/signature";
import { renderSyncContract } from "../src/sync/contract";
import { mayWriteSubscriber, parseContactWriteMode } from "../src/sync/mode";
import { d1Database, Repo } from "../src/db/repo";
import { asD1, emptySnapshot, openSqlite, testEnv, visit } from "./helpers";

describe("contact write mode", () => {
  it("defaults to the shared sync and writes only for an allowlisted dev address", () => {
    expect(parseContactWriteMode(undefined)).toBe("shared_sync");
    expect(parseContactWriteMode("")).toBe("shared_sync");
    expect(parseContactWriteMode("local")).toBe("shared_sync");
    expect(parseContactWriteMode("self")).toBe("self");
    const allow = ["bondi@balancemoves.com.au"];
    expect(mayWriteSubscriber({ mode: "shared_sync", devMode: true, email: "bondi@balancemoves.com.au", emailAllowlist: allow })).toBe(false);
    expect(mayWriteSubscriber({ mode: "self", devMode: false, email: "bondi@balancemoves.com.au", emailAllowlist: allow })).toBe(false);
    expect(mayWriteSubscriber({ mode: "self", devMode: true, email: "ada@example.com", emailAllowlist: allow })).toBe(false);
    expect(mayWriteSubscriber({ mode: "self", devMode: true, email: "Bondi@balancemoves.com.au", emailAllowlist: allow })).toBe(true);
  });

  it("locks the sync contract to the merge-field attribute keys", () => {
    const doc = renderSyncContract();
    expect(readFileSync("SYNC_CONTRACT.md", "utf8")).toBe(doc);
    expect(doc).toContain("shared_sync");
    expect(doc).toContain("subscriber_missing");
    expect(doc).toContain("passEndDate");
    expect(doc).toContain("in parallel");
    expect(doc).toContain("own retry queue");
    expect(doc).toContain("Chatwoot");
    expect(doc).toContain("custom_attributes");
    expect(doc).toContain("YYYY-MM-DD");
    expect(doc).toContain("E.164");
    expect(doc).toContain("blocklisted");
    expect(doc).toContain("| Field key |");
    for (const field of MERGE_FIELDS) {
      if (field.attrib) expect(doc).toContain(`attribs.${field.attrib}`);
    }
  });

  it("skips a missing subscriber and does not create one", async () => {
    const { response, calls, lines, repo } = await sendSale({ subscriber: false });
    expect(response.status).toBe(200);
    expect(calls.some((call) => call.url.includes("/api/tx"))).toBe(false);
    expect(calls.some((call) => call.method === "POST" || call.method === "PUT")).toBe(false);
    expect(lines.some((line) => line.includes("\"reason\":\"subscriber_missing\""))).toBe(true);
    const log = await repo.listSendLog(10, 3);
    expect(log[0]).toMatchObject({ status: "skipped_no_subscriber", detail: "subscriber_missing" });
  });

  it("sends tx data in self mode and upserts only an allowlisted dev address", async () => {
    const written = await sendSale({ extra: { CONTACT_WRITE_MODE: "self" } });
    expect(written.response.status).toBe(200);
    const put = written.calls.find((call) => call.method === "PUT");
    expect(JSON.parse(put?.body ?? "{}").attribs).toMatchObject({ pass_end_date: "14 Oct 2026", first_name: "Ada" });
    const tx = JSON.parse(written.calls.find((call) => call.url.includes("/api/tx"))?.body ?? "{}") as { data: Record<string, unknown> };
    expect(tx.data.passEndDate).toBe("14 Oct 2026");

    const wroteSubscriber = (call: { method: string; url: string }) =>
      call.url.includes("/api/subscribers") && (call.method === "PUT" || call.method === "POST");
    const production = await sendSale({ extra: { CONTACT_WRITE_MODE: "self", DEV_MODE: "false" } });
    expect(production.calls.some(wroteSubscriber)).toBe(false);
    expect(production.calls.some((call) => call.url.includes("/api/tx"))).toBe(true);
    expect(production.lines.some((line) => line.includes("\"reason\":\"dev_mode_off\""))).toBe(true);

    const stranger = await sendSale({
      extra: { CONTACT_WRITE_MODE: "self", DEV_MODE: "false" },
      email: "ada@example.com",
    });
    expect(stranger.calls.some(wroteSubscriber)).toBe(false);
    expect(stranger.lines.some((line) => line.includes("\"reason\":\"not_allowlisted\""))).toBe(true);
  });
});

async function sendSale(options: { subscriber?: boolean; extra?: Record<string, string>; email?: string }) {
  const calls: { method: string; url: string; body: string }[] = [];
  const lines: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  const email = options.email ?? "bondi@balancemoves.com.au";
  const sqlite = openSqlite();
  const env = testEnv(asD1(sqlite), { LISTMONK_API_USER: "api", LISTMONK_API_TOKEN: "token", ...options.extra });
  const present = options.subscriber !== false;
  const app = createApp({
    now: () => new Date("2026-10-11T00:00:00Z"),
    snapshotClient: async () => emptySnapshot({
      profile: { email, phone: null, firstName: "Ada", lastName: "Lovelace", createdAt: "2026-08-01T00:00:00Z", waiverSigned: false },
      services: [{ name: "2 Week Intro Pass", expirationSydney: "2026-10-14", current: true, remaining: 2 }],
      visits: [visit({ serviceName: "2 Week Intro Pass", startSydney: "2026-10-04" })],
    }),
    fetchImpl: async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      calls.push({ method, url, body: String(init?.body ?? "") });
      if (url.includes("/api/subscribers") && method === "GET") {
        const results = present ? [{ id: 9, uuid: "sub", email, status: "enabled", lists: [{ id: 3 }], attribs: { keep: "yes" } }] : [];
        return new Response(JSON.stringify({ data: { results } }), { status: 200 });
      }
      return new Response(JSON.stringify({ data: { id: 9, uuid: "sub", email, status: "enabled", lists: [{ id: 3 }] } }), { status: 200 });
    },
  });
  const repo = new Repo(d1Database(asD1(sqlite)), () => "2026-10-11T00:00:00.000Z");
  await repo.ensureSeed();
  await repo.updateAutomation(3, { enabled: true });
  const body = JSON.stringify({
    messageId: `m-${email}-${options.extra?.CONTACT_WRITE_MODE ?? "shared"}-${options.extra?.DEV_MODE ?? "dev"}`,
    eventId: "clientSale.created",
    eventData: {
      siteId: 9853,
      purchasingClientId: "100",
      clientEmail: email,
      clientFirstName: "Ada",
      clientLastName: "Lovelace",
      items: [{ name: "2 Week Intro Pass" }],
    },
  });
  try {
    const response = await app.fetch(new Request("https://automations.example/webhooks/mindbody", {
      method: "POST",
      headers: { "X-Mindbody-Signature": await mindbodySignature(body, "sign-key"), "Content-Type": "application/json" },
      body,
    }), env, {} as ExecutionContext);
    return { response, calls, lines, repo };
  } finally {
    console.log = original;
  }
}
