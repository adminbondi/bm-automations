import { COVERAGE_AUTOMATIONS } from "./coverage-seed";
import type { Automation } from "./types";

export const INTRO_PASS_TOKENS = ["2 week", "2-week", "7 day", "7-day", "intro pass"];
export const TWO_WEEK_TOKENS = ["2 week", "2-week"];
export const CLASS_PASS_TOKENS = ["classpass", "class pass"];

export const SMS_DAY_7 =
  "Hey [First name], we noticed you haven't booked into your first class at [Studio] yet. Can we help getting you booked in?";

export const SMS_GOOGLE_REVIEW =
  "Hi [First name]! Are you loving our classes? As a small business Google reviews help us more than you know. Could you please click here and leave us one? Thank you so much! Thiago & Yvette from Balance Moves https://g.page/r/CfyVtWt5Wc47EBM/review";

export const SMS_EXPIRING_1_DAY =
  "Hi [First name], It's Thiago & Yvette at [Studio] We hope you have enjoyed our classes and love our instructors.\n\nWe have a SPECIAL INTRO CLIENT OFFER for you:\n\nhttps://www.balancemoves.com.au/membership-sign-up";

export const SMS_FOLLOWUP_10 =
  "Hey [First name], it's [Studio]! We had so much fun during your Intro Pass - we would love to see you back in the studio:\n\nWe have a SPECIAL INTRO CLIENT OFFER for you: https://www.balancemoves.com.au/membership-sign-up\n\nAny questions, let me know. Yvette xx";

const SEED_AT = "2026-10-11T00:00:00.000Z";

export const SEED_CREATED_AT = SEED_AT;

const email = (
  automation: Omit<Automation, "channel" | "messageText" | "enabled"> & { enabled?: boolean },
): Automation => ({
  channel: "email",
  messageText: null,
  enabled: false,
  ...automation,
});

const sms = (
  automation: Omit<Automation, "channel" | "templateId" | "enabled"> & { enabled?: boolean },
): Automation => ({
  channel: "sms",
  templateId: null,
  enabled: false,
  ...automation,
});

