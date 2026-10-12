import { describe, expect, it } from "vitest";
import {
  CONTACT_ATTRIBUTES,
  CONTACT_FIELDS,
  ChatwootContacts,
  ListmonkClient,
  MindbodyClient,
  attributesToCopy,
  mapClient,
  normalizePhone,
  sharedContactAttribs,
  toIsoDate,
} from "../src/index";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("normalizePhone", () => {
  it("turns Australian mobiles into E.164 and leaves E.164 alone", () => {
    expect(normalizePhone("0424 133 544")).toBe("+61424133544");
    expect(normalizePhone("+61424133544")).toBe("+61424133544");
    expect(normalizePhone("0061412345678")).toBe("+61412345678");
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("   ")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });
});

describe("toIsoDate", () => {
  it("keeps a calendar date and converts a timestamp to the Sydney date", () => {
    expect(toIsoDate("2026-10-14")).toBe("2026-10-14");
    expect(toIsoDate("2026-10-14T00:30:00Z")).toBe("2026-10-14");
    expect(toIsoDate("not-a-date")).toBeNull();
    expect(toIsoDate(null)).toBeNull();
  });
});

describe("CONTACT_FIELDS", () => {
  it("lists the shared keys once, with ISO dates, E.164 phones, and email blocklist", () => {
    const keys = CONTACT_FIELDS.map((field) => field.key);
    expect(keys).toHaveLength(15);
    expect(new Set(keys).size).toBe(15);
    expect(CONTACT_FIELDS.find((field) => field.key === "phone")?.type).toContain("E.164");
    expect(CONTACT_FIELDS.find((field) => field.key === "pass_end_date")?.type).toContain("YYYY-MM-DD");
    expect(CONTACT_FIELDS.find((field) => field.key === "email_opt_out")?.optOut).toContain("blocklisted");
  });
});

describe("shared contact attributes", () => {
  it("uses the Chatwoot keys, including packs and intro fields", () => {
    const keys = CONTACT_ATTRIBUTES.map((field) => field.attribute_key);
    expect(keys).toContain("client_id");
    expect(keys).toContain("packs");
    expect(keys).toContain("pack_credits_total");
    expect(keys).toContain("reformer_credits");
    expect(keys).toContain("mat_barre_credits");
    expect(keys).toContain("breathwork_yoga_credits");
    expect(keys.filter((key) => key.startsWith("intro_")).length).toBeGreaterThan(0);
    expect(keys.some((key) => key.startsWith("mindbody_"))).toBe(false);
    const blank = sharedContactAttribs();
    expect(Object.keys(blank).sort()).toEqual([...keys].sort());
    expect(blank.membership_status).toBe("None");
    const filled = sharedContactAttribs({
      clientId: "100",
      active: true,
      today: "2026-10-11",
      services: [
        {
          name: "REFORMER CLASS - 5 PACK",
          productId: 507,
          remaining: 4,
          current: true,
          expiration: "2026-12-01",
          activeDate: "2026-10-01",
        },
        {
          name: "INTRO PASS - 7 DAYS UNLIMITED CLASSES",
          productId: 486,
          remaining: 0,
          current: true,
          expiration: "2026-10-20",
        },
      ],
    });
    expect(filled).toMatchObject({
      client_id: "100",
      active: "true",
      packs: "REFORMER CLASS - 5 PACK: 4 left, exp 2026-12-01",
      pack_credits_total: "4",
      reformer_credits: "4",
      mat_barre_credits: "0",
      breathwork_yoga_credits: "0",
      pack_next_expiry: "2026-12-01",
      intro_client: "true",
      intro_active: "true",
      intro_expiry: "2026-10-20",
      intro_days_left: "9",
    });
    expect(attributesToCopy({ mindbody_id: "9", client_id: "kept" })).toEqual({});
    expect(attributesToCopy({ mindbody_packs: "old pack" })).toEqual({ packs: "old pack" });
  });
});

