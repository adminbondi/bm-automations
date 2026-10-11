import { CLASS_PASS_TOKENS, INTRO_PASS_TOKENS, TWO_WEEK_TOKENS } from "../automations/seed";
import type { Automation, AutomationFilters } from "../automations/types";
import { validateAutomation } from "./automation-body";

export type TriggerChoice =
  | "daily"
  | "client"
  | "sale"
  | "contract"
  | "sign-in"
  | "booking"
  | "classpass"
  | "lead"
  | "since-visit"
  | "birthday"
  | "birthday-month"
  | "every-nth"
  | "credits"
  | "under-credits"
  | "visit-window";

export type RuleTrigger = "since-visit" | "birthday" | "birthday-month" | "every-nth" | "credits" | "under-credits" | "visit-window" | "lead";

export const RULE_FIELDS: Record<RuleTrigger, { input: "number" | "date"; label: string; help: string }> = {
  "since-visit": {
    input: "number",
    label: "Days since last visit",
    help: "Sends this many days after the last signed-in visit.",
  },
  birthday: {
    input: "date",
    label: "Birthday",
    help: "Sends on each client's birthday from Mindbody. 29 Feb uses 28 Feb in other years.",
  },
  "birthday-month": {
    input: "date",
    label: "Birthday month",
    help: "Sends on the 1st of the client's birthday month.",
  },
  "every-nth": {
    input: "number",
    label: "Every Nth visit",
    help: "Sends when the signed-in visit count is a multiple of this number.",
  },
  credits: {
    input: "number",
    label: "Credits remaining",
    help: "Sends when the current pass has this many credits left.",
  },
  "under-credits": {
    input: "number",
    label: "Under this many credits",
    help: "Sends when the current pack has fewer credits than this number. The booking or visit payload's remaining count is enough.",
  },
  "visit-window": {
    input: "number",
    label: "Visit window (days)",
    help: "Counts signed-in visits whose start date is inside this many days.",
  },
  lead: {
    input: "number",
    label: "Days after the lead",
    help: "0 sends as soon as the lead arrives. A larger number waits that many days.",
  },
};
export type AudienceChoice = "intro" | "two-week" | "leads" | "members" | "classpass" | "all";
export type DelayChoice =
  | "after-purchase"
  | "after-created"
  | "after-lead"
  | "before-expiry"
  | "after-expiry"
  | "since-last-visit"
  | "birthday"
  | "birthday-month"
  | "immediate";

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
  ruleNumber?: string;
};

const INTRO_KEY = tokenKey(INTRO_PASS_TOKENS);
const TWO_WEEK_KEY = tokenKey(TWO_WEEK_TOKENS);
const CLASS_KEY = tokenKey(CLASS_PASS_TOKENS);

export function derivedTrigger(automation: Automation): TriggerChoice {
  const events = automation.triggerEvents;
  if (automation.timingKind === "days_since_last_visit") return "since-visit";
  if (automation.timingKind === "birthday_day") return "birthday";
  if (automation.timingKind === "birthday_month_start") return "birthday-month";
  if (automation.skipRules.everyNthVisit != null) return "every-nth";
  if (automation.filters.maxRemaining != null && automation.filters.exactRemaining == null) return "under-credits";
  if (automation.filters.exactRemaining != null) return "credits";
  if (automation.skipRules.visitWindowDays != null) return "visit-window";
  if (events.includes("client.created") && events.includes("classRosterBooking.created")) return "classpass";
  if (events.includes("lead.created") || automation.scheduleOnEvents.includes("lead.created")) return "lead";
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
  if (automation.timingKind === "days_since_last_visit") return "since-last-visit";
  if (automation.timingKind === "birthday_day") return "birthday";
  if (automation.timingKind === "birthday_month_start") return "birthday-month";
  if (automation.scheduleOnEvents.includes("lead.created")) return "after-lead";
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
    next.templateId = Number.isInteger(templateId) && templateId > 0 ? templateId : null;
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
  if (isRuleTrigger(input.trigger)) {
    const failed = applyRule(next, input.trigger, input.ruleNumber ?? "");
    if (failed) return failed;
    return validateAutomation(next);
  }
  if (isRuleTrigger(derivedTrigger(current))) clearRuleExtras(next);
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
    ruleNumber: String(form.get("ruleNumber") ?? ""),
  };
}

