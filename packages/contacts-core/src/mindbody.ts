import { mapClient } from "./contact";
import { addDays, sydneyDate, toIsoDate } from "./dates";

const API = "https://api.mindbodyonline.com/public/v6";
const VISIT_PAGE = 200;
const VISIT_CAP = 500;

export type MindbodyAuth = {
  apiKey: string;
  siteId: string;
  staffUsername: string;
  staffPassword: string;
};

export type ClientProfile = {
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  createdAt: string | null;
  waiverSigned: boolean;
  birthDate?: string | null;
  referredBy?: string | null;
  emailOptOut?: boolean;
  smsOptOut?: boolean;
};

export type MindbodyService = {
  name: string;
  expirationSydney: string | null;
  current: boolean;
  remaining?: number | null;
};

export type MindbodyContract = { name: string };

export type MindbodyVisit = {
  id: number;
  signedIn: boolean;
  lateCancelled: boolean;
  earlyCancelled: boolean;
  serviceName: string;
  startSydney?: string | null;
};

export type ClientSnapshot = {
  profile: ClientProfile;
  services: MindbodyService[];
  contracts: MindbodyContract[];
  visits: MindbodyVisit[];
};

export const CLIENT_ID_BATCH = 200;

export type ClientSearchHit = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
};

export class MindbodyClient {
  private token: string | null = null;
  private fromCache: boolean;
  private issued = false;

  constructor(
    private readonly auth: MindbodyAuth,
    private readonly fetchImpl: typeof fetch,
    private readonly now: () => Date = () => new Date(),
    cachedToken: string | null = null,
  ) {
    this.token = cachedToken;
    this.fromCache = Boolean(cachedToken);
  }

  /** A token issued during this instance, ready to store. A reused cache token returns null. */
  issuedToken(): string | null {
    return this.issued ? this.token : null;
  }

  async snapshot(clientId: string): Promise<ClientSnapshot> {
    const token = await this.staffToken();
    const [profile, services, contracts, visits] = await Promise.all([
      this.profile(clientId, token),
      this.services(clientId, token),
      this.contracts(clientId, token),
      this.visits(clientId, token),
    ]);
    return { profile, services, contracts, visits };
  }

  async contact(clientId: string) {
    const token = await this.staffToken();
    const body = await this.get(`/client/clients?request.clientIDs=${encodeURIComponent(clientId)}`, token);
    const clients = Array.isArray(body.Clients) ? body.Clients : [];
    return mapClient((clients[0] ?? {}) as Record<string, unknown>);
  }

  /** One GET /client/clients for up to 200 ids. */
  async profiles(clientIds: string[]): Promise<{ clientId: string; profile: ClientProfile }[]> {
    const ids = clientIds.slice(0, CLIENT_ID_BATCH);
    if (ids.length === 0) return [];
    const token = await this.staffToken();
    const query = ids.map((id) => encodeURIComponent(id)).join(",");
    const body = await this.get(`/client/clients?request.clientIDs=${query}`, token);
    const clients = Array.isArray(body.Clients) ? body.Clients : [];
    const rows: { clientId: string; profile: ClientProfile }[] = [];
    for (const row of clients) {
      const client = row as Record<string, unknown>;
      const clientId = clientIdOf(client);
      if (!clientId) continue;
      rows.push({ clientId, profile: profileFrom(client) });
    }
    return rows;
  }

  async clientServices(clientId: string): Promise<MindbodyService[]> {
    return this.services(clientId, await this.staffToken());
  }

  async clientContracts(clientId: string): Promise<MindbodyContract[]> {
    return this.contracts(clientId, await this.staffToken());
  }

  async clientVisits(clientId: string): Promise<MindbodyVisit[]> {
    return this.visits(clientId, await this.staffToken());
  }

  async searchClients(query: string): Promise<ClientSearchHit[]> {
    const text = query.trim();
    if (text.length < 2) return [];
    const token = await this.staffToken();
    const body = await this.get(
      `/client/clients?request.searchText=${encodeURIComponent(text)}&request.limit=15`,
      token,
    );
    const clients = Array.isArray(body.Clients) ? body.Clients : [];
    const hits: ClientSearchHit[] = [];
    for (const row of clients) {
      const client = row as Record<string, unknown>;
      const id = client.Id ?? client.ClientID;
      if (id == null || String(id).trim() === "") continue;
      const contact = mapClient(client);
      hits.push({
        id: String(id),
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        phone: contact.phone,
      });
      if (hits.length >= 15) break;
    }
    return hits;
  }