describe("mapClient", () => {
  const services = [{ name: "2 Week Intro Pass", expiration: "2026-10-14T00:00:00", remaining: 2, current: true }];

  it("stores ISO dates, E.164 phones, and opt-out flags", () => {
    const contact = mapClient(
      {
        FirstName: "Ada",
        LastName: "Lovelace",
        Email: "Ada@Example.com",
        MobilePhone: "0412 345 678",
        SendPromotionalEmails: false,
        SendPromotionalTexts: false,
      },
      {
        services,
        visits: [
          { start: "2026-10-04", signedIn: true },
          { start: "2026-10-05", signedIn: false },
          { start: "2026-10-06", signedIn: true, cancelled: true },
        ],
        today: "2026-10-16",
      },
    );
    expect(contact.email).toBe("ada@example.com");
    expect(contact.phone).toBe("+61412345678");
    expect(contact.firstName).toBe("Ada");
    expect(contact.emailOptOut).toBe(true);
    expect(contact.smsOptOut).toBe(true);
    expect(contact.attribs).toMatchObject({
      first_name: "Ada",
      email_opt_out: "true",
      sms_opt_out: "true",
      pass_end_date: "2026-10-14",
      visits: "1",
      days_since_expiry: "two",
      studio_phone: "+61424133544",
      pack_name: "2 Week Intro Pass",
    });
    expect(contact.attribs.first_name).not.toBe("there");
  });

  it("treats a missing or true promotional flag as opted in, and a future expiry as blank", () => {
    const missing = mapClient({ FirstName: "", Email: "ada@example.com" }, { services, today: "2026-10-11" });
    expect(missing.emailOptOut).toBe(false);
    expect(missing.smsOptOut).toBe(false);
    expect(missing.attribs.email_opt_out).toBe("false");
    expect(missing.attribs.first_name).toBe("");
    expect(missing.attribs.days_since_expiry).toBe("");
    expect(missing.attribs.pass_end_date).toBe("2026-10-14");

    const optedIn = mapClient({ SendPromotionalEmails: true, SendPromotionalTexts: true });
    expect(optedIn.emailOptOut).toBe(false);
    expect(optedIn.smsOptOut).toBe(false);
  });
});

describe("ListmonkClient", () => {
  const connection = {
    baseUrl: "https://campaigns.example",
    apiUser: "user",
    apiToken: "token",
    listId: "3",
    suppressedListId: "",
    fromEmail: "",
  };

  it("blocklists an opted-out contact and stores the ISO pass end date", async () => {
    const calls: { method: string; url: string; body: string }[] = [];
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      calls.push({ method, url, body: typeof init?.body === "string" ? init.body : "" });
      if (method === "GET") return json({ data: { results: [{ id: 9, uuid: "u", email: "ada@example.com", status: "enabled", lists: [{ id: 3 }], attribs: { studio: "old" } }] } });
      return json({ data: { id: 9, email: "ada@example.com", status: "blocklisted" } });
    };
    const client = new ListmonkClient(connection, fetchImpl);
    const contact = mapClient(
      { Email: "ada@example.com", FirstName: "Ada", SendPromotionalEmails: false },
      { services: [{ name: "Intro", expiration: "2026-10-14", remaining: 1, current: true }] },
    );
    await client.upsertContact(contact);
    const put = calls.find((call) => call.method === "PUT");
    expect(put?.url).toContain("/api/subscribers/9");
    const body = JSON.parse(put?.body ?? "{}") as { status: string; attribs: Record<string, string> };
    expect(body.status).toBe("blocklisted");
    expect(body.attribs.pass_end_date).toBe("2026-10-14");
    expect(body.attribs.studio).toBe("Balance Moves");
  });

  it("creates a subscriber when listmonk has no row", async () => {
    const calls: { method: string; body: string }[] = [];
    const fetchImpl = async (_input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({ method, body: typeof init?.body === "string" ? init.body : "" });
      if (method === "GET") return json({ data: { results: [] } });
      return json({ data: { id: 4, uuid: "new", email: "ada@example.com", status: "enabled", lists: [{ id: 3 }] } });
    };
    const client = new ListmonkClient(connection, fetchImpl);
    const created = await client.upsertContact(mapClient({ Email: "ada@example.com", FirstName: "Ada" }));
    expect(created.id).toBe(4);
    const post = calls.find((call) => call.method === "POST");
    expect(JSON.parse(post?.body ?? "{}").status).toBe("enabled");
  });

  it("refuses a contact with no email", async () => {
    const client = new ListmonkClient(connection, async () => json({}));
    await expect(client.upsertContact(mapClient({ FirstName: "Ada" }))).rejects.toThrow("listmonk_email_missing");
  });

  it("leaves an existing subscriber status alone on a dev self-write", async () => {
    const calls: { method: string; body: string }[] = [];
    const fetchImpl = async (_input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({ method, body: typeof init?.body === "string" ? init.body : "" });
      if (method === "GET") {
        return json({ data: { results: [{ id: 9, email: "ada@example.com", status: "enabled", lists: [{ id: 3 }], attribs: {} }] } });
      }
      return json({});
    };
    const client = new ListmonkClient(connection, fetchImpl);
    await client.ensureSubscriber({ email: "ada@example.com", name: "Ada", attribs: { first_name: "Ada" } });
    const put = JSON.parse(calls.find((call) => call.method === "PUT")?.body ?? "{}") as { status: string };
    expect(put.status).toBe("enabled");
  });
});

