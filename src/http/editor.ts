import { CLASS_PASS_TOKENS, INTRO_PASS_TOKENS, TWO_WEEK_TOKENS } from "../automations/seed";
import type { Automation, AutomationFilters } from "../automations/types";
import { validateAutomation } from "./automation-body";

export type TriggerChoice = "daily" | "client" | "sale" | "contract" | "sign-in" | "booking" | "classpass";
export type AudienceChoice = "intro" | "two-week" | "leads" | "members" | "classpass" | "all";
export type DelayChoice = "after-purchase" | "after-created" | "before-expiry" | "after-expiry" | "immediate";

export type EditorInput = {
  name: string;
  channel: "email" | "sms";
  templateId: string;
  messageText: string;
  trigger: string;
  audience: string;
  delay: string;
  delayDays: string;
  skipBooking: boolean;
  skipMembership: boolean;
  skipSent: boolean;
  skipUnsubscribed: boolean;
};

const INTRO_KEY = tokenKey(INTRO_PASS_TOKENS);
const TWO_WEEK_KEY = tokenKey(TWO_WEEK_TOKENS);
const CLASS_KEY = tokenKey(CLASS_PASS_TOKENS);

export function derivedTrigger(automation: Automation): TriggerChoice {
  const events = automation.triggerEvents;
  if (events.includes("client.created") && events.includes("classRosterBooking.created")) return "classpass";
  if (events.includes("cron")) return "daily";
  if (events.includes("classRosterBookingStatus.updated")) return "sign-in";
  if (events.includes("classRosterBooking.created")) return "booking";
  if (events.includes("clientSale.created")) return "sale";
  if (events.includes("clientContract.created")) return "contract";
  if (events.includes("client.created")) return "client";
  return "daily";
}

export function derivedAudience(automation: Automation): AudienceChoice {
  const key = tokenKey(automation.filters.packageNameIncludes);
  if (key && key === TWO_WEEK_KEY) return "two-week";
  if (key && key === CLASS_KEY) return "classpass";
  if (key && key === INTRO_KEY) return "intro";
  if (key) return "intro";
  if ("contractNames" in automation.filters) return "members";
  if (
    automation.skipRules.skipIfHasIntroOrAnyPurchase ||
    automation.skipRules.skipIfHasVisited ||
    automation.skipRules.skipIfHasAnyPurchase
  ) {
    return "leads";
  }
  return "all";
}

export function derivedDelay(automation: Automation): DelayChoice {
  if (automation.timingKind === "immediate") return "immediate";
  if (automation.timingKind === "days_before_expiry") return "before-expiry";
  if (automation.timingKind === "days_after_expiry") return "after-expiry";
  if (automation.scheduleOnEvents.includes("client.created") && !automation.scheduleOnEvents.includes("clientSale.created")) {
    return "after-created";
  }
  return "after-purchase";
}

export function blankAutomation(id: number, key: string, name: string): Automation {
  return {
    id,
    key,
    name,
    channel: "email",
    templateId: 5,
    messageText: null,
    triggerEvents: ["client.created"],
    scheduleOnEvents: [],
    timingKind: "immediate",
    timingOffsetDays: null,
    filters: {},
    skipRules: { skipIfAlreadySent: true },
    enabled: false,
    extraRecipient: null,
    notes: null,
  };
}

