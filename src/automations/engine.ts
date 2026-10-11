import { contractMatches, nameMatchesTokens } from "../names";
import { addDays, daysUntil } from "../time";
import type { Automation, Channel, ServiceRecord, Visit } from "./types";

export type Phase = "trigger" | "schedule" | "cron";

export type EvalContext = {
  phase: Phase;
  eventId: string;
  todaySydney: string;
  anchorSydney: string;
  dueOn: string | null;
  signedInStatus: string | null;
  triggeringContractName: string | null;
  candidatePackageNames: string[];
  waiverSigned: boolean;
  suppressed: boolean;
  passExpirationSydney: string | null;
  visits: Visit[];
  serviceCount: number;
  contracts: { name: string }[];
  visitCrossingRecorded: boolean;
  windowAlreadyMatched: boolean;
};

export type Decision = {
  action: "send" | "skip" | "schedule" | "keep_pending";
  reason: string;
  channel: Channel;
  templateId: number | null;
  messageText: string | null;
  warnings: string[];
  data: Record<string, unknown>;
  dueOn?: string;
};

const DEFAULT_CLASS_PASS_TOKENS = ["classpass", "class pass"];

export function countVisits(visits: Visit[], automation: Automation): number {
  const mode = automation.filters.visitCountMode ?? "signed_in";
  const scope = automation.skipRules.visitCountScope ?? "all";
  const includeClassPass = automation.filters.includeClassPassVisits ?? true;
  const classPassTokens = automation.filters.classPassNameIncludes ?? DEFAULT_CLASS_PASS_TOKENS;
  const packageTokens = automation.filters.packageNameIncludes ?? [];
  return visits.filter((visit) => {
    if (visit.lateCancelled || visit.earlyCancelled) return false;
    if (mode === "signed_in" && !visit.signedIn) return false;
    if (!includeClassPass && nameMatchesTokens(visit.serviceName, classPassTokens)) return false;
    if ((scope === "intro_pass" || scope === "matching_package") && !nameMatchesTokens(visit.serviceName, packageTokens)) {
      return false;
    }
    return true;
  }).length;
}

export function selectPassExpiry(services: ServiceRecord[], tokens: string[]): string | null {
  const matching = services.filter(
    (service) => tokens.length > 0 && nameMatchesTokens(service.name, tokens) && service.expirationSydney,
  );
  if (matching.length === 0) return null;
  const current = matching.filter((service) => service.current);
  const pool = current.length > 0 ? current : matching;
  return pool.map((service) => service.expirationSydney).filter((value): value is string => Boolean(value)).sort()[0] ?? null;
}

export function hasMembership(contracts: { name: string }[], names: string[]): boolean {
  return contracts.some((contract) => contractMatches(contract.name, names));
}

function warningsFor(automation: Automation, ctx: EvalContext): string[] {
  if (!automation.skipRules.skipIfMembership) return [];
  const names = automation.skipRules.membershipContractNames ?? [];
  if (names.length === 0 && ctx.contracts.length > 0) return ["membership_contract_names_empty"];
  return [];
}

function withData(automation: Automation, visits: number | null): Record<string, unknown> {
  if (!automation.skipRules.includeVisitsInData || visits === null) return {};
  return { visits };
}

function decide(
  automation: Automation,
  action: Decision["action"],
  reason: string,
  warnings: string[],
  data: Record<string, unknown>,
  dueOn?: string,
): Decision {
  return {
    action,
    reason,
    channel: automation.channel,
    templateId: automation.templateId,
    messageText: automation.messageText,
    warnings,
    data,
    ...(dueOn ? { dueOn } : {}),
  };
}

function filtersPass(automation: Automation, ctx: EvalContext): { ok: true } | { ok: false; reason: string } {
  const filters = automation.filters;
  if (filters.signedInStatus && ctx.signedInStatus !== filters.signedInStatus) {
    return { ok: false, reason: "signed_in_status_mismatch" };
  }
  if (filters.contractNames && !contractMatches(ctx.triggeringContractName ?? "", filters.contractNames)) {
    return { ok: false, reason: "contract_not_on_list" };
  }
  if (filters.packageNameIncludes) {
    const matched = ctx.candidatePackageNames.some((name) => nameMatchesTokens(name, filters.packageNameIncludes ?? []));
    if (!matched) return { ok: false, reason: "package_filter_miss" };
  }
  return { ok: true };
}