describe("ChatwootContacts", () => {
  const config = { baseUrl: "https://chat.example", accountId: "1", apiToken: "secret" };

  it("creates a contact when search is empty", async () => {
    const calls: { method: string; url: string; body: string; token: string | null }[] = [];
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      calls.push({
        method: init?.method ?? "GET",
        url: String(input),
        body: typeof init?.body === "string" ? init.body : "",
        token: headers.get("api_access_token"),
      });
      if ((init?.method ?? "GET") === "GET") return json({ payload: [] });
      return json({ payload: { contact: { id: 7, name: "Ada", email: "ada@example.com", phone_number: "+61412345678", custom_attributes: {} } } });
    };
    const client = new ChatwootContacts(config, fetchImpl);
    const created = await client.upsert(mapClient({ Email: "ada@example.com", FirstName: "Ada", MobilePhone: "0412 345 678" }));
    expect(created.id).toBe(7);
    expect(created.phoneNumber).toBe("+61412345678");
    const post = calls.find((call) => call.method === "POST");
    expect(post?.url).toBe("https://chat.example/api/v1/accounts/1/contacts");
    expect(post?.token).toBe("secret");
    expect(JSON.parse(post?.body ?? "{}").phone_number).toBe("+61412345678");
  });

  it("updates a search hit and merges custom attributes", async () => {
    const calls: { method: string; url: string; body: string }[] = [];
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({ method, url: String(input), body: typeof init?.body === "string" ? init.body : "" });
      if (method === "GET") {
        return json({
          payload: { contacts: [{ id: 7, email: "ada@example.com", phone_number: "+61412345678", custom_attributes: { studio: "old", note: "keep" } }] },
        });
      }
      return json({ payload: { id: 7, email: "ada@example.com", phone_number: "+61412345678", custom_attributes: {} } });
    };
    const client = new ChatwootContacts(config, fetchImpl);
    await client.upsert(mapClient({ Email: "ada@example.com", FirstName: "Ada", MobilePhone: "+61412345678" }));
    expect(calls.some((call) => call.method === "POST")).toBe(false);
    const put = calls.find((call) => call.method === "PUT");
    expect(put?.url).toBe("https://chat.example/api/v1/accounts/1/contacts/7");
    const body = JSON.parse(put?.body ?? "{}") as { phone_number: string; custom_attributes: Record<string, string> };
    expect(body.phone_number).toBe("+61412345678");
    expect(body.custom_attributes.note).toBe("keep");
    expect(body.custom_attributes.studio).toBe("Balance Moves");
    expect(body.custom_attributes.email_opt_out).toBe("false");
  });
});

