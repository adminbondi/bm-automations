import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createSessionToken } from "../src/auth";
import { findSeed } from "../src/automations/seed";
import { editScript } from "../src/http/pages";
import { createApp } from "../src/index";
import { CONTACT_FIELDS, ListmonkClient } from "@balancemoves/contacts-core";
import { MERGE_FIELDS, renderMergeDoc } from "../src/merge/fields";
import { buildMerge, renderMerge } from "../src/merge/values";
import { planAutomations, type PlanFacts } from "../src/pipeline/plan";
import { mindbodySignature } from "../src/signature";
import { asD1, emptySnapshot, openSqlite, testEnv, visit } from "./helpers";

const automation = findSeed("trial-purchased");

function facts(partial: Partial<PlanFacts> = {}): PlanFacts {
  return {
    eventId: "clientSale.created",
    todaySydney: "2026-10-11",
    anchorSydney: "2026-10-11",
    dueOn: null,
    signedInStatus: null,
    triggeringContractName: null,
    candidatePackageNames: ["2 Week Intro Pass"],
    waiverSigned: false,
    suppressed: false,
    services: [{ name: "2 Week Intro Pass", expirationSydney: "2026-10-14", current: true, remaining: 2 }],
    visits: [visit({ serviceName: "2 Week Intro Pass", startSydney: "2026-10-04" })],
    serviceCount: 1,
    contracts: [],
    visitCrossingRecorded: false,
    windowAlreadyMatched: false,
    clientId: "100",
    email: "bondi@balancemoves.com.au",
    phone: null,
    firstName: "Ada",
    lastName: "Lovelace",
    studioName: "Balance Moves",
    devMode: true,
    dryRun: true,
    emailAllowlist: ["bondi@balancemoves.com.au"],
    phoneAllowlist: [],
    alreadySentKeys: new Set(),
    listmonkBaseUrl: "https://campaigns.balancemoves.com.au",
    withinQuietHours: false,
    ...partial,
  };
}