function applySkipRules(automation: Automation, ctx: EvalContext): Decision {
  const rules = automation.skipRules;
  const warnings = warningsFor(automation, ctx);
  const visits = countVisits(ctx.visits, automation);
  const data = withData(automation, visits);
  const purchased = ctx.serviceCount > 0 || ctx.contracts.length > 0;

  if (rules.skipIfWaiverSigned && ctx.waiverSigned) return decide(automation, "skip", "waiver_signed", warnings, data);
  if (rules.skipIfHasVisited && visits > 0) return decide(automation, "skip", "has_visited", warnings, data);
  if (rules.skipIfHasBooking) {
    const booked = countVisits(ctx.visits, {
      ...automation,
      filters: { ...automation.filters, visitCountMode: "booked" },
    });
    if (booked > 0) return decide(automation, "skip", "has_booking", warnings, data);
  }
  if (rules.skipIfHasAnyPurchase && purchased) return decide(automation, "skip", "has_purchase", warnings, data);
  if (rules.skipIfHasIntroOrAnyPurchase && purchased) {
    return decide(automation, "skip", "has_intro_or_purchase", warnings, data);
  }
  if (rules.skipIfUnsubscribed && ctx.suppressed) return decide(automation, "skip", "unsubscribed", warnings, data);
  if (rules.skipIfMembership && hasMembership(ctx.contracts, rules.membershipContractNames ?? [])) {
    return decide(automation, "skip", "has_membership", warnings, data);
  }
  if (rules.minVisits != null && visits < rules.minVisits) {
    return decide(automation, "skip", "visits_below_min", warnings, data);
  }
  if (rules.exactVisits != null) {
    const matched = ctx.visitCrossingRecorded ? visits >= rules.exactVisits : visits === rules.exactVisits;
    if (!matched) {
      const stillShort = automation.timingKind === "immediate" && !ctx.visitCrossingRecorded && visits < rules.exactVisits;
      if (stillShort) return decide(automation, "keep_pending", "visits_not_yet", warnings, data);
      return decide(automation, "skip", "visits_not_exact", warnings, data);
    }
  }
  if (rules.skipIfPassExpired && ctx.passExpirationSydney && daysUntil(ctx.todaySydney, ctx.passExpirationSydney) < 0) {
    return decide(automation, "skip", "pass_expired", warnings, data);
  }
  return decide(automation, "send", "send", warnings, data);
}

function scheduleDecision(automation: Automation, ctx: EvalContext, warnings: string[]): Decision {
  if (automation.timingKind === "delay_days") {
    return decide(automation, "schedule", "scheduled", warnings, {}, addDays(ctx.anchorSydney, automation.timingOffsetDays ?? 0));
  }
  if (automation.timingKind === "days_before_expiry" || automation.timingKind === "days_after_expiry") {
    return decide(automation, "schedule", "scheduled", warnings, {}, ctx.anchorSydney);
  }
  return decide(automation, "skip", "timing_not_schedulable", warnings, {});
}

export function evaluateAutomation(automation: Automation, ctx: EvalContext): Decision {
  const warnings = warningsFor(automation, ctx);
  if (ctx.phase === "schedule") {
    if (!automation.scheduleOnEvents.includes(ctx.eventId)) {
      return decide(automation, "skip", "not_this_schedule_event", warnings, {});
    }
    const filters = filtersPass(automation, ctx);
    if (!filters.ok) return decide(automation, "skip", filters.reason, warnings, {});
    return scheduleDecision(automation, ctx, warnings);
  }

  if (ctx.phase === "trigger") {
    if (!automation.triggerEvents.includes(ctx.eventId) || automation.timingKind !== "immediate") {
      return decide(automation, "skip", "not_this_trigger", warnings, {});
    }
    const filters = filtersPass(automation, ctx);
    if (!filters.ok) return decide(automation, "skip", filters.reason, warnings, {});
    return applySkipRules(automation, ctx);
  }

  if (automation.timingKind === "delay_days" && ctx.dueOn && ctx.todaySydney < ctx.dueOn) {
    return decide(automation, "keep_pending", "not_due", warnings, {});
  }
  if (automation.timingKind === "days_before_expiry") {
    const offset = automation.timingOffsetDays ?? 0;
    if (!ctx.passExpirationSydney) return decide(automation, "keep_pending", "expiry_unknown", warnings, {});
    const delta = daysUntil(ctx.todaySydney, ctx.passExpirationSydney);
    if (!ctx.windowAlreadyMatched) {
      if (delta < 0) return decide(automation, "skip", "pass_expired", warnings, {});
      if (delta > offset) return decide(automation, "keep_pending", "not_due", warnings, {});
      if (delta < offset) return decide(automation, "skip", "missed_window", warnings, {});
    }
  }
  if (automation.timingKind === "days_after_expiry") {
    const offset = automation.timingOffsetDays ?? 0;
    if (!ctx.passExpirationSydney) return decide(automation, "keep_pending", "expiry_unknown", warnings, {});
    const delta = daysUntil(ctx.todaySydney, ctx.passExpirationSydney);
    if (!ctx.windowAlreadyMatched) {
      if (delta >= 0) return decide(automation, "keep_pending", "not_due", warnings, {});
      const since = -delta;
      if (since < offset) return decide(automation, "keep_pending", "not_due", warnings, {});
      if (since > offset) return decide(automation, "skip", "missed_window", warnings, {});
    }
  }
  const filters = filtersPass(automation, ctx);
  if (!filters.ok) return decide(automation, "skip", filters.reason, warnings, {});
  return applySkipRules(automation, ctx);
}