describe("MindbodyClient", () => {
  it("loads a client and normalises the phone and email opt-out", async () => {
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/usertoken/issue")) return json({ AccessToken: "tok" });
      if (url.includes("/client/clients")) {
        expect(init?.headers && new Headers(init.headers).get("Authorization")).toBe("tok");
        return json({
          Clients: [{
            FirstName: "Ada",
            Email: "Ada@Example.com",
            MobilePhone: "0412 345 678",
            SendPromotionalEmails: false,
            SendPromotionalTexts: true,
          }],
        });
      }
      return json({});
    };
    const client = new MindbodyClient(
      { apiKey: "key", siteId: "9853", staffUsername: "staff", staffPassword: "pw" },
      fetchImpl,
      () => new Date("2026-10-11T00:00:00Z"),
    );
    const contact = await client.contact("100");
    expect(contact.email).toBe("ada@example.com");
    expect(contact.phone).toBe("+61412345678");
    expect(contact.emailOptOut).toBe(true);
    expect(contact.smsOptOut).toBe(false);
    expect(contact.attribs.phone).toBe("+61412345678");
  });

  it("loads up to 200 clients in one call and reuses a cached staff token", async () => {
    const urls: string[] = [];
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      urls.push(url);
      if (url.endsWith("/usertoken/issue")) return json({ AccessToken: "tok" });
      expect(url).toContain("request.clientIDs=100,200");
      expect(new Headers(init?.headers).get("Authorization")).toBe("tok");
      return json({
        Clients: [
          { Id: "100", FirstName: "Ada", Email: "a@example.com" },
          { Id: 200, FirstName: "Bea", Email: "b@example.com" },
        ],
      });
    };
    const auth = { apiKey: "key", siteId: "9853", staffUsername: "staff", staffPassword: "pw" };
    const client = new MindbodyClient(auth, fetchImpl, () => new Date("2026-10-11T00:00:00Z"));
    const rows = await client.profiles(["100", "200"]);
    expect(rows.map((row) => row.clientId)).toEqual(["100", "200"]);
    expect(rows[0]?.profile.firstName).toBe("Ada");
    expect(client.issuedToken()).toBe("tok");
    const cached = new MindbodyClient(auth, fetchImpl, () => new Date("2026-10-11T00:00:00Z"), "tok");
    await cached.profiles(["100", "200"]);
    expect(urls.filter((url) => url.endsWith("/usertoken/issue"))).toHaveLength(1);
    expect(cached.issuedToken()).toBeNull();
  });

  it("searches clients by name or email", async () => {
    const urls: string[] = [];
    const fetchImpl = async (input: RequestInfo | URL) => {
      const url = String(input);
      urls.push(url);
      if (url.endsWith("/usertoken/issue")) return json({ AccessToken: "tok" });
      if (url.includes("searchText")) {
        return json({
          Clients: [
            { Id: 100, FirstName: "Ada", LastName: "Lovelace", Email: "Ada@Example.com", MobilePhone: "0412 345 678" },
            { FirstName: "No Id" },
          ],
        });
      }
      return json({});
    };
    const client = new MindbodyClient(
      { apiKey: "key", siteId: "9853", staffUsername: "staff", staffPassword: "pw" },
      fetchImpl,
      () => new Date("2026-10-11T00:00:00Z"),
    );
    expect(await client.searchClients("a")).toEqual([]);
    const hits = await client.searchClients("Ada");
    expect(hits).toEqual([{
      id: "100",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      phone: "+61412345678",
    }]);
    expect(urls.some((url) => url.includes("request.searchText=Ada"))).toBe(true);
  });
});
