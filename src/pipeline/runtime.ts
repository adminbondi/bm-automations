import { alertsConfigFromEnv, type AlertsConfig } from "../alerts";
import type { RuntimeConfig } from "../env";
import { bindingsFromEnv, runtimeConfig } from "../env";
import { isQuietHours, sydneyDate, sydneyDateFromInstant } from "../time";
import { ListmonkClient, normalizePhone, type ClientSnapshot } from "@balancemoves/contacts-core";
import { d1Database, Repo, type ClientRow } from "../db/repo";
import { TwilioClient } from "../twilio/client";
import type { ParsedEvent } from "../mindbody/events";
import type { JobPayload, ServiceRecord } from "../automations/types";
import { resolveConnections, type Connections } from "../settings/service";
import type { PlanFacts } from "./plan";

export type AppDeps = {
  now: () => Date;
  fetchImpl: typeof fetch;
  snapshotClient?: (config: RuntimeConfig, clientId: string) => Promise<ClientSnapshot>;
  /** Test hook: replace wall-clock sleeps (Listmonk subscriber retry). */
  sleep?: (ms: number) => Promise<void>;
};

export type Loaded = {
  config: RuntimeConfig;
  connections: Connections;
  repo: Repo;
  listmonk: ListmonkClient;
  twilio: TwilioClient;
  withinQuietHours: boolean;
  now: Date;
  alerts: AlertsConfig | null;
};

export async function loadRuntime(env: Env, deps: AppDeps): Promise<Loaded> {
  const repo = new Repo(d1Database(env.DB), () => deps.now().toISOString());
  const config = runtimeConfig(bindingsFromEnv(env));
  const connections = await resolveConnections(repo, config);
  const listmonk = new ListmonkClient(
    {
      baseUrl: connections.listmonkBaseUrl,
      apiUser: connections.listmonkApiUser,
      apiToken: connections.listmonkApiToken,
      listId: connections.listmonkListId,
      suppressedListId: connections.listmonkSuppressedListId,
      fromEmail: connections.defaultFromEmail,
      fromName: connections.defaultFromName,
    },
    deps.fetchImpl,
  );
  const twilio = new TwilioClient(
    {
      accountSid: connections.twilioAccountSid,
      authToken: connections.twilioAuthToken,
      fromNumber: connections.twilioFromNumber,
      senderName: connections.twilioSenderName,
      fromMode: connections.twilioFromMode,
    },
    deps.fetchImpl,
  );
  const now = deps.now();
  return {
    config,
    connections,
    repo,
    listmonk,
    twilio,
    withinQuietHours: isQuietHours(now, connections.quietStart, connections.quietEnd),
    now,
    alerts: alertsConfigFromEnv(env, deps.fetchImpl),
  };
}

export async function rememberClient(
  repo: Repo,
  clientId: string,
  snapshot: ClientSnapshot,
  event: ParsedEvent | null,
  now: Date,
  persist = true,
): Promise<ClientRow> {
  const existing = await repo.getClient(clientId);
  const email = lower(event?.email) ?? lower(snapshot.profile.email) ?? lower(existing?.email);
  const phone = normalizePhone(event?.phone) ?? normalizePhone(snapshot.profile.phone) ?? normalizePhone(existing?.phone);
  const firstName = event?.firstName ?? snapshot.profile.firstName ?? existing?.firstName ?? null;
  const lastName = event?.lastName ?? snapshot.profile.lastName ?? existing?.lastName ?? null;
  const createdAt = snapshot.profile.createdAt ?? event?.createdAt ?? existing?.createdAt ?? now.toISOString();
  if (persist) await repo.upsertClient({ clientId, email, phone, firstName, lastName, createdAt });
  return { clientId, email, phone, firstName, lastName, createdAt };
}

export async function factsFromClient(input: {
  loaded: Loaded;
  client: ClientRow;
  snapshot: ClientSnapshot;
  event: ParsedEvent | null;
  payload: JobPayload;
  dueOn: string | null;
  visitCrossingRecorded: boolean;
  windowAlreadyMatched: boolean;
  dryRun: boolean;
}): Promise<PlanFacts> {
  const { loaded, client, snapshot, event, payload } = input;
  const email = client.email;
  // Hard legal/manual blocks only (D1). Listmonk blocklisted / suppressed-list is marketing
  // opt-out from sync (SendPromotionalEmails=false) — Moments are transactional and still send
  // after enableForTransactional in apply/replay.
  let suppressed = false;
  if (email) {
    suppressed = await loaded.repo.isSuppressed(email);
  }
  const packages = unique([
    ...(event?.packageNames ?? []),
    ...(payload.packageNames ?? []),
    ...snapshot.services.map((service) => service.name),
  ]);
  const anchorSource = !event || event.eventId === "client.created"
    ? client.createdAt
    : event.occurredAt ?? event.createdAt ?? loaded.now.toISOString();
  return {
    eventId: event?.eventId ?? "cron",
    todaySydney: sydneyDate(loaded.now),
    anchorSydney: sydneyDateFromInstant(anchorSource, loaded.now),
    dueOn: input.dueOn,
    signedInStatus: event?.signedInStatus ?? payload.signedInStatus ?? null,
    triggeringContractName: event?.contractName ?? payload.contractName ?? null,
    candidatePackageNames: packages,
    waiverSigned: Boolean(event?.waiverSigned || snapshot.profile.waiverSigned),
    suppressed,
    services: snapshot.services,
    visits: snapshot.visits,
    serviceCount: snapshot.services.length,
    contracts: snapshot.contracts,
    visitCrossingRecorded: input.visitCrossingRecorded,
    windowAlreadyMatched: input.windowAlreadyMatched,
    clientId: client.clientId,
    email,
    phone: client.phone,
    firstName: client.firstName,
    lastName: client.lastName,
    studioName: loaded.config.studioName,
    devMode: loaded.config.devMode,
    dryRun: input.dryRun,
    emailAllowlist: loaded.config.emailAllowlist,
    phoneAllowlist: loaded.config.phoneAllowlist,
    alreadySentKeys: await loaded.repo.sentKeys(client.clientId),
    listmonkBaseUrl: loaded.connections.listmonkBaseUrl,
    withinQuietHours: loaded.withinQuietHours,
    quietAction: loaded.connections.quietAction,
    birthDate: snapshot.profile.birthDate ?? null,
  };
}

export function eventPayload(event: ParsedEvent): JobPayload {
  return {
    signedInStatus: event.signedInStatus,
    packageNames: event.packageNames,
    contractName: event.contractName,
  };
}

function lower(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

export type { ServiceRecord };
