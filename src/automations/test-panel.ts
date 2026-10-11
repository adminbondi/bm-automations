import type { ClientSnapshot } from "@balancemoves/contacts-core";
import { buildMerge, renderMerge } from "../merge/values";
import { contractMatches } from "../names";
import { withReplyStop } from "../sms";
import { addDays, sydneyDateFromInstant } from "../time";
import { evaluateAutomation, selectPassExpiry, selectRemaining } from "./engine";
import { TEMPLATE_SUBJECTS } from "./subjects";
import type { Automation, ServiceRecord, Visit } from "./types";

export const TEST_BYPASS_LABEL =
  "Sends even if this automation is off. Bypasses dedupe and quiet hours. The Mindbody client is not contacted.";

export type TestSample = {
  first: string;
  last: string;
  email: string;
  phone: string;
  birth: string;
  created: string;
  pack: string;
  passEnd: string;
  credits: string;
  visits: string;
};

export type TestSubject = {
  clientId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  birthDate: string | null;
  createdAt: string | null;
  waiverSigned: boolean;
  services: ServiceRecord[];
  visits: Visit[];
  contracts: { name: string }[];
  signedInStatus: string | null;
};

export type RulePreview = {
  outcome: "send" | "skip";
  reason: string;
  reasonLabel: string;
  headline: string;
  renderedTitle: string;
  rendered: string;
  data: Record<string, string | number>;
};

const REASONS: Record<string, string> = {
  send: "The rules match.",
  has_intro_or_purchase: "The client already has a purchase.",
  has_purchase: "The client already has a purchase.",
  has_booking: "The client already has a booking.",
  has_visited: "The client already has a visit.",
  has_membership: "The client has a membership.",
  unsubscribed: "The client is unsubscribed.",
  waiver_signed: "The waiver is already signed.",
  not_due: "It is not due yet.",
  missed_window: "The send window has passed.",
  template_missing: "No listmonk template is set.",
  package_filter_miss: "The package name does not match.",
  remaining_not_exact: "Credits remaining do not match.",
  remaining_below_min: "Credits remaining are below the minimum.",
  remaining_above_max: "Credits remaining are above the maximum.",
  remaining_unknown: "Credits remaining are unknown.",
  visits_not_exact: "The visit count does not match.",
  visits_not_multiple: "The visit count is not on the every-Nth step.",
  visits_outside_window: "Visits in the window do not match.",
  visits_below_min: "There are not enough visits.",
  visits_above_max: "There are too many visits.",
  visits_not_yet: "The visit count is not there yet.",
  birth_date_unknown: "No birth date is on the client.",
  last_visit_unknown: "No last visit is on the client.",
  expiry_unknown: "No pass end date is on the client.",
  pass_expired: "The pass has expired.",
  not_active: "The client is not active.",
  not_inactive: "The client is still active.",
  signed_in_status_mismatch: "The sign-in status does not match.",
  contract_not_on_list: "The contract is not on the list.",
};

export function emptySample(): TestSample {
  return {
    first: "",
    last: "",
    email: "",
    phone: "",
    birth: "",
    created: "",
    pack: "",
    passEnd: "",
    credits: "",
    visits: "",
  };
}

export function sampleFromForm(form: FormData): TestSample {
  const read = (key: string) => String(form.get(key) ?? "");
  return {
    first: read("sampleFirst"),
    last: read("sampleLast"),
    email: read("sampleEmail"),
    phone: read("samplePhone"),
    birth: read("sampleBirth"),
    created: read("sampleCreated"),
    pack: read("samplePack"),
    passEnd: read("samplePassEnd"),
    credits: read("sampleCredits"),
    visits: read("sampleVisits"),
  };
}

export function subjectFromSample(sample: TestSample, todaySydney: string): TestSubject {
  const pack = sample.pack.trim();
  const credits = sample.credits.trim();
  const remaining = credits === "" ? null : Number(credits);
  const services: ServiceRecord[] = [];
  if (pack || sample.passEnd.trim() || credits !== "") {
    services.push({
      name: pack || "your pass",
      expirationSydney: /^\d{4}-\d{2}-\d{2}$/.test(sample.passEnd.trim()) ? sample.passEnd.trim() : null,
      current: true,
      remaining: remaining != null && Number.isFinite(remaining) ? remaining : null,
    });
  }
  const count = Math.max(0, Math.min(40, Math.trunc(Number(sample.visits) || 0)));
  const visits: Visit[] = Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    signedIn: true,
    lateCancelled: false,
    earlyCancelled: false,
    serviceName: pack,
    startSydney: addDays(todaySydney, -index),
  }));
  return {
    clientId: "sample",
    firstName: sample.first.trim() || null,
    lastName: sample.last.trim() || null,
    email: sample.email.trim().toLowerCase() || null,
    phone: sample.phone.trim() || null,
    birthDate: dateOrNull(sample.birth),
    createdAt: sample.created.trim() || null,
    waiverSigned: false,
    services,
    visits,
    contracts: [],
    signedInStatus: null,
  };
}

