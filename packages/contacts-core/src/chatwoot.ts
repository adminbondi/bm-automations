import type { NormalizedContact } from "./contact";

export type ChatwootConfig = {
  baseUrl: string;
  accountId: string;
  apiToken: string;
};

export type ChatwootContact = {
  id: number;
  name: string;
  email: string;
  phoneNumber: string;
  customAttributes: Record<string, string>;
};

export class ChatwootContacts {
  constructor(
    private readonly config: ChatwootConfig,
    private readonly fetchImpl: typeof fetch,
  ) {}

  async upsert(contact: NormalizedContact): Promise<ChatwootContact> {
    const existing = await this.find(contact);
    if (existing) return this.update(existing, contact);
    return this.create(contact);
  }

  private async find(contact: NormalizedContact): Promise<ChatwootContact | null> {
    if (contact.email) {
      const match = (await this.search(contact.email)).find((row) => row.email.toLowerCase() === contact.email);
      if (match) return match;
    }
    if (contact.phone) {
      const match = (await this.search(contact.phone)).find((row) => row.phoneNumber === contact.phone);
      if (match) return match;
    }
    return null;
  }

  private async search(query: string): Promise<ChatwootContact[]> {
    const url = `${this.root()}/api/v1/accounts/${this.config.accountId}/contacts/search?q=${encodeURIComponent(query)}`;
    const response = await this.fetchImpl(url, { headers: this.headers() });
    if (!response.ok) throw new Error(`chatwoot_search_${response.status}`);
    const body = (await response.json()) as { payload?: unknown };
    return rows(body.payload).map(mapContact);
  }

  private async create(contact: NormalizedContact): Promise<ChatwootContact> {
    const response = await this.fetchImpl(`${this.root()}/api/v1/accounts/${this.config.accountId}/contacts`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(payload(contact)),
    });
    if (!response.ok) throw new Error(`chatwoot_create_${response.status}`);
    const body = (await response.json()) as { payload?: unknown };
    const created = unwrap(body.payload);
    if (!created) throw new Error("chatwoot_create_empty");
    return mapContact(created);
  }

  private async update(existing: ChatwootContact, contact: NormalizedContact): Promise<ChatwootContact> {
    const response = await this.fetchImpl(`${this.root()}/api/v1/accounts/${this.config.accountId}/contacts/${existing.id}`, {
      method: "PUT",
      headers: this.headers(),
      body: JSON.stringify({
        ...payload(contact),
        custom_attributes: { ...existing.customAttributes, ...contact.attribs },
      }),
    });
    if (!response.ok) throw new Error(`chatwoot_update_${response.status}`);
    const body = (await response.json()) as { payload?: unknown };
    return mapContact(unwrap(body.payload) ?? {
      id: existing.id,
      name: contact.name,
      email: contact.email,
      phone_number: contact.phone,
      custom_attributes: { ...existing.customAttributes, ...contact.attribs },
    });
  }

  private root(): string {
    return this.config.baseUrl.replace(/\/$/, "");
  }

  private headers(): Headers {
    const headers = new Headers();
    headers.set("Content-Type", "application/json");
    headers.set("api_access_token", this.config.apiToken);
    return headers;
  }
}

function payload(contact: NormalizedContact): Record<string, unknown> {
  return {
    name: contact.name || contact.email || contact.phone || "",
    email: contact.email,
    phone_number: contact.phone,
    custom_attributes: contact.attribs,
  };
}

function rows(payloadValue: unknown): Record<string, unknown>[] {
  if (Array.isArray(payloadValue)) return payloadValue.filter(isRecord);
  if (isRecord(payloadValue) && Array.isArray(payloadValue.contacts)) return payloadValue.contacts.filter(isRecord);
  return [];
}

function unwrap(payloadValue: unknown): Record<string, unknown> | null {
  if (!isRecord(payloadValue)) return null;
  if (isRecord(payloadValue.contact)) return payloadValue.contact;
  if (typeof payloadValue.id === "number") return payloadValue;
  return null;
}

function mapContact(value: Record<string, unknown>): ChatwootContact {
  return {
    id: typeof value.id === "number" ? value.id : 0,
    name: typeof value.name === "string" ? value.name : "",
    email: typeof value.email === "string" ? value.email : "",
    phoneNumber: typeof value.phone_number === "string" ? value.phone_number : "",
    customAttributes: stringAttribs(value.custom_attributes),
  };
}

function stringAttribs(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string") out[key] = item;
    else if (typeof item === "number" || typeof item === "boolean") out[key] = String(item);
  }
  return out;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