  private async staffToken(): Promise<string> {
    if (this.token) return this.token;
    if (!this.auth.apiKey || !this.auth.staffUsername || !this.auth.staffPassword) {
      throw new Error("mindbody_staff_credentials_missing");
    }
    const response = await this.fetchImpl(`${API}/usertoken/issue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": this.auth.apiKey,
        SiteId: this.auth.siteId,
      },
      body: JSON.stringify({ Username: this.auth.staffUsername, Password: this.auth.staffPassword }),
    });
    if (!response.ok) throw new Error(`mindbody_token_${response.status}`);
    const body = (await response.json()) as { AccessToken?: string; Token?: string };
    const token = body.AccessToken ?? body.Token;
    if (!token) throw new Error("mindbody_token_missing");
    this.token = token;
    this.issued = true;
    this.fromCache = false;
    return token;
  }

  private async get(path: string, token: string): Promise<Record<string, unknown>> {
    const response = await this.request(path, token);
    if (!response.ok && response.status === 401 && this.fromCache) {
      this.fromCache = false;
      this.token = null;
      const next = await this.staffToken();
      const retry = await this.request(path, next);
      if (!retry.ok) throw new Error(`mindbody_${retry.status}`);
      return (await retry.json()) as Record<string, unknown>;
    }
    if (!response.ok) throw new Error(`mindbody_${response.status}`);
    return (await response.json()) as Record<string, unknown>;
  }

  private request(path: string, token: string): Promise<Response> {
    return this.fetchImpl(`${API}${path}`, {
      headers: {
        "Api-Key": this.auth.apiKey,
        SiteId: this.auth.siteId,
        Authorization: token,
      },
    });
  }

  private async profile(clientId: string, token: string): Promise<ClientProfile> {
    const body = await this.get(`/client/clients?request.clientIDs=${encodeURIComponent(clientId)}`, token);
    const clients = Array.isArray(body.Clients) ? body.Clients : [];
    return profileFrom((clients[0] ?? {}) as Record<string, unknown>);
  }

  private async services(clientId: string, token: string): Promise<MindbodyService[]> {
    const body = await this.get(`/client/clientservices?request.clientId=${encodeURIComponent(clientId)}&request.limit=200`, token);
    const rows = Array.isArray(body.ClientServices) ? body.ClientServices : [];
    return rows.map((row) => {
      const service = row as Record<string, unknown>;
      return {
        name: text(service.Name) ?? "",
        expirationSydney: toIsoDate(text(service.ExpirationDate)),
        current: service.Current !== false,
        remaining: typeof service.Remaining === "number" ? service.Remaining : null,
      };
    });
  }

  private async contracts(clientId: string, token: string): Promise<MindbodyContract[]> {
    const body = await this.get(`/client/clientcontracts?request.clientId=${encodeURIComponent(clientId)}`, token);
    const rows = Array.isArray(body.Contracts) ? body.Contracts : [];
    return rows.map((row) => ({ name: text((row as Record<string, unknown>).ContractName) ?? "" }));
  }

  private async visits(clientId: string, token: string): Promise<MindbodyVisit[]> {
    const visits: MindbodyVisit[] = [];
    let offset = 0;
    const today = sydneyDate(this.now());
    const start = addDays(today, -400);
    const end = addDays(today, 400);
    while (offset < VISIT_CAP) {
      const body = await this.get(
        `/client/clientvisits?request.clientId=${encodeURIComponent(clientId)}&request.limit=${VISIT_PAGE}&request.offset=${offset}&request.startDate=${start}&request.endDate=${end}`,
        token,
      );
      const rows = Array.isArray(body.Visits) ? body.Visits : [];
      for (const row of rows) {
        const visit = row as Record<string, unknown>;
        const status = text(visit.AppointmentStatus) ?? text(visit.Status);
        visits.push({
          id: typeof visit.Id === "number" ? visit.Id : visits.length + 1,
          signedIn: visit.SignedIn === true,
          lateCancelled: visit.LateCancelled === true || status === "LateCancelled" || status === "LateCancel",
          earlyCancelled: visit.EarlyCancelled === true || status === "EarlyCancelled" || status === "EarlyCancel",
          serviceName: text(visit.ServiceName) ?? text(visit.Name) ?? "",
          startSydney: toIsoDate(text(visit.StartDateTime) ?? text(visit.ClassDate)),
        });
      }
      const total = typeof (body.PaginationResponse as { TotalResults?: number } | undefined)?.TotalResults === "number"
        ? (body.PaginationResponse as { TotalResults: number }).TotalResults
        : null;
      offset += rows.length;
      if (rows.length < VISIT_PAGE || (total !== null && offset >= total)) break;
    }
    return visits;
  }
}

function profileFrom(client: Record<string, unknown>): ClientProfile {
  const contact = mapClient(client);
  const liability = client.Liability as { IsReleased?: boolean } | undefined;
  return {
    email: contact.email,
    phone: contact.phone,
    firstName: contact.firstName,
    lastName: contact.lastName,
    createdAt: text(client.CreationDate),
    waiverSigned: client.LiabilityRelease === true || client.IsLiabilityReleased === true || liability?.IsReleased === true,
    birthDate: toIsoDate(text(client.BirthDate)),
    referredBy: text(client.ReferredBy),
    emailOptOut: contact.emailOptOut,
    smsOptOut: contact.smsOptOut,
  };
}

function clientIdOf(client: Record<string, unknown>): string {
  if (typeof client.Id === "number" && Number.isFinite(client.Id)) return String(client.Id);
  return text(client.Id) ?? "";
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}
