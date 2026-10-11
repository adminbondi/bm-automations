import { contractMatches, nameMatchesTokens } from "../names";
import { addDays, daysUntil, nextAnnualDate } from "../time";
import type { Automation, Channel, ServiceRecord, TimingKind, Visit } from "./types";

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
  services?: ServiceRecord[];
  birthDate?: string | null;
  remaining?: number | null;
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

function visitIncluded(visit: Visit, automation: Automation): boolean {
  const mode = automation.filters.visitCountMode ?? "signed_in";
  const scope = automation.skipRules.visitCountScope ?? "all";
  const includeClassPass = automation.filters.includeClassPassVisits ?? true;
  const classPassTokens = automation.filters.classPassNameIncludes ?? DEFAULT_CLASS_PASS_TOKENS;
  const packageTokens = automation.filters.packageNameIncludes ?? [];
  if (visit.lateCancelled || visit.earlyCancelled) return false;
  if (mode === "signed_in" && !visit.signedIn) return false;
  if (!includeClassPass && nameMatchesTokens(visit.serviceName, classPassTokens)) return false;
  if ((scope === "intro_pass" || scope === "matching_package") && !nameMatchesTokens(visit.serviceName, packageTokens)) {
    return false;
  }
  return true;
}

export function countVisits(visits: Visit[], automation: Automation): number {
  return visits.filter((visit) => visitIncluded(visit, automation)).length;
}

export function lastVisitDate(visits: Visit[], automation: Automation): string | null {
  const dates = visits
    .filter((visit) => visitIncluded(visit, automation) && visit.startSydney)
    .map((visit) => visit.startSydney as string)
    .sort();
  return dates.at(-1) ?? null;
}

export function countVisitsInWindow(visits: Visit[], automation: Automation, todaySydney: string, windowDays: number): number {
  return visits.filter((visit) => {
    if (!visitIncluded(visit, automation) || !visit.startSydney) return false;
    const since = daysUntil(visit.startSydney, todaySydney);
    return since >= 0 && since <= windowDays;
  }).length;
}

export function selectRemaining(services: ServiceRecord[], tokens: string[]): number | null {
  const pool = services.filter((service) => {
    if (!service.current || typeof service.remaining !== "number") return false;
    if (tokens.length > 0 && !nameMatchesTokens(service.name, tokens)) return false;
    return true;
  });
  if (pool.length === 0) return null;
  const sorted = [...pool].sort((left, right) => (left.expirationSydney ?? "9999-12-31").localeCompare(right.expirationSydney ?? "9999-12-31"));
  return sorted[0]?.remaining ?? null;
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
  if (filters.exactRemaining != null || filters.minRemaining != null || filters.maxRemaining != null) {
    if (ctx.remaining == null) return { ok: false, reason: "remaining_unknown" };
    if (filters.exactRemaining != null && ctx.remaining !== filters.exactRemaining) {
      return { ok: false, reason: "remaining_not_exact" };
    }
    if (filters.minRemaining != null && ctx.remaining < filters.minRemaining) {
      return { ok: false, reason: "remaining_below_min" };
    }
    if (filters.maxRemaining != null && ctx.remaining > filters.maxRemaining) {
      return { ok: false, reason: "remaining_above_max" };
    }
  }
  if (filters.clientActivity) {
    const active = clientIsActive(ctx);
    if (filters.clientActivity === "active" && !active) return { ok: false, reason: "not_active" };
    if (filters.clientActivity === "inactive" && active) return { ok: false, reason: "not_inactive" };
  }
  return { ok: true };
}

