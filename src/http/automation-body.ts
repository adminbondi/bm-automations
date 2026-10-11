import { TIMING_KINDS, type Automation, type AutomationFilters, type AutomationSkipRules, type Channel, type TimingKind } from "../automations/types";

const KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function automationFromBody(body: unknown, id: number): Automation | string {
  if (!isRecord(body)) return "invalid_body";
  const channel = asChannel(body.channel);
  if (!channel) return "invalid_channel";
  const timingKind = asTiming(body.timingKind);
  if (!timingKind) return "invalid_timing";
  const key = asString(body.key);
  const name = asString(body.name);
  if (!key || !KEY.test(key)) return "invalid_key";
  if (!name) return "invalid_name";
  const draft: Automation = {
    id,
    key,
    name,
    channel,
    templateId: asNullableNumber(body.templateId),
    messageText: asNullableString(body.messageText),
    triggerEvents: asStringList(body.triggerEvents) ?? [],
    scheduleOnEvents: asStringList(body.scheduleOnEvents) ?? [],
    timingKind,
    timingOffsetDays: timingKind === "immediate" ? null : asNullableNumber(body.timingOffsetDays),
    filters: asRecord(body.filters) ? (body.filters as AutomationFilters) : {},
    skipRules: asRecord(body.skipRules) ? (body.skipRules as AutomationSkipRules) : {},
    enabled: body.enabled === true,
    extraRecipient: asNullableString(body.extraRecipient),
    notes: asNullableString(body.notes),
  };
  return validateAutomation(draft);
}

export function mergeAutomation(current: Automation, body: unknown): Automation | string {
  if (!isRecord(body)) return "invalid_body";
  const next: Automation = { ...current, filters: current.filters, skipRules: current.skipRules };
  if ("key" in body) {
    const key = asString(body.key);
    if (!key || !KEY.test(key)) return "invalid_key";
    next.key = key;
  }
  if ("name" in body) {
    const name = asString(body.name);
    if (!name) return "invalid_name";
    next.name = name;
  }
  if ("channel" in body) {
    const channel = asChannel(body.channel);
    if (!channel) return "invalid_channel";
    next.channel = channel;
  }
  if ("templateId" in body) next.templateId = asNullableNumber(body.templateId);
  if ("messageText" in body) next.messageText = asNullableString(body.messageText);
  if ("triggerEvents" in body) {
    const events = asStringList(body.triggerEvents);
    if (!events) return "invalid_events";
    next.triggerEvents = events;
  }
  if ("scheduleOnEvents" in body) {
    const events = asStringList(body.scheduleOnEvents);
    if (!events) return "invalid_events";
    next.scheduleOnEvents = events;
  }
  if ("timingKind" in body) {
    const timing = asTiming(body.timingKind);
    if (!timing) return "invalid_timing";
    next.timingKind = timing;
  }
  if ("timingOffsetDays" in body) next.timingOffsetDays = asNullableNumber(body.timingOffsetDays);
  if ("filters" in body) {
    if (!asRecord(body.filters)) return "invalid_filters";
    next.filters = body.filters as AutomationFilters;
  }
  if ("skipRules" in body) {
    if (!asRecord(body.skipRules)) return "invalid_skip_rules";
    next.skipRules = body.skipRules as AutomationSkipRules;
  }
  if ("enabled" in body) {
    if (typeof body.enabled !== "boolean") return "invalid_enabled";
    next.enabled = body.enabled;
  }
  if ("extraRecipient" in body) next.extraRecipient = asNullableString(body.extraRecipient);
  if ("notes" in body) next.notes = asNullableString(body.notes);
  if (next.timingKind === "immediate") next.timingOffsetDays = null;
  return validateAutomation(next);
}

export function validateAutomation(automation: Automation): Automation | string {
  if (automation.channel === "email") {
    if (automation.templateId !== null && (!Number.isInteger(automation.templateId) || automation.templateId <= 0)) return "template_required";
    automation.messageText = null;
  } else if (!automation.messageText) {
    return "message_required";
  } else if (automation.templateId !== null) {
    return "sms_template_forbidden";
  }
  if (automation.timingKind !== "immediate") {
    if (automation.timingOffsetDays === null || !Number.isInteger(automation.timingOffsetDays) || automation.timingOffsetDays < 0) {
      return "invalid_offset";
    }
  }
  return automation;
}

function asChannel(value: unknown): Channel | null {
  return value === "email" || value === "sms" ? value : null;
}

function asTiming(value: unknown): TimingKind | null {
  return TIMING_KINDS.find((kind) => kind === value) ?? null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNullableString(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  return typeof value === "string" ? value : null;
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asStringList(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) return null;
  return value;
}

function asRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return asRecord(value);
}