export function subjectFromSnapshot(clientId: string, snapshot: ClientSnapshot): TestSubject {
  return {
    clientId,
    firstName: snapshot.profile.firstName,
    lastName: snapshot.profile.lastName,
    email: snapshot.profile.email,
    phone: snapshot.profile.phone,
    birthDate: snapshot.profile.birthDate ?? null,
    createdAt: snapshot.profile.createdAt,
    waiverSigned: snapshot.profile.waiverSigned,
    services: snapshot.services,
    visits: snapshot.visits,
    contracts: snapshot.contracts,
    signedInStatus: null,
  };
}

export function evaluateTest(
  automation: Automation,
  subject: TestSubject,
  todaySydney: string,
  options: { studioName: string; appendReplyStop: boolean },
): RulePreview {
  const phase = automation.timingKind === "immediate" && automation.triggerEvents.some((event) => event !== "cron")
    ? "trigger"
    : "cron";
  const eventId = phase === "trigger"
    ? automation.triggerEvents.find((event) => event !== "cron") ?? "cron"
    : "cron";
  const anchor = sydneyDay(subject.createdAt, todaySydney);
  const dueOn = automation.timingKind === "delay_days" ? addDays(anchor, automation.timingOffsetDays ?? 0) : null;
  const tokens = automation.filters.packageNameIncludes ?? [];
  const assumedSignIn = !subject.signedInStatus && automation.filters.signedInStatus
    ? automation.filters.signedInStatus
    : null;
  const contractName = triggeringContract(automation, subject.contracts);
  const decision = evaluateAutomation(automation, {
    phase,
    eventId,
    todaySydney,
    anchorSydney: anchor,
    dueOn,
    signedInStatus: subject.signedInStatus ?? assumedSignIn,
    triggeringContractName: contractName,
    candidatePackageNames: subject.services.map((service) => service.name).filter((name) => name.trim().length > 0),
    waiverSigned: subject.waiverSigned,
    suppressed: false,
    passExpirationSydney: selectPassExpiry(subject.services, tokens),
    visits: subject.visits,
    serviceCount: subject.services.length,
    contracts: subject.contracts,
    visitCrossingRecorded: false,
    windowAlreadyMatched: false,
    services: subject.services,
    birthDate: subject.birthDate,
    remaining: selectRemaining(subject.services, tokens),
  });
  const outcome = decision.action === "send" ? "send" : "skip";
  const reasonLabel = reasonText(decision.reason, decision.dueOn);
  const assumption = assumedSignIn ? ` Preview assumes a ${assumedSignIn} event.` : "";
  const bag = buildMerge({
    automation,
    firstName: subject.firstName,
    lastName: subject.lastName,
    email: subject.email,
    studioName: options.studioName,
    todaySydney,
    services: subject.services,
    visits: subject.visits,
  });
  const rendered = automation.channel === "sms"
    ? renderSms(automation, bag, options.appendReplyStop)
    : renderEmail(automation, bag);
  return {
    outcome,
    reason: decision.reason,
    reasonLabel,
    headline: `${outcome === "send" ? "Would send" : "Would skip"}. ${reasonLabel}${assumption}`,
    renderedTitle: automation.channel === "sms" ? "Text" : "Email",
    rendered,
    data: bag.data,
  };
}

function renderSms(automation: Automation, bag: ReturnType<typeof buildMerge>, appendReplyStop: boolean): string {
  return withReplyStop(renderMerge(automation.messageText ?? "", bag), appendReplyStop);
}

function renderEmail(automation: Automation, bag: ReturnType<typeof buildMerge>): string {
  const raw = automation.templateId ? TEMPLATE_SUBJECTS[automation.templateId] ?? "" : "";
  const subject = raw ? renderMerge(raw, bag) : "No subject on file for this template.";
  const lines = Object.entries(bag.data)
    .filter(([, value]) => value !== "" && value != null)
    .map(([key, value]) => `${key}: ${value}`);
  return [`Subject: ${subject}`, `Template: ${automation.templateId ?? "none"}`, "", "Merge fields:", ...lines].join("\n");
}

function reasonText(reason: string, dueOn?: string): string {
  const label = REASONS[reason] ?? reason.replaceAll("_", " ");
  if (dueOn && reason !== "send") return `${label} Next date ${dueOn}.`;
  return label;
}

function triggeringContract(automation: Automation, contracts: { name: string }[]): string | null {
  const wanted = automation.filters.contractNames;
  if (wanted && wanted.length > 0) {
    const hit = contracts.find((contract) => contractMatches(contract.name, wanted));
    if (hit) return hit.name;
  }
  return contracts[0]?.name ?? null;
}

function sydneyDay(value: string | null, todaySydney: string): string {
  if (!value) return todaySydney;
  if (/^\d{4}-\d{2}-\d{2}/.test(value) && value.length >= 10 && !value.includes("T")) return value.slice(0, 10);
  return sydneyDateFromInstant(value, new Date(`${todaySydney}T12:00:00Z`));
}

function dateOrNull(value: string): string | null {
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}