function clientIsActive(ctx: EvalContext): boolean {
  if (ctx.contracts.length > 0) return true;
  return (ctx.services ?? []).some((service) => {
    if (!service.current) return false;
    if (!service.expirationSydney) return true;
    return service.expirationSydney >= ctx.todaySydney;
  });
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
  if (rules.maxVisits != null && visits > rules.maxVisits) {
    return decide(automation, "skip", "visits_above_max", warnings, data);
  }
  if (rules.everyNthVisit != null && rules.everyNthVisit > 0) {
    const step = rules.everyNthVisit;
    const stillShort = automation.timingKind === "immediate" && !ctx.visitCrossingRecorded && visits < step;
    if (stillShort) return decide(automation, "keep_pending", "visits_not_yet", warnings, data);
    if (visits <= 0 || visits % step !== 0) return decide(automation, "skip", "visits_not_multiple", warnings, data);
  }
  if (rules.visitWindowDays != null) {
    const inWindow = countVisitsInWindow(ctx.visits, automation, ctx.todaySydney, rules.visitWindowDays);
    const min = rules.minVisitsInWindow ?? 1;
    const max = rules.maxVisitsInWindow ?? Number.POSITIVE_INFINITY;
    const stillShort = automation.timingKind === "immediate" && !ctx.visitCrossingRecorded && inWindow < min;
    if (stillShort) return decide(automation, "keep_pending", "visits_not_yet", warnings, data);
    if (inWindow < min || inWindow > max) return decide(automation, "skip", "visits_outside_window", warnings, data);
  }
  if (rules.skipIfPassExpired && ctx.passExpirationSydney && daysUntil(ctx.todaySydney, ctx.passExpirationSydney) < 0) {
    return decide(automation, "skip", "pass_expired", warnings, data);
  }
  if (automation.channel === "email" && (automation.templateId === null || automation.templateId <= 0)) {
    return decide(automation, "keep_pending", "template_missing", warnings, data);
  }
  const birthdayNext = birthdayKind(automation.timingKind) ? nextBirthday(automation.timingKind, ctx.birthDate ?? null, addDays(ctx.todaySydney, 1)) : null;
  return decide(automation, "send", "send", warnings, data, birthdayNext ?? undefined);
}

function birthdayKind(kind: TimingKind): boolean {
  return kind === "birthday_day" || kind === "birthday_month_start";
}

function birthdayMonthDay(kind: TimingKind, birthDate: string): string {
  if (kind === "birthday_month_start") return `${birthDate.slice(5, 7)}-01`;
  return birthDate.slice(5);
}

function nextBirthday(kind: TimingKind, birthDate: string | null, todaySydney: string): string | null {
  if (!birthDate || birthDate.length < 10) return null;
  return nextAnnualDate(todaySydney, birthdayMonthDay(kind, birthDate));
}

function scheduleDecision(automation: Automation, ctx: EvalContext, warnings: string[]): Decision {
  if (automation.timingKind === "delay_days") {
    return decide(automation, "schedule", "scheduled", warnings, {}, addDays(ctx.anchorSydney, automation.timingOffsetDays ?? 0));
  }
  if (automation.timingKind === "days_before_expiry" || automation.timingKind === "days_after_expiry") {
    return decide(automation, "schedule", "scheduled", warnings, {}, ctx.anchorSydney);
  }
  if (automation.timingKind === "days_since_last_visit") {
    const last = lastVisitDate(ctx.visits, automation) ?? ctx.anchorSydney;
    return decide(automation, "schedule", "scheduled", warnings, {}, addDays(last, automation.timingOffsetDays ?? 0));
  }
  if (birthdayKind(automation.timingKind)) {
    const due = nextBirthday(automation.timingKind, ctx.birthDate ?? null, ctx.todaySydney) ?? ctx.anchorSydney;
    return decide(automation, "schedule", "scheduled", warnings, {}, due);
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
      if (delta > 0) return decide(automation, "keep_pending", "not_due", warnings, {});
      const since = -delta;
      if (since < offset) return decide(automation, "keep_pending", "not_due", warnings, {});
      if (since > offset) return decide(automation, "skip", "missed_window", warnings, {});
    }
  }
  if (automation.timingKind === "days_since_last_visit") {
    const offset = automation.timingOffsetDays ?? 0;
    const last = lastVisitDate(ctx.visits, automation);
    if (!last) return decide(automation, "keep_pending", "last_visit_unknown", warnings, {});
    const since = daysUntil(last, ctx.todaySydney);
    if (since < offset) return decide(automation, "keep_pending", "not_due", warnings, {}, addDays(last, offset));
    if (since > offset && !ctx.windowAlreadyMatched) return decide(automation, "skip", "missed_window", warnings, {});
  }
  if (birthdayKind(automation.timingKind)) {
    const birth = ctx.birthDate ?? null;
    if (!birth) return decide(automation, "keep_pending", "birth_date_unknown", warnings, {});
    const due = nextBirthday(automation.timingKind, birth, ctx.todaySydney);
    if (due !== ctx.todaySydney) return decide(automation, "keep_pending", "not_due", warnings, {}, due ?? undefined);
  }
  const filters = filtersPass(automation, ctx);
  if (!filters.ok) return decide(automation, "skip", filters.reason, warnings, {});
  return applySkipRules(automation, ctx);
}