describe("merge fields", () => {
  it("writes the mapping document from the catalog", () => {
    const doc = renderMergeDoc();
    expect(readFileSync("MERGE_FIELDS.md", "utf8")).toBe(doc);
    expect(doc).toContain("| Mapped | 12 |");
    expect(doc).toContain("| Gap | 12 |");
    expect(doc).toContain("| Field key |");
    expect(doc).toContain("YYYY-MM-DD");
    expect(doc).toContain("E.164");
    expect(doc).toContain("email_opt_out");
    expect(doc).toContain("sms_opt_out");
    expect(doc).toContain("blocklisted");
    expect(doc).toContain("attribs.first_name");
    expect(doc).toContain("GET /client/clientservices — ExpirationDate");
    expect(doc).toContain("| gap |");
    expect(MERGE_FIELDS.filter((field) => field.gap)).toHaveLength(12);
  });

  it("uses the shared contact field list for every stored key", () => {
    const stored = MERGE_FIELDS.filter((field) => field.key);
    expect(stored.map((field) => field.key)).toEqual(CONTACT_FIELDS.map((field) => field.key));
    for (const field of CONTACT_FIELDS) {
      const row = stored.find((item) => item.key === field.key);
      expect(row).toMatchObject({
        type: field.type,
        mindbody: field.mindbody,
        optOut: field.optOut,
        example: field.example,
        gap: field.gap,
        attrib: field.key,
      });
    }
  });

  it("fills Mindbody values and uses fallbacks when they are missing", () => {
    const full = buildMerge({
      automation,
      firstName: "Ada",
      lastName: "Lovelace",
      email: "Ada@Example.com",
      studioName: "Balance Moves",
      todaySydney: "2026-10-11",
      services: [
        { name: "2 Week Intro Pass", expirationSydney: "2026-10-09", current: true, remaining: 2 },
      ],
      visits: [visit({ serviceName: "2 Week Intro Pass", startSydney: "2026-10-04" })],
      unsubscribeUrl: "https://campaigns.balancemoves.com.au/subscription/form",
    });
    expect(full.data).toMatchObject({
      FirstName: "Ada",
      LastName: "Lovelace",
      Email: "ada@example.com",
      packName: "2 Week Intro Pass",
      passEndDate: "9 Oct 2026",
      visits: 1,
      creditsRemaining: 2,
      daysSinceExpiry: "two",
      daysSinceLastVisit: "seven",
      studioPhone: "0424 133 544",
      agent: "",
      secondaryOfferPrice: "",
    });
    expect(full.attribs.first_name).toBe("Ada");
    expect(full.attribs.visits).toBe("1");
    const text = renderMerge(
      "Hi [First name] [Last name], *|PACK_NAME|* ends *|PASS_END|*. *|VISITS|* visits, *|CREDITS|* left, @Days since the client's package expiration, in words since it ended. Call @Studio phone number.",
      full,
    );
    expect(text).toBe("Hi Ada Lovelace, 2 Week Intro Pass ends 9 Oct 2026. 1 visits, 2 left, two since it ended. Call 0424 133 544.");

    const empty = buildMerge({
      automation,
      firstName: "  ",
      lastName: null,
      email: null,
      studioName: "",
      todaySydney: "2026-10-11",
      services: [],
      visits: [],
    });
    expect(empty.data.FirstName).toBe("there");
    expect(empty.attribs.first_name).toBe("");
    expect(empty.data.LastName).toBe("");
    expect(empty.data.packName).toBe("your pass");
    expect(empty.data.passEndDate).toBe("");
    expect(empty.data.visits).toBe(0);
    expect(empty.data.creditsRemaining).toBe("");
    expect(empty.data.daysSinceExpiry).toBe("");
    expect(empty.data.daysSinceLastVisit).toBe("");
    expect(empty.data.studio).toBe("Balance Moves");
    const cleared = renderMerge(
      "Hi [First name] [Last name]. *|PACK_NAME|* *|PASS_END|* *|CREDITS|* @Agent [Secondary Offer Price] @Intro Offer Purchase URL",
      empty,
    );
    expect(cleared).toBe("Hi there. your pass");
    expect(cleared).not.toContain("[");
    expect(cleared).not.toContain("@");
    expect(cleared).not.toContain("*|");
  });

  it("puts the same values on the email plan, including a blank first name", () => {
    const plan = planAutomations([automation], facts({
      firstName: null,
      lastName: null,
      services: [{ name: "2 Week Intro Pass", expirationSydney: "2026-10-20", current: true }],
    })).find((row) => row.automation.key === "trial-purchased");
    expect(plan?.data.FirstName).toBe("there");
    expect(plan?.attribs.first_name).toBe("");
    expect(plan?.data.packName).toBe("2 Week Intro Pass");
    expect(plan?.data.passEndDate).toBe("20 Oct 2026");
    expect(plan?.data.visits).toBe(1);
    expect(plan?.data.creditsRemaining).toBe("");
    expect(plan?.data.daysSinceLastVisit).toBe("seven");
    expect(plan?.data.unsubscribeUrl).toBe("https://campaigns.balancemoves.com.au/subscription/form");
    expect(plan?.data.preferencesUrl).toBe("https://campaigns.balancemoves.com.au/subscription/form");
  });

  it("previews example values and inserts a field token in the editor script", () => {
    const document = { getElementById: () => null, querySelector: () => null };
    const preview = new Function("document", "location", `${editScript(false)}\nreturn preview;`)(document, { hash: "" }) as (raw: string) => string;
    expect(preview("Hi [First name] from [Studio], pass *|PASS_END|*")).toBe("Hi Alex from Balance Moves, pass 14 Oct 2026");
    expect(preview("@Agent [Secondary Offer Discount Price]")).toBe("");
    const stopped = new Function("document", "location", `${editScript(true)}\nreturn preview;`)(document, { hash: "" }) as (raw: string) => string;
    expect(stopped("Hi [First name]")).toBe("Hi Alex\nReply STOP");
  });
});

