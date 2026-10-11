import { selectPassExpiry, evaluateAutomation, type EvalContext, type Decision } from "../automations/engine";
import { dedupeKey, gateSend, unsubscribeUrl, withUnsubscribe, type GateResult } from "../automations/gate";
import { renderSms } from "../sms";
import type { Automation, Channel, ServiceRecord, Visit } from "../automations/types";

export type PlanFacts = {
  eventId: string;
  todaySydney: string;
  anchorSydney: string;
  dueOn: string | null;
  signedInStatus: string | null;
  triggeringContractName: string | null;
  candidatePackageNames: string[];
  waiverSigned: boolean;
  suppressed: boolean;
  services: ServiceRecord[];
  visits: Visit[];
  serviceCount: number;
  contracts: { name: string }[];
  visitCrossingRecorded: boolean;
  windowAlreadyMatched: boolean;
  clientId: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  studioName: string;
  devMode: boolean;
  dryRun: boolean;
  emailAllowlist: string[];
  phoneAllowlist: string[];
  alreadySentKeys: Set<string>;
  listmonkBaseUrl: string;
  withinQuietHours: boolean;
};

export type GatedPlan = {
  automation: Automation;
  phase: EvalContext["phase"];
  decision: Decision;
  ruleAction: Decision["action"];
  outcome: Decision["action"] | GateResult["outcome"];
  reason: string;
  terminal: boolean;
  listmonkCall: boolean;
  twilioCall: boolean;
  channel: Channel;
  email: string | null;
  phone: string | null;
  templateId: number | null;
  messageText: string | null;
  renderedMessage: string | null;
  data: Record<string, unknown>;
  dedupeKey: string | null;
  copy: boolean;
};

export function matchingPhases(automation: Automation, eventId: string): EvalContext["phase"][] {
  const phases: EvalContext["phase"][] = [];
  if (automation.triggerEvents.includes(eventId) && automation.timingKind === "immediate") phases.push("trigger");
  if (automation.scheduleOnEvents.includes(eventId)) phases.push("schedule");
  return phases;
}

export function planAutomations(automations: Automation[], facts: PlanFacts): GatedPlan[] {
  const plans: GatedPlan[] = [];
  for (const automation of automations) {
    for (const phase of matchingPhases(automation, facts.eventId)) {
      plans.push(...plansFor(automation, phase, facts));
    }
  }
  return plans;
}

export function planCron(automation: Automation, facts: PlanFacts): GatedPlan[] {
  const plans = plansFor(automation, "cron", facts);
  if (plans.length === 0) throw new Error("cron plan missing");
  return plans;
}

function plansFor(automation: Automation, phase: EvalContext["phase"], facts: PlanFacts): GatedPlan[] {
  const decision = evaluateAutomation(automation, contextFor(automation, facts, phase));
  if (decision.reason === "not_this_trigger" || decision.reason === "not_this_schedule_event") return [];
  const primary = gatePlan(automation, phase, decision, facts, "primary");
  if (decision.action !== "send" || automation.channel !== "email" || !automation.extraRecipient) return [primary];
  return [primary, gatePlan(automation, phase, decision, facts, "copy")];
}

function contextFor(automation: Automation, facts: PlanFacts, phase: EvalContext["phase"]): EvalContext {
  const tokens = automation.filters.packageNameIncludes ?? [];
  return {
    phase,
    eventId: phase === "cron" ? "cron" : facts.eventId,
    todaySydney: facts.todaySydney,
    anchorSydney: facts.anchorSydney,
    dueOn: facts.dueOn,
    signedInStatus: facts.signedInStatus,
    triggeringContractName: facts.triggeringContractName,
    candidatePackageNames: facts.candidatePackageNames,
    waiverSigned: facts.waiverSigned,
    suppressed: facts.suppressed,
    passExpirationSydney: selectPassExpiry(facts.services, tokens),
    visits: facts.visits,
    serviceCount: facts.serviceCount,
    contracts: facts.contracts,
    visitCrossingRecorded: facts.visitCrossingRecorded,
    windowAlreadyMatched: facts.windowAlreadyMatched,
  };
}

function gatePlan(
  automation: Automation,
  phase: EvalContext["phase"],
  decision: Decision,
  facts: PlanFacts,
  recipient: "primary" | "copy",
): GatedPlan {
  const renderedMessage = automation.channel === "sms" && automation.messageText
    ? renderSms(automation.messageText, facts.firstName, facts.studioName)
    : null;
  const email = recipient === "copy" ? automation.extraRecipient : facts.email;
  if (decision.action !== "send") {
    return {
      automation,
      phase,
      decision,
      ruleAction: decision.action,
      outcome: decision.action,
      reason: decision.reason,
      terminal: decision.action === "skip",
      listmonkCall: false,
      twilioCall: false,
      channel: automation.channel,
      email,
      phone: facts.phone,
      templateId: decision.templateId,
      messageText: decision.messageText,
      renderedMessage,
      data: decision.data,
      dedupeKey: null,
      copy: recipient === "copy",
    };
  }
  const key = dedupeKey(automation.id, facts.clientId, recipient);
  const gate = gateSend({
    devMode: facts.devMode,
    dryRun: facts.dryRun,
    enabled: automation.enabled,
    emailAllowlist: facts.emailAllowlist,
    phoneAllowlist: facts.phoneAllowlist,
    channel: automation.channel,
    email,
    phone: facts.phone,
    alreadySent: facts.alreadySentKeys.has(key),
    suppressed: recipient === "copy" ? false : facts.suppressed,
    withinQuietHours: facts.withinQuietHours,
  });
  const data = automation.channel === "email"
    ? withUnsubscribe(decision.data, unsubscribeUrl(facts.listmonkBaseUrl, null))
    : decision.data;
  return {
    automation,
    phase,
    decision,
    ruleAction: "send",
    outcome: gate.outcome,
    reason: gate.reason,
    terminal: gate.terminal,
    listmonkCall: gate.listmonkCall,
    twilioCall: gate.twilioCall,
    channel: automation.channel,
    email: gate.email,
    phone: gate.phone,
    templateId: decision.templateId,
    messageText: decision.messageText,
    renderedMessage,
    data,
    dedupeKey: key,
    copy: recipient === "copy",
  };
}