function isRuleTrigger(trigger: string): trigger is RuleTrigger {
  return trigger in RULE_FIELDS;
}

function applyRule(automation: Automation, trigger: RuleTrigger, raw: string): string | null {
  const field = RULE_FIELDS[trigger];
  const parsed = Number(raw);
  const number = raw.trim() === "" && trigger === "lead" ? 0 : parsed;
  if (field.input === "number" && (!Number.isInteger(number) || number < 0)) return "invalid_offset";
  if ((trigger === "every-nth" || trigger === "visit-window") && number < 1) return "invalid_offset";
  clearRuleExtras(automation, trigger);
  if (trigger === "since-visit") {
    automation.triggerEvents = ["cron"];
    automation.scheduleOnEvents = ["classRosterBookingStatus.updated"];
    automation.timingKind = "days_since_last_visit";
    automation.timingOffsetDays = number;
    return null;
  }
  if (trigger === "birthday" || trigger === "birthday-month") {
    automation.triggerEvents = ["cron"];
    if (automation.scheduleOnEvents.length === 0) automation.scheduleOnEvents = ["client.created"];
    automation.timingKind = trigger === "birthday" ? "birthday_day" : "birthday_month_start";
    automation.timingOffsetDays = 0;
    automation.skipRules.dedupeScope = automation.skipRules.dedupeScope ?? "calendar_year";
    automation.skipRules.repeat = automation.skipRules.repeat ?? "yearly";
    return null;
  }
  if (trigger === "under-credits") {
    if (number < 1) return "invalid_offset";
    automation.triggerEvents = ["classRosterBooking.created", "classRosterBookingStatus.updated"];
    automation.scheduleOnEvents = [];
    automation.timingKind = "immediate";
    automation.timingOffsetDays = null;
    delete automation.filters.signedInStatus;
    automation.filters.maxRemaining = number - 1;
    return null;
  }
  if (trigger === "lead") {
    if (number === 0) {
      automation.triggerEvents = ["lead.created"];
      automation.scheduleOnEvents = [];
      automation.timingKind = "immediate";
      automation.timingOffsetDays = null;
    } else {
      automation.triggerEvents = ["cron"];
      automation.scheduleOnEvents = ["lead.created"];
      automation.timingKind = "delay_days";
      automation.timingOffsetDays = number;
    }
    return null;
  }
  automation.triggerEvents = ["classRosterBookingStatus.updated"];
  automation.scheduleOnEvents = [];
  automation.timingKind = "immediate";
  automation.timingOffsetDays = null;
  automation.filters.signedInStatus = automation.filters.signedInStatus ?? "SignedIn";
  if (trigger === "every-nth") {
    automation.skipRules.everyNthVisit = number;
    automation.skipRules.dedupeScope = automation.skipRules.dedupeScope ?? "visit_milestone";
  } else if (trigger === "credits") {
    automation.filters.exactRemaining = number;
  } else {
    automation.skipRules.visitWindowDays = number;
    if (automation.skipRules.minVisitsInWindow == null) automation.skipRules.minVisitsInWindow = 1;
  }
  return null;
}

function clearRuleExtras(automation: Automation, keep?: RuleTrigger): void {
  if (keep !== "every-nth") delete automation.skipRules.everyNthVisit;
  if (keep !== "credits") delete automation.filters.exactRemaining;
  delete automation.filters.minRemaining;
  if (keep !== "under-credits") delete automation.filters.maxRemaining;
  if (keep !== "visit-window") {
    delete automation.skipRules.visitWindowDays;
    delete automation.skipRules.minVisitsInWindow;
    delete automation.skipRules.maxVisitsInWindow;
  }
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
  else if (trigger === "lead") automation.triggerEvents = ["lead.created"];
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
  } else if (delay === "after-lead") {
    automation.timingKind = "delay_days";
    automation.scheduleOnEvents = ["lead.created"];
  } else if (delay === "since-last-visit") {
    automation.timingKind = "days_since_last_visit";
    automation.scheduleOnEvents = ["classRosterBookingStatus.updated"];
  } else if (delay === "birthday") {
    automation.timingKind = "birthday_day";
    automation.timingOffsetDays = 0;
    automation.scheduleOnEvents = ["client.created"];
  } else if (delay === "birthday-month") {
    automation.timingKind = "birthday_month_start";
    automation.timingOffsetDays = 0;
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