describe("merge field delivery", () => {
  it("creates a subscriber with attribs and sends them on /api/tx", async () => {
    const calls: { method: string; url: string; body: string }[] = [];
    const client = new ListmonkClient(
      {
        baseUrl: "https://campaigns.balancemoves.com.au",
        apiUser: "api",
        apiToken: "token",
        listId: "3",
        suppressedListId: "",
        fromEmail: "",
      },
      async (input, init) => {
        const method = init?.method ?? "GET";
        const url = String(input);
        calls.push({ method, url, body: String(init?.body ?? "") });
        if (method === "GET") return new Response(JSON.stringify({ data: { results: [] } }), { status: 200 });
        return new Response(JSON.stringify({ data: { id: 4, uuid: "new-sub", email: "bondi@balancemoves.com.au", status: "enabled", lists: [{ id: 3 }] } }), { status: 200 });
      },
    );
    await client.ensureSubscriber({ email: "bondi@balancemoves.com.au", name: "Ada Lovelace", attribs: { first_name: "Ada", pack_name: "2 Week Intro Pass" } });
    const created = calls.find((call) => call.method === "POST");
    expect(JSON.parse(created?.body ?? "{}")).toMatchObject({
      email: "bondi@balancemoves.com.au",
      attribs: { first_name: "Ada", pack_name: "2 Week Intro Pass" },
    });
    await client.sendTx({ email: "bondi@balancemoves.com.au", templateId: 7, data: { FirstName: "Ada", visits: 1, passEndDate: "14 Oct 2026" } });
    const tx = calls.find((call) => call.url.endsWith("/api/tx"));
    expect(JSON.parse(tx?.body ?? "{}")).toMatchObject({
      subscriber_email: "bondi@balancemoves.com.au",
      template_id: 7,
      data: { FirstName: "Ada", visits: 1, passEndDate: "14 Oct 2026" },
    });
  });

  it("upserts attribs on an existing subscriber and keeps keys it did not set", async () => {
    const calls: { method: string; body: string }[] = [];
    const client = new ListmonkClient(
      {
        baseUrl: "https://campaigns.balancemoves.com.au",
        apiUser: "api",
        apiToken: "token",
        listId: "3",
        suppressedListId: "",
        fromEmail: "",
      },
      async (input, init) => {
        calls.push({ method: init?.method ?? "GET", body: String(init?.body ?? "") });
        void input;
        return new Response(JSON.stringify({
          data: { results: [{ id: 9, uuid: "sub", email: "bondi@balancemoves.com.au", status: "enabled", lists: [{ id: 3 }], attribs: { keep: "yes" } }] },
        }), { status: 200 });
      },
    );
    await client.ensureSubscriber({ email: "bondi@balancemoves.com.au", name: "Ada", attribs: { first_name: "Ada" } });
    const put = calls.find((call) => call.method === "PUT");
    expect(JSON.parse(put?.body ?? "{}").attribs).toEqual({ keep: "yes", first_name: "Ada" });
  });

  it("sends fetched values from a Mindbody snapshot through listmonk", async () => {
    const calls: { method: string; url: string; body: string }[] = [];
    const sqlite = openSqlite();
    const env = testEnv(asD1(sqlite), { LISTMONK_API_USER: "api", LISTMONK_API_TOKEN: "token" });
    const app = createApp({
      now: () => new Date("2026-10-11T00:00:00Z"),
      snapshotClient: async () => emptySnapshot({
        profile: { email: "bondi@balancemoves.com.au", phone: null, firstName: "Ada", lastName: "Lovelace", createdAt: "2026-08-01T00:00:00Z", waiverSigned: false },
        services: [{ name: "2 Week Intro Pass", expirationSydney: "2026-10-14", current: true, remaining: 2 }],
        visits: [visit({ serviceName: "2 Week Intro Pass", startSydney: "2026-10-04" })],
      }),
      fetchImpl: async (input, init) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        calls.push({ method, url, body: String(init?.body ?? "") });
        if (url.includes("/api/subscribers") && method === "GET") {
          return new Response(JSON.stringify({ data: { results: [{ id: 9, uuid: "sub", email: "bondi@balancemoves.com.au", status: "enabled", lists: [{ id: 3 }], attribs: { keep: "yes" } }] } }), { status: 200 });
        }
        return new Response("{}", { status: 200 });
      },
    });
    const { d1Database, Repo } = await import("../src/db/repo");
    const repo = new Repo(d1Database(asD1(sqlite)), () => "2026-10-11T00:00:00.000Z");
    await repo.ensureSeed();
    await repo.updateAutomation(3, { enabled: true });
    const body = JSON.stringify({
      messageId: "m-merge",
      eventId: "clientSale.created",
      eventData: {
        siteId: 9853,
        purchasingClientId: "100",
        clientEmail: "bondi@balancemoves.com.au",
        clientFirstName: "Ada",
        clientLastName: "Lovelace",
        items: [{ name: "2 Week Intro Pass" }],
      },
    });
    const response = await app.fetch(new Request("https://automations.example/webhooks/mindbody", {
      method: "POST",
      headers: { "X-Mindbody-Signature": await mindbodySignature(body, "sign-key"), "Content-Type": "application/json" },
      body,
    }), env, {} as ExecutionContext);
    expect(response.status).toBe(200);
    expect(calls.some((call) => call.method === "PUT" || call.method === "POST" && call.url.includes("/api/subscribers"))).toBe(false);
    const tx = JSON.parse(calls.find((call) => call.url.includes("/api/tx"))?.body ?? "{}") as { data: Record<string, unknown> };
    expect(tx.data).toMatchObject({
      FirstName: "Ada",
      packName: "2 Week Intro Pass",
      passEndDate: "14 Oct 2026",
      visits: 1,
      creditsRemaining: 2,
      daysSinceLastVisit: "seven",
      daysSinceExpiry: "",
      agent: "",
    });
    expect(String(tx.data.unsubscribeUrl)).toContain("/subscription/sub/sub");
    expect(tx.data.preferencesUrl).toBe(tx.data.unsubscribeUrl);
  });
});

