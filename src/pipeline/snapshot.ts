import { MindbodyClient, type ClientSnapshot } from "@balancemoves/contacts-core";
import type { RuntimeConfig } from "../env";
import type { Repo } from "../db/repo";
import { log } from "../log";
import {
  CACHE_TTL_MS,
  MINDBODY_ALERT,
  MINDBODY_CALLER,
  MINDBODY_CAP,
  TOKEN_TTL_MS,
  applySlice,
  chunkIds,
  resourcesToFetch,
  sliceOf,
  snapshotFromEvent,
  utcMonth,
  type ResourceKind,
} from "../mindbody/budget";
import type { ParsedEvent } from "../mindbody/events";
import type { Automation } from "../automations/types";

export type SnapshotDeps = {
  fetchImpl: typeof fetch;
  snapshotClient?: (config: RuntimeConfig, clientId: string) => Promise<ClientSnapshot>;
};

export type SnapshotHost = {
  config: RuntimeConfig;
  repo: Repo;
  now: Date;
};

export async function loadClientSnapshot(input: {
  host: SnapshotHost;
  deps: SnapshotDeps;
  clientId: string;
  event: ParsedEvent | null;
  automations: Automation[];
  known?: { email?: string | null; phone?: string | null };
}): Promise<ClientSnapshot> {
  let snapshot = snapshotFromEvent(input.event);
  const wanted = resourcesToFetch(input.automations, input.event, input.known);
  if (wanted.length === 0) return snapshot;
  const budget = await readBudget(input.host);
  const nowIso = input.host.now.toISOString();
  const missing: ResourceKind[] = [];
  for (const kind of wanted) {
    const cached = await input.host.repo.getClientCache(input.clientId, kind);
    if (!cached) {
      missing.push(kind);
      continue;
    }
    const fresh = cached.expiresAt > nowIso;
    if (fresh || budget.atCap) {
      snapshot = applySlice(snapshot, kind, parseJson(cached.body));
      if (!fresh) {
        log({
          event: "mindbody_recheck_skipped",
          clientId: input.clientId,
          resource: kind,
          reason: "monthly_cap",
          cap: MINDBODY_CAP,
          calls: budget.total,
        });
      }
      continue;
    }
    missing.push(kind);
  }
  if (missing.length === 0) return snapshot;
  if (input.deps.snapshotClient) {
    const fetched = await input.deps.snapshotClient(input.host.config, input.clientId);
    for (const kind of missing) {
      snapshot = applySlice(snapshot, kind, sliceOf(fetched, kind));
      await remember(input.host, input.clientId, kind, sliceOf(fetched, kind));
    }
    return snapshot;
  }
  const api = await openMindbody(input.host, input.deps);
  for (const kind of missing) {
    const slice = await fetchKind(api, input.clientId, kind);
    snapshot = applySlice(snapshot, kind, slice);
    await remember(input.host, input.clientId, kind, slice);
  }
  await storeToken(input.host, api);
  return snapshot;
}

/** One GET /client/clients per 200 ids. Fresh cache and the monthly cap skip the call. */
export async function warmClientProfiles(host: SnapshotHost, deps: SnapshotDeps, clientIds: string[]): Promise<void> {
  const ids = [...new Set(clientIds)];
  if (ids.length === 0 || deps.snapshotClient) return;
  const budget = await readBudget(host);
  const nowIso = host.now.toISOString();
  const missing: string[] = [];
  for (const clientId of ids) {
    const cached = await host.repo.getClientCache(clientId, "profile");
    if (cached && (cached.expiresAt > nowIso || budget.atCap)) continue;
    missing.push(clientId);
  }
  if (missing.length === 0) return;
  const api = await openMindbody(host, deps);
  for (const chunk of chunkIds(missing)) {
    const rows = await api.profiles(chunk);
    for (const row of rows) await remember(host, row.clientId, "profile", row.profile);
  }
  await storeToken(host, api);
}

async function fetchKind(api: MindbodyClient, clientId: string, kind: ResourceKind): Promise<unknown> {
  if (kind === "profile") {
    const rows = await api.profiles([clientId]);
    return rows[0]?.profile ?? null;
  }
  if (kind === "services") return api.clientServices(clientId);
  if (kind === "contracts") return api.clientContracts(clientId);
  return api.clientVisits(clientId);
}

async function readBudget(host: SnapshotHost): Promise<{ total: number; atCap: boolean }> {
  const rows = await host.repo.mindbodyUsage(utcMonth(host.now));
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return { total, atCap: total >= MINDBODY_CAP };
}

async function remember(host: SnapshotHost, clientId: string, kind: ResourceKind, slice: unknown): Promise<void> {
  const fetchedAt = host.now.toISOString();
  const expiresAt = new Date(host.now.getTime() + CACHE_TTL_MS).toISOString();
  await host.repo.putClientCache(clientId, kind, JSON.stringify(slice), fetchedAt, expiresAt);
}

async function openMindbody(host: SnapshotHost, deps: SnapshotDeps): Promise<MindbodyClient> {
  const cached = await host.repo.getMindbodyToken(MINDBODY_CALLER);
  const token = cached && cached.expiresAt > host.now.toISOString() ? cached.token : null;
  const month = utcMonth(host.now);
  const counting: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("api.mindbodyonline.com")) {
      const result = await host.repo.addMindbodyCalls(MINDBODY_CALLER, month, 1, MINDBODY_ALERT);
      if (result.crossedAlert) {
        log({
          event: "mindbody_budget_alert",
          caller: MINDBODY_CALLER,
          month,
          count: result.total,
          threshold: MINDBODY_ALERT,
        });
      }
    }
    return deps.fetchImpl(input, init);
  };
  return new MindbodyClient(
    {
      apiKey: host.config.mindbodyApiKey,
      siteId: host.config.siteId,
      staffUsername: host.config.mindbodyStaffUsername,
      staffPassword: host.config.mindbodyStaffPassword,
    },
    counting,
    () => host.now,
    token,
  );
}

async function storeToken(host: SnapshotHost, api: MindbodyClient): Promise<void> {
  const token = api.issuedToken();
  if (!token) return;
  const expiresAt = new Date(host.now.getTime() + TOKEN_TTL_MS).toISOString();
  await host.repo.putMindbodyToken(MINDBODY_CALLER, token, expiresAt);
}

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return null;
  }
}