export function applyEditor(current: Automation, input: EditorInput, enabled: boolean): Automation | string {
  const name = input.name.trim();
  if (!name) return "invalid_name";
  const next = structuredClone(current);
  next.name = name;
  next.channel = input.channel;
  next.enabled = enabled;
  if (input.channel === "email") {
    const templateId = Number(input.templateId);
    next.templateId = Number.isInteger(templateId) ? templateId : null;
    next.messageText = null;
  } else {
    next.templateId = null;
    next.messageText = input.messageText.trim() || null;
  }
  next.skipRules = {
    ...next.skipRules,
    skipIfHasBooking: input.skipBooking,
    skipIfMembership: input.skipMembership,
    skipIfAlreadySent: input.skipSent,
    skipIfUnsubscribed: input.skipUnsubscribed,
  };
  if (derivedAudience(current) !== input.audience) applyAudience(next, input.audience);
  const days = Number(input.delayDays);
  const offsetChanged = input.delay !== "immediate" && current.timingOffsetDays !== days;
  if (input.delay === "immediate") {
    if (derivedTrigger(current) !== input.trigger || current.timingKind !== "immediate") {
      applyTrigger(next, input.trigger === "daily" ? "client" : input.trigger);
      next.timingKind = "immediate";
      next.timingOffsetDays = null;
      next.scheduleOnEvents = [];
    }
  } else if (derivedDelay(current) !== input.delay || offsetChanged || derivedTrigger(current) !== "daily") {
    const applied = applyDelay(next, input.delay, days);
    if (applied) return applied;
  }
  return validateAutomation(next);
}

export function editorInput(form: FormData): EditorInput {
  const channel = form.get("channel") === "sms" ? "sms" : "email";
  return {
    name: String(form.get("name") ?? ""),
    channel,
    templateId: String(form.get("templateId") ?? ""),
    messageText: String(form.get("messageText") ?? ""),
    trigger: String(form.get("trigger") ?? ""),
    audience: String(form.get("audience") ?? ""),
    delay: String(form.get("delay") ?? ""),
    delayDays: String(form.get("delayDays") ?? ""),
    skipBooking: form.get("skipBooking") === "on",
    skipMembership: form.get("skipMembership") === "on",
    skipSent: form.get("skipSent") === "on",
    skipUnsubscribed: form.get("skipUnsubscribed") === "on",
  };
}

function applyTrigger(automation: Automation, trigger: string): void {
  automation.scheduleOnEvents = [];
  if (trigger === "sale") automation.triggerEvents = ["clientSale.created"];
  else if (trigger === "contract") automation.triggerEvents = ["clientContract.created"];
  else if (trigger === "sign-in") {
    automation.triggerEvents = ["classRosterBookingStatus.updated"];
    automation.filters = { ...automation.filters, signedInStatus: automation.filters.signedInStatus ?? "SignedIn" };
  } else if (trigger === "booking") automation.triggerEvents = ["classRosterBooking.created"];
  else if (trigger === "classpass") automation.triggerEvents = ["client.created", "classRosterBooking.created"];
  else if (trigger === "daily") automation.triggerEvents = ["cron"];
  else automation.triggerEvents = ["client.created"];
}

function applyAudience(automation: Automation, audience: string): void {
  const filters: AutomationFilters = { ...automation.filters };
  delete filters.packageNameIncludes;
  delete filters.contractNames;
  if (audience === "intro") filters.packageNameIncludes = [...INTRO_PASS_TOKENS];
  else if (audience === "two-week") filters.packageNameIncludes = [...TWO_WEEK_TOKENS];
  else if (audience === "classpass") filters.packageNameIncludes = [...CLASS_PASS_TOKENS];
  else if (audience === "members") filters.contractNames = automation.filters.contractNames ?? [];
  automation.filters = filters;
}

function applyDelay(automation: Automation, delay: string, days: number): string | null {
  if (!Number.isInteger(days) || days < 0) return "invalid_offset";
  automation.timingOffsetDays = days;
  automation.triggerEvents = ["cron"];
  if (delay === "after-created") {
    automation.timingKind = "delay_days";
    automation.scheduleOnEvents = ["client.created"];
  } else if (delay === "before-expiry") {
    automation.timingKind = "days_before_expiry";
    automation.scheduleOnEvents = ["clientSale.created"];
  } else if (delay === "after-expiry") {
    automation.timingKind = "days_after_expiry";
    automation.scheduleOnEvents = ["clientSale.created"];
  } else {
    automation.timingKind = "delay_days";
    automation.scheduleOnEvents = ["clientSale.created"];
  }
  return null;
}

function tokenKey(tokens: string[] | undefined): string {
  return [...(tokens ?? [])].map((token) => token.toLowerCase()).sort().join("|");
}