describe("merge field admin API", () => {
  function harness() {
    const sqlite = openSqlite();
    const env = testEnv(asD1(sqlite));
    const app = createApp({
      now: () => new Date("2026-10-11T00:00:00Z"),
      fetchImpl: async () => new Response("{}", { status: 200 }),
    });
    return { app, env };
  }

  it("requires a session and returns examples for the insert picker", async () => {
    const { app, env } = harness();
    const anon = await app.fetch(new Request("https://automations.example/admin/merge-fields"), env, {} as ExecutionContext);
    expect(anon.status).toBe(401);
    const token = await createSessionToken("session-secret", "owner@balancemoves.com.au");
    const response = await app.fetch(new Request("https://automations.example/admin/merge-fields", {
      headers: { Cookie: `bm_automations_session=${token}` },
    }), env, {} as ExecutionContext);
    expect(response.status).toBe(200);
    const body = await response.json() as {
      fields: { loyalSnap: string; mindbody: string; attrib: string | null; insert: string; example: string; gap: boolean }[];
      preview: { FirstName: string; passEndDate: string; visits: number };
    };
    const first = body.fields.find((field) => field.insert === "[First name]");
    expect(first).toMatchObject({ key: "first_name", type: "string", mindbody: "GET /client/clients — FirstName", attrib: "attribs.first_name", example: "Alex", gap: false });
    const agent = body.fields.find((field) => field.insert === "@Agent");
    expect(agent?.mindbody).toBe("gap");
    expect(agent?.attrib).toBeNull();
    expect(body.preview).toMatchObject({ FirstName: "Alex", passEndDate: "14 Oct 2026", visits: 3 });
    const page = await app.fetch(new Request("https://automations.example/automations/10", {
      headers: { Cookie: `bm_automations_session=${token}` },
    }), env, {} as ExecutionContext);
    const html = await page.text();
    expect(html).toContain('id="insert-field"');
    expect(html).toContain("Insert field");
    expect(html).toContain("*|PASS_END|*");
    expect(html).toContain("[First name]");
  });
});
