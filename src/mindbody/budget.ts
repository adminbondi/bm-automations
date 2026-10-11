import type { ClientProfile, ClientSnapshot, MindbodyContract, MindbodyService, MindbodyVisit } from "@balancemoves/contacts-core";
import type { Automation } from "../automations/types";
import type { ParsedEvent } from "./events";

/** This worker's name in the shared monthly counter. */
export const MINDBODY_CALLER = "bm-automations";
export const MINDBODY_ALERT = 4_000;
export const MINDBODY_CAP = 5_000;
/** Fetched services, contracts, visits, and profiles are reused until this age. */
export const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
/** One staff token is reused until this age, then issued again. */
export const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
export const CLIENT_BATCH = 200;
/** Webhook volume measured for this studio. */
export const MEASURED_EVENTS_PER_DAY = 440;

export type ResourceKind = "profile" | "services" | "contracts" | "visits";

/**
 * Calls per month at a steady event rate.
 * Before this change a typical event was about 5 calls (token, profile, services, contracts, one visit page):
 * 440 × 5 × 30 = 66,000. With every automation off, a typical event is now 0.
 */
export function monthlyCalls(eventsPerDay: number, callsPerEvent: number, days = 30): number {
  return eventsPerDay * callsPerEvent * days;
}

export function utcMonth(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}`;
}

export function chunkIds(ids: string[], size = CLIENT_BATCH): string[][] {
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += size) chunks.push(ids.slice(index, index + size));
  return chunks;
}

export function automationNeeds(automation: Automation): ResourceKind[] {
  const needs = new Set<ResourceKind>();
  const filters = automation.filters;
  const rules = automation.skipRules;
  const needsRemaining = filters.exactRemaining != null || filters.minRemaining != null || filters.maxRemaining != null;
  const needsExpiry = automation.timingKind === "days_before_expiry" || automation.timingKind === "days_after_expiry" || Boolean(rules.skipIfPassExpired);
  const needsPurchase = Boolean(rules.skipIfHasAnyPurchase || rules.skipIfHasIntroOrAnyPurchase);
  if (needsRemaining || needsExpiry || needsPurchase || filters.clientActivity) needs.add("services");
  if (filters.clientActivity || rules.skipIfMembership || needsPurchase) needs.add("contracts");
  if (
    automation.timingKind === "days_since_last_visit" ||
    rules.skipIfHasVisited ||
    rules.skipIfHasBooking ||
    rules.minVisits != null ||
    rules.exactVisits != null ||
    rules.maxVisits != null ||
    rules.everyNthVisit != null ||
    rules.visitWindowDays != null ||
    rules.includeVisitsInData ||
    rules.dedupeScope === "visit_milestone"
  ) {
    needs.add("visits");
  }
  if (automation.timingKind === "birthday_day" || automation.timingKind === "birthday_month_start" || rules.skipIfWaiverSigned) {
    needs.add("profile");
  }
  return [...needs];
}

/** True when the webhook body already answers this rule, so a Mindbody call would be a re-check. */
export function payloadCovers(automation: Automation, event: ParsedEvent | null, kind: ResourceKind): boolean {
  if (!event) return false;
  if (kind === "profile") {
    if (automation.timingKind === "birthday_day" || automation.timingKind === "birthday_month_start") return Boolean(event.birthDate);
    if (automation.skipRules.skipIfWaiverSigned) return event.waiverKnown;
    return event.profileInPayload;
  }
  if (kind === "services") return servicesCovered(automation, event);
  if (kind === "contracts") return contractsCovered(automation, event);
  return visitsCovered(automation, event);
}

export function resourcesToFetch(
  automations: Automation[],
  event: ParsedEvent | null,
  known?: { email?: string | null; phone?: string | null },
): ResourceKind[] {
  const kinds = new Set<ResourceKind>();
  const email = event?.email ?? known?.email ?? null;
  const phone = event?.phone ?? known?.phone ?? null;
  const profileIsSource = event?.profileInPayload === true;
  for (const automation of automations) {
    if (!automation.enabled) continue;
    if (event && !automation.triggerEvents.includes(event.eventId) && !automation.scheduleOnEvents.includes(event.eventId)) continue;
    for (const kind of automationNeeds(automation)) {
      if (!payloadCovers(automation, event, kind)) kinds.add(kind);
    }
    if (automation.channel === "email" && !email && !profileIsSource) kinds.add("profile");
    if (automation.channel === "sms" && !phone && !profileIsSource) kinds.add("profile");
  }
  return [...kinds];
}

export function snapshotFromEvent(event: ParsedEvent | null): ClientSnapshot {
  const profile: ClientProfile = {
    email: event?.email ?? null,
    phone: event?.phone ?? null,
    firstName: event?.firstName ?? null,
    lastName: event?.lastName ?? null,
    createdAt: event?.createdAt ?? null,
    waiverSigned: event?.waiverSigned ?? false,
    birthDate: event?.birthDate ?? null,
    referredBy: event?.referredBy ?? null,
    emailOptOut: event?.emailOptOut ?? undefined,
    smsOptOut: event?.smsOptOut ?? undefined,
  };
  const services: MindbodyService[] = [];
  if (event && (event.packageNames.length > 0 || event.creditsRemaining !== null || event.passExpiration)) {
    services.push({
      name: event.packageNames[0] ?? "",
      expirationSydney: event.passExpiration,
      current: true,
      remaining: event.creditsRemaining,
    });
  }
  const contracts: MindbodyContract[] = event?.contractName ? [{ name: event.contractName }] : [];
  return { profile, services, contracts, visits: visitsFromEvent(event) };
}

export function applySlice(base: ClientSnapshot, kind: ResourceKind, raw: unknown): ClientSnapshot {
  if (kind === "profile" && raw && typeof raw === "object") return overlayProfile(base, raw as ClientProfile);
  if (kind === "services" && Array.isArray(raw)) return { ...base, services: raw as MindbodyService[] };
  if (kind === "contracts" && Array.isArray(raw)) return { ...base, contracts: raw as MindbodyContract[] };
  if (kind === "visits" && Array.isArray(raw)) return { ...base, visits: raw as MindbodyVisit[] };
  return base;
}

export function sliceOf(snapshot: ClientSnapshot, kind: ResourceKind): unknown {
  if (kind === "profile") return snapshot.profile;
  if (kind === "services") return snapshot.services;
  if (kind === "contracts") return snapshot.contracts;
  return snapshot.visits;
}

function servicesCovered(automation: Automation, event: ParsedEvent): boolean {
  const needsRemaining = automation.filters.exactRemaining != null || automation.filters.minRemaining != null || automation.filters.maxRemaining != null;
  const needsExpiry = automation.timingKind === "days_before_expiry" || automation.timingKind === "days_after_expiry" || Boolean(automation.skipRules.skipIfPassExpired);
  const needsPurchase = Boolean(automation.skipRules.skipIfHasAnyPurchase || automation.skipRules.skipIfHasIntroOrAnyPurchase || automation.filters.clientActivity);
  if (needsRemaining && event.creditsRemaining === null) return false;
  if (needsExpiry && !event.passExpiration) return false;
  if (needsPurchase && event.packageNames.length === 0 && event.creditsRemaining === null && !event.passExpiration && !event.contractName) return false;
  return needsRemaining || needsExpiry || needsPurchase;
}

function contractsCovered(automation: Automation, event: ParsedEvent): boolean {
  if (automation.skipRules.skipIfMembership || automation.filters.clientActivity) return false;
  const needsPurchase = Boolean(automation.skipRules.skipIfHasAnyPurchase || automation.skipRules.skipIfHasIntroOrAnyPurchase);
  if (needsPurchase) return event.packageNames.length > 0 || Boolean(event.contractName) || event.creditsRemaining !== null;
  return Boolean(event.contractName);
}

function visitsCovered(automation: Automation, event: ParsedEvent): boolean {
  if (event.visitCount === null) return false;
  if ((automation.skipRules.visitCountScope ?? "all") !== "all") return false;
  if (automation.skipRules.visitWindowDays != null) return false;
  if ((automation.filters.visitCountMode ?? "signed_in") === "booked") return false;
  return true;
}

function visitsFromEvent(event: ParsedEvent | null): MindbodyVisit[] {
  if (!event || event.visitCount === null || event.visitCount <= 0) return [];
  const count = Math.min(Math.floor(event.visitCount), 500);
  const serviceName = event.packageNames[0] ?? "";
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    signedIn: true,
    lateCancelled: false,
    earlyCancelled: false,
    serviceName,
    startSydney: index === count - 1 ? event.visitStart : null,
  }));
}

function overlayProfile(base: ClientSnapshot, incoming: ClientProfile): ClientSnapshot {
  return {
    ...base,
    profile: {
      email: base.profile.email ?? incoming.email,
      phone: base.profile.phone ?? incoming.phone,
      firstName: base.profile.firstName ?? incoming.firstName,
      lastName: base.profile.lastName ?? incoming.lastName,
      createdAt: base.profile.createdAt ?? incoming.createdAt,
      waiverSigned: base.profile.waiverSigned || incoming.waiverSigned,
      birthDate: base.profile.birthDate ?? incoming.birthDate ?? null,
      referredBy: base.profile.referredBy ?? incoming.referredBy ?? null,
      emailOptOut: base.profile.emailOptOut ?? incoming.emailOptOut,
      smsOptOut: base.profile.smsOptOut ?? incoming.smsOptOut,
    },
  };
}