export const SEED_AUTOMATIONS: Automation[] = [
  email({
    id: 1,
    key: "lead-immediate",
    name: "Lead welcome",
    templateId: 5,
    triggerEvents: ["client.created"],
    scheduleOnEvents: [],
    timingKind: "immediate",
    timingOffsetDays: null,
    filters: {},
    skipRules: {
      skipIfAlreadySent: true,
      skipIfHasIntroOrAnyPurchase: true,
    },
    extraRecipient: null,
    notes:
      "Open question: LoyalSnap CCs bondi@. listmonk /api/tx has no CC. Leave extra_recipient empty until owners decide whether to send a separate copy.",
  }),
  email({
    id: 2,
    key: "lead-day-60",
    name: "Lead day 60",
    templateId: 6,
    triggerEvents: ["cron"],
    scheduleOnEvents: ["client.created"],
    timingKind: "delay_days",
    timingOffsetDays: 60,
    filters: {
      visitCountMode: "signed_in",
      includeClassPassVisits: true,
    },
    skipRules: {
      skipIfAlreadySent: true,
      skipIfHasVisited: true,
      skipIfHasAnyPurchase: true,
      skipIfUnsubscribed: true,
      visitCountScope: "all",
    },
    extraRecipient: null,
    notes:
      "Scheduled from client.created. The Sydney morning cron rechecks visits, purchases, and suppression before sending.",
  }),
  email({
    id: 3,
    key: "trial-purchased",
    name: "Trial welcome",
    templateId: 7,
    triggerEvents: ["clientSale.created"],
    scheduleOnEvents: [],
    timingKind: "immediate",
    timingOffsetDays: null,
    filters: {
      packageNameIncludes: INTRO_PASS_TOKENS,
    },
    skipRules: {
      skipIfAlreadySent: true,
    },
    extraRecipient: null,
    notes:
      "Intro pass names are unconfirmed. packageNameIncludes is a contains-match for the spec best values: 2-week and 7-day Intro Pass.",
  }),
  email({
    id: 4,
    key: "trial-third-class",
    name: "Trial 3rd class",
    templateId: 8,
    triggerEvents: ["classRosterBookingStatus.updated"],
    scheduleOnEvents: [],
    timingKind: "immediate",
    timingOffsetDays: null,
    filters: {
      packageNameIncludes: INTRO_PASS_TOKENS,
      signedInStatus: "SignedIn",
      visitCountMode: "signed_in",
      includeClassPassVisits: false,
      classPassNameIncludes: CLASS_PASS_TOKENS,
    },
    skipRules: {
      skipIfAlreadySent: true,
      skipIfMembership: true,
      membershipContractNames: [],
      exactVisits: 3,
      visitCountScope: "intro_pass",
    },
    extraRecipient: null,
    notes:
      "Counts signed-in visits whose service name matches the intro pass tokens. ClassPass visits are excluded. membershipContractNames is empty until owners confirm the 11 contracts, so a membership on file is not detected yet. A short count stays pending for the morning cron.",
  }),
  email({
    id: 5,
    key: "trial-expiring-3-days",
    name: "Trial expiring 3 days",
    templateId: 9,
    triggerEvents: ["cron"],
    scheduleOnEvents: ["clientSale.created"],
    timingKind: "days_before_expiry",
    timingOffsetDays: 3,
    filters: {
      packageNameIncludes: INTRO_PASS_TOKENS,
      visitCountMode: "signed_in",
      includeClassPassVisits: false,
      classPassNameIncludes: CLASS_PASS_TOKENS,
    },
    skipRules: {
      skipIfAlreadySent: true,
      skipIfMembership: true,
      membershipContractNames: [],
      minVisits: 1,
      visitCountScope: "intro_pass",
      skipIfPassExpired: true,
      includeVisitsInData: true,
    },
    extraRecipient: null,
    notes:
      "Sends on the Sydney day that is exactly 3 days before the intro pass expiry, when visits are at least 1. Template data includes visits for listmonk template 9.",
  }),
  email({
    id: 6,
    key: "trial-expiring-1-day-one-visit",
    name: "Trial expiring 1 day (1 visit)",
    templateId: 10,
    triggerEvents: ["cron"],
    scheduleOnEvents: ["clientSale.created"],
    timingKind: "days_before_expiry",
    timingOffsetDays: 1,
    filters: {
      packageNameIncludes: INTRO_PASS_TOKENS,
      visitCountMode: "signed_in",
      includeClassPassVisits: false,
      classPassNameIncludes: CLASS_PASS_TOKENS,
    },
    skipRules: {
      skipIfAlreadySent: true,
      skipIfMembership: true,
      membershipContractNames: [],
      exactVisits: 1,
      visitCountScope: "intro_pass",
      skipIfPassExpired: true,
    },
    extraRecipient: null,
    notes: "Sends on the Sydney day that is exactly 1 day before intro pass expiry, and only when the visit count is exactly 1.",
  }),
  email({
    id: 7,
    key: "membership-purchase",
    name: "Membership welcome",
    templateId: 11,
    triggerEvents: ["clientContract.created"],
    scheduleOnEvents: [],
    timingKind: "immediate",
    timingOffsetDays: null,
    filters: {
      contractNames: [],
    },
    skipRules: {
      skipIfAlreadySent: true,
    },
    extraRecipient: null,
    notes:
      "LoyalSnap filters to one of 11 contracts; the spec says 11-17 and the exact names were not in the inventory. An empty contractNames list matches nothing, so every contract is skipped until the names are saved on this row.",
  }),
  email({
    id: 8,
    key: "member-google-review",
    name: "Google review (email)",
    templateId: 12,
    triggerEvents: ["classRosterBookingStatus.updated"],
    scheduleOnEvents: [],
    timingKind: "immediate",
    timingOffsetDays: null,
    filters: {
      signedInStatus: "SignedIn",
      visitCountMode: "signed_in",
      includeClassPassVisits: true,
      classPassNameIncludes: CLASS_PASS_TOKENS,
    },
    skipRules: {
      skipIfAlreadySent: true,
      exactVisits: 3,
      visitCountScope: "all",
    },
    extraRecipient: null,
    notes:
      "LoyalSnap has no package filter. This is the email, not the text review request. It can fire on the same third visit as the trial offer. A short count stays pending for the morning cron.",
  }),
  email({
    id: 9,
    key: "classpass-welcome",
    name: "ClassPass welcome",
    templateId: 13,
    triggerEvents: ["client.created", "classRosterBooking.created"],
    scheduleOnEvents: [],
    timingKind: "immediate",
    timingOffsetDays: null,
    filters: {
      packageNameIncludes: CLASS_PASS_TOKENS,
    },
    skipRules: {
      skipIfAlreadySent: true,
      skipIfWaiverSigned: true,
    },
    extraRecipient: null,
    notes:
      "Matches a ClassPass item on the client or the booking. Skips when Mindbody isLiabilityReleased is already true. Confirm that flag is the KAN-13 waiver. The waiver URL itself stays in listmonk template 13.",
  }),
  sms({
    id: 10,
    key: "trial-day-7-no-booking",
    name: "Trial day 7 – no class booked",
    messageText: SMS_DAY_7,
    triggerEvents: ["cron"],
    scheduleOnEvents: ["clientSale.created"],
    timingKind: "delay_days",
    timingOffsetDays: 7,
    filters: {
      packageNameIncludes: INTRO_PASS_TOKENS,
      visitCountMode: "booked",
      includeClassPassVisits: true,
    },
    skipRules: {
      skipIfAlreadySent: true,
      skipIfHasBooking: true,
      visitCountScope: "all",
    },
    extraRecipient: null,
    notes:
      "LoyalSnap text 561548. Wording copied from the LoyalSnap inventory captured 11 Oct 2026. LoyalSnap sent this as WhatsApp/text; this row sends SMS via Twilio. Skips when any non-cancelled visit, including a future booking, is already on the client. Historical visits in the fetched window also count as booked.",
  }),
  sms({
    id: 11,
    key: "trial-google-review-text",
    name: "Google review (text)",
    messageText: SMS_GOOGLE_REVIEW,
    triggerEvents: ["classRosterBookingStatus.updated"],
    scheduleOnEvents: [],
    timingKind: "immediate",
    timingOffsetDays: null,
    filters: {
      packageNameIncludes: INTRO_PASS_TOKENS,
      signedInStatus: "SignedIn",
      visitCountMode: "signed_in",
      includeClassPassVisits: false,
      classPassNameIncludes: CLASS_PASS_TOKENS,
    },
    skipRules: {
      skipIfAlreadySent: true,
      exactVisits: 3,
      visitCountScope: "intro_pass",
    },
    extraRecipient: null,
    notes:
      "LoyalSnap text 561561, Intro Offer Google review. Wording copied from the LoyalSnap inventory. The email review request is automation 8 and has no package filter. This text is limited to intro-pass visits. A short count stays pending for the morning cron. Quiet hours hold the send until the next allowed minute.",
  }),
  sms({
    id: 12,
    key: "trial-expiring-1-day-text",
    name: "Trial expiring 1 day (text)",
    messageText: SMS_EXPIRING_1_DAY,
    triggerEvents: ["cron"],
    scheduleOnEvents: ["clientSale.created"],
    timingKind: "days_before_expiry",
    timingOffsetDays: 1,
    filters: {
      packageNameIncludes: INTRO_PASS_TOKENS,
      visitCountMode: "signed_in",
      includeClassPassVisits: false,
      classPassNameIncludes: CLASS_PASS_TOKENS,
    },
    skipRules: {
      skipIfAlreadySent: true,
      minVisits: 1,
      visitCountScope: "intro_pass",
      skipIfPassExpired: true,
    },
    extraRecipient: null,
    notes:
      "LoyalSnap text 561552. At least one intro visit, one day before expiry. Unlike email automation 6, this text does not require exactly one visit and does not skip clients who already have a membership. The LoyalSnap description did not list those skips.",
  }),
  sms({
    id: 13,
    key: "trial-followup-10-day",
    name: "Trial 10-day follow-up (text)",
    messageText: SMS_FOLLOWUP_10,
    triggerEvents: ["cron"],
    scheduleOnEvents: ["clientSale.created"],
    timingKind: "days_after_expiry",
    timingOffsetDays: 10,
    filters: {
      packageNameIncludes: TWO_WEEK_TOKENS,
      visitCountMode: "signed_in",
      includeClassPassVisits: false,
      classPassNameIncludes: CLASS_PASS_TOKENS,
    },
    skipRules: {
      skipIfAlreadySent: true,
    },
    extraRecipient: null,
    notes:
      "LoyalSnap text 561559. Ten Sydney days after a 2 Week Trial expires. The 7-day intro is not included. The LoyalSnap description does not skip memberships. Source channel was WhatsApp/text; this row is SMS.",
  }),
];

