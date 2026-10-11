import type { NormalizedContact } from "./contact";

export type ListmonkConnection = {
  baseUrl: string;
  apiUser: string;
  apiToken: string;
  listId: string;
  suppressedListId: string;
  fromEmail: string;
};

export type Subscriber = {
  id: number;
  uuid: string | null;
  email: string;
  status: string;
  listIds: number[];
  attribs: Record<string, string>;
};

export class ListmonkClient {
  constructor(
    private readonly connection: ListmonkConnection,
    private readonly fetchImpl: typeof fetch,
  ) {}

  async templateTotal(): Promise<number | null> {
    try {
      if (!this.connection.apiUser || !this.connection.apiToken || !this.connection.baseUrl) return null;
      const response = await this.fetchImpl(`${this.connection.baseUrl}/api/templates?page=1&per_page=1`, { headers: this.headers() });
      if (!response.ok) return null;
      const body = (await response.json()) as { data?: { total?: unknown } };
      return typeof body.data?.total === "number" ? body.data.total : null;
    } catch {
      return null;
    }
  }

  async checkAuth(): Promise<{ ok: boolean; status: number }> {
    if (!this.connection.apiUser || !this.connection.apiToken || !this.connection.baseUrl) return { ok: false, status: 0 };
    const response = await this.fetchImpl(`${this.connection.baseUrl}/api/subscribers?page=1&per_page=1`, { headers: this.headers() });
    return { ok: response.ok, status: response.status };
  }

  async findSubscriber(email: string): Promise<Subscriber | null> {
    if (!this.connection.apiUser || !this.connection.apiToken) return null;
    const query = `subscribers.email = '${email.replaceAll("'", "''")}'`;
    const url = `${this.connection.baseUrl}/api/subscribers?page=1&per_page=1&query=${encodeURIComponent(query)}`;
    const response = await this.fetchImpl(url, { headers: this.headers() });
    if (!response.ok) throw new Error(`listmonk_lookup_${response.status}`);
    const body = (await response.json()) as { data?: { results?: unknown[] } };
    const row = body.data?.results?.[0];
    return row ? mapSubscriber(row) : null;
  }

  async ensureSubscriber(input: { email: string; name: string; attribs?: Record<string, string> }): Promise<Subscriber> {
    const existing = await this.findSubscriber(input.email);
    if (existing) {
      if (input.attribs) await this.writeAttribs(existing, input.email, input.name, input.attribs);
      return existing;
    }
    if (!this.connection.listId) throw new Error("listmonk_list_id_missing");
    const response = await this.fetchImpl(`${this.connection.baseUrl}/api/subscribers`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        email: input.email,
        name: input.name,
        status: "enabled",
        lists: [Number(this.connection.listId)],
        preconfirm_subscriptions: true,
        ...(input.attribs ? { attribs: input.attribs } : {}),
      }),
    });
    if (response.status === 409) {
      const again = await this.findSubscriber(input.email);
      if (again) return again;
    }
    if (!response.ok) throw new Error(`listmonk_create_${response.status}`);
    const body = (await response.json()) as { data?: unknown };
    const subscriber = body.data ? mapSubscriber(body.data) : null;
    if (!subscriber) throw new Error("listmonk_create_empty");
    return subscriber;
  }

  async upsertContact(contact: NormalizedContact): Promise<Subscriber> {
    if (!contact.email) throw new Error("listmonk_email_missing");
    const status = contact.emailOptOut ? "blocklisted" : "enabled";
    const name = contact.name || contact.email;
    const existing = await this.findSubscriber(contact.email);
    if (existing) {
      await this.writeAttribs(existing, contact.email, name, contact.attribs, status);
      return { ...existing, status, attribs: { ...existing.attribs, ...contact.attribs } };
    }
    if (!this.connection.listId) throw new Error("listmonk_list_id_missing");
    const response = await this.fetchImpl(`${this.connection.baseUrl}/api/subscribers`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        email: contact.email,
        name,
        status,
        lists: [Number(this.connection.listId)],
        preconfirm_subscriptions: true,
        attribs: contact.attribs,
      }),
    });
    if (!response.ok) throw new Error(`listmonk_create_${response.status}`);
    const body = (await response.json()) as { data?: unknown };
    const subscriber = body.data ? mapSubscriber(body.data) : null;
    if (!subscriber) throw new Error("listmonk_create_empty");
    return subscriber;
  }

  isSuppressed(subscriber: Subscriber | null): boolean {
    if (!subscriber) return false;
    if (subscriber.status === "blocklisted") return true;
    if (!this.connection.suppressedListId) return false;
    return subscriber.listIds.includes(Number(this.connection.suppressedListId));
  }

  async sendTx(input: { email: string; templateId: number; data: Record<string, unknown> }): Promise<void> {
    const payload: Record<string, unknown> = {
      subscriber_email: input.email,
      template_id: input.templateId,
      subscriber_mode: "default",
      data: input.data,
    };
    if (this.connection.fromEmail) payload.from_email = this.connection.fromEmail;
    const response = await this.fetchImpl(`${this.connection.baseUrl}/api/tx`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`listmonk_tx_${response.status}`);
  }

  private async writeAttribs(
    subscriber: Subscriber,
    email: string,
    name: string,
    attribs: Record<string, string>,
    status = subscriber.status || "enabled",
  ): Promise<void> {
    const listId = Number(this.connection.listId);
    const lists = subscriber.listIds.length > 0
      ? subscriber.listIds
      : Number.isFinite(listId) && listId > 0
        ? [listId]
        : [];
    const response = await this.fetchImpl(`${this.connection.baseUrl}/api/subscribers/${subscriber.id}`, {
      method: "PUT",
      headers: this.headers(),
      body: JSON.stringify({
        email,
        name,
        status,
        lists,
        attribs: { ...subscriber.attribs, ...attribs },
      }),
    });
    if (!response.ok) throw new Error(`listmonk_update_${response.status}`);
  }

  private headers(): Headers {
    const headers = new Headers();
    headers.set("Content-Type", "application/json");
    headers.set("Authorization", `token ${this.connection.apiUser}:${this.connection.apiToken}`);
    return headers;
  }
}

function mapSubscriber(value: unknown): Subscriber {
  const row = value as {
    id?: number;
    uuid?: string;
    email?: string;
    status?: string;
    lists?: { id?: number }[];
    attribs?: unknown;
  };
  return {
    id: row.id ?? 0,
    uuid: row.uuid ?? null,
    email: row.email ?? "",
    status: row.status ?? "",
    listIds: (row.lists ?? []).map((list) => list.id).filter((id): id is number => typeof id === "number"),
    attribs: stringAttribs(row.attribs),
  };
}

function stringAttribs(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string") out[key] = item;
    else if (typeof item === "number" || typeof item === "boolean") out[key] = String(item);
  }
  return out;
}
