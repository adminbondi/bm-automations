import type { RuntimeConfig } from "../env";
import { addDays, sydneyDate } from "../time";
import type { ContractRecord, ServiceRecord, Visit } from "../automations/types";

const API = "https://api.mindbodyonline.com/public/v6";
const VISIT_PAGE = 200;
const VISIT_CAP = 500;

export type ClientProfile = {
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  createdAt: string | null;
  waiverSigned: boolean;
};

export type ClientSnapshot = {
  profile: ClientProfile;
  services: ServiceRecord[];
  contracts: ContractRecord[];
  visits: Visit[];
};

export class MindbodyClient {
  private token: string | null = null;

  constructor(
    private readonly config: RuntimeConfig,
    private readonly fetchImpl: typeof fetch,
    private readonly now: () => Date = () => new Date(),
  ) {}

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

  private async staffToken(): Promise<string> {
    if (this.token) return this.token;
    if (!this.config.mindbodyApiKey || !this.config.mindbodyStaffUsername || !this.config.mindbodyStaffPassword) {
      throw new Error("mindbody_staff_credentials_missing");
    }
    const response = await this.fetchImpl(`${API}/usertoken/issue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": this.config.mindbodyApiKey,
        SiteId: this.config.siteId,
      },
      body: JSON.stringify({
        Username: this.config.mindbodyStaffUsername,
        Password: this.config.mindbodyStaffPassword,
      }),
    });
    if (!response.ok) throw new Error(`mindbody_token_${response.status}`);
    const body = (await response.json()) as { AccessToken?: string; Token?: string };
    const token = body.AccessToken ?? body.Token;
    if (!token) throw new Error("mindbody_token_missing");
    this.token = token;
    return token;
  }

  private async get(path: string, token: string): Promise<Record<string, unknown>> {
    const response = await this.fetchImpl(`${API}${path}`, {
      headers: {
        "Api-Key": this.config.mindbodyApiKey,
        SiteId: this.config.siteId,
        Authorization: token,
      },
    });
    if (!response.ok) throw new Error(`mindbody_${response.status}`);
    return (await response.json()) as Record<string, unknown>;
  }

  private async profile(clientId: string, token: string): Promise<ClientProfile> {
    const body = await this.get(`/client/clients?request.clientIDs=${encodeURIComponent(clientId)}`, token);
    const clients = Array.isArray(body.Clients) ? body.Clients : [];
    const client = (clients[0] ?? {}) as Record<string, unknown>;
    const liability = client.Liability as { IsReleased?: boolean } | undefined;
    return {
      email: stringOrNull(client.Email),
      phone: stringOrNull(client.MobilePhone) ?? stringOrNull(client.HomePhone) ?? stringOrNull(client.WorkPhone),
      firstName: stringOrNull(client.FirstName),
      lastName: stringOrNull(client.LastName),
      createdAt: stringOrNull(client.CreationDate),
      waiverSigned: client.LiabilityRelease === true || client.IsLiabilityReleased === true || liability?.IsReleased === true,
    };
  }

  private async services(clientId: string, token: string): Promise<ServiceRecord[]> {
    const body = await this.get(
      `/client/clientservices?request.clientId=${encodeURIComponent(clientId)}&request.limit=200`,
      token,
    );
    const rows = Array.isArray(body.ClientServices) ? body.ClientServices : [];
    return rows.map((row) => {
      const service = row as Record<string, unknown>;
      return {
        name: stringOrNull(service.Name) ?? "",
        expirationSydney: toSydneyDate(stringOrNull(service.ExpirationDate)),
        current: service.Current !== false,
      };
    });
  }

  private async contracts(clientId: string, token: string): Promise<ContractRecord[]> {
    const body = await this.get(`/client/clientcontracts?request.clientId=${encodeURIComponent(clientId)}`, token);
    const rows = Array.isArray(body.Contracts) ? body.Contracts : [];
    return rows.map((row) => ({ name: stringOrNull((row as Record<string, unknown>).ContractName) ?? "" }));
  }

  private async visits(clientId: string, token: string): Promise<Visit[]> {
    const visits: Visit[] = [];
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
        const status = stringOrNull(visit.AppointmentStatus) ?? stringOrNull(visit.Status);
        visits.push({
          id: typeof visit.Id === "number" ? visit.Id : visits.length + 1,
          signedIn: visit.SignedIn === true,
          lateCancelled: visit.LateCancelled === true || status === "LateCancelled" || status === "LateCancel",
          earlyCancelled: visit.EarlyCancelled === true || status === "EarlyCancelled" || status === "EarlyCancel",
          serviceName: stringOrNull(visit.ServiceName) ?? stringOrNull(visit.Name) ?? "",
        });
      }
      const total = numberOrNull((body.PaginationResponse as { TotalResults?: number } | undefined)?.TotalResults);
      offset += rows.length;
      if (rows.length < VISIT_PAGE || (total !== null && offset >= total)) break;
    }
    return visits;
  }
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function toSydneyDate(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return sydneyDate(parsed);
}