export const LOYALSNAP_LIVE_KEYS = new Set(SEED_AUTOMATIONS.map((automation) => automation.key));

SEED_AUTOMATIONS.push(...COVERAGE_AUTOMATIONS);

export function findSeed(key: string): Automation {
  const found = SEED_AUTOMATIONS.find((automation) => automation.key === key);
  if (!found) throw new Error(`missing seed automation ${key}`);
  return structuredClone(found);
}

export function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export function seedInsertSql(automation: Automation, at = SEED_AT): string {
  const offset = automation.timingOffsetDays === null ? "NULL" : String(automation.timingOffsetDays);
  const extra = automation.extraRecipient === null ? "NULL" : sqlString(automation.extraRecipient);
  const notes = automation.notes === null ? "NULL" : sqlString(automation.notes);
  const template = automation.templateId === null ? "NULL" : String(automation.templateId);
  const message = automation.messageText === null ? "NULL" : sqlString(automation.messageText);
  return `INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  ${automation.id},
  ${sqlString(automation.key)},
  ${sqlString(automation.name)},
  ${sqlString(automation.channel)},
  ${template},
  ${message},
  ${sqlString(JSON.stringify(automation.triggerEvents))},
  ${sqlString(JSON.stringify(automation.scheduleOnEvents))},
  ${sqlString(automation.timingKind)},
  ${offset},
  ${sqlString(JSON.stringify(automation.filters))},
  ${sqlString(JSON.stringify(automation.skipRules))},
  ${automation.enabled ? 1 : 0},
  ${extra},
  ${notes},
  ${sqlString(at)},
  ${sqlString(at)}
);`;
}
