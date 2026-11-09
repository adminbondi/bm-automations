import type { Automation, AutomationFilters, AutomationSkipRules, TimingKind } from "./types";

export const INTRO = ["2 week", "2-week", "7 day", "7-day", "intro pass"];
export const CLASS_PASS = ["classpass", "class pass"];
export const SEEN = ["client.created", "clientSale.created", "clientContract.created", "classRosterBooking.created", "classRosterBookingStatus.updated", "lead.created"];

export const SMS = {
  leadDay2: "Hi [First name], it's Thiago & Yvette from [Studio]! Do you have any questions about getting started on our intro offer?",
  leadDay7: "Hi [First name], really looking forward to connecting about [Studio]! Is AM or PM better for you to chat?",
  trialDay2: "Hi [First name], it's Thiago & Yvette from [Studio]. Happy to help you book into your first class- do you like morning or evening workouts?",
  trialThird: "Hi [First name], It'sThiago & Yvette at [Studio].",
  externalNow: "Hey [First name], Thanks for checking out [Studio] 💪 I just sent you an email, but I'd love to chat more about your goals. Are you free for a call? Reply STOP and I won't text again.",
  externalDay5: "Hey [First name], it seems like you are not interested in training with us, but we'd love to help! Reply back to start -[Studio]",
  externalDay7: "Hi [First name] 😊 Just checking in again. I'd love to have you workout with us. Would you be interested in a FREE training session?",
  externalDay10: "Hey [First name], we would love to see you train at [Studio].",
  externalDay30: "Hey [First name], it seems like you're really busy or no longer interested in working out with us. We won't text you again, but feel free to reach out anytime 😊",
  referral: "Hi [First name], it's Thiago & Yvette at [Studio]! Working out with a friend is always more fun! All members receive a 10% discount on their membership when they refer a friend and they join. Did you want to know more?",
  absent7: "Hi [First name]! We haven't seen you at [Studio] in about a week.  When will we see you back in the studio?",
  class100: "[First name], you just took your 100th class with us [Studio] Congratulations! Keep up the hard work! When are you free to pick up your 100 CLUB VEST?",
  class250: "CONGRATS [First name], You just took your 250th class with us at [Studio]!! when can you come in to pick up your 250 CLUB VEST and set up your introduction to the 'WALL OF FAME\"?",
  class500: "WELL DONE [First name], you just took your 500th class with us at [Studio]. There is no stopping you now! When are you free to collect your 500 CLUB VEST and introduction to the 500 CLUB PLAQUE?",
  trial5: "Hi [First name], It'sThiago & Yvette at [Studio]. Your Intro Offer with us ran out a few days ago. Can I give you a call to chat about next steps for your fitness journey?",
  leadNow: "Hi [First name], it's Thiago & Yvette at [Studio]! We're looking forward to seeing you in the studio. Do you have any questions about getting started?",
  trialNow: "Hi [First name], it's Thiago & Yvette at [Studio] here. We're so excited to see you in the studio. Have you booked your first class yet?",
  firstClass: "Hey [First name], it's Thiago & Yvette. Congrats on taking your first class with us at [Studio]! How do you feel?",
  packEmpty: "Hi [First name], it looks like you Class Pack just expired at [Studio] - We can't have you running on empty! Would you like me to set up your account with the same as last time?",
  birthdayMonth: "Hey [First name]! Your birthday will be here before you know it. We'd love to celebrate with you in person if you'll be around. Let us know so we can get you booked 🎁!",
  birthdayDay: "Hey [First name]! Word on the street is it's your birthday 👀. Happy birthday from everyone at [Studio]. Hope you have an amazing day!",
};

export type AuditAutomation = {
  funnel: string;
  name: string;
  loyalSnap: "on" | "off";
  key: string;
  trigger: string;
  filters: string;
  delay: string;
  stop: string;
  status: "covered" | "gap";
  detail: string;
};

export type Spec = {
  id: number;
  key: string;
  name: string;
  channel: "email" | "sms";
  templateId?: number | null;
  messageText?: string | null;
  triggerEvents: string[];
  scheduleOnEvents?: string[];
  timingKind: TimingKind;
  timingOffsetDays?: number | null;
  filters?: AutomationFilters;
  skipRules?: AutomationSkipRules;
  notes: string;
  audit: Omit<AuditAutomation, "key" | "name" | "status"> & { status?: "covered" | "gap" };
};

export function row(spec: Spec): Automation {
  return {
    id: spec.id,
    key: spec.key,
    name: spec.name,
    channel: spec.channel,
    templateId: spec.channel === "sms" ? null : spec.templateId ?? null,
    messageText: spec.channel === "sms" ? spec.messageText ?? null : null,
    triggerEvents: spec.triggerEvents,
    scheduleOnEvents: spec.scheduleOnEvents ?? [],
    timingKind: spec.timingKind,
    timingOffsetDays: spec.timingKind === "immediate" ? null : spec.timingOffsetDays ?? 0,
    filters: spec.filters ?? {},
    skipRules: { skipIfAlreadySent: true, ...(spec.skipRules ?? {}) },
    enabled: false,
    extraRecipient: null,
    notes: spec.notes,
  };
}

export const leadDelay = (id: number, key: string, name: string, days: number, channel: "email" | "sms", message: string | null, subject: string): Spec => ({
  id,
  key,
  name,
  channel,
  messageText: message,
  triggerEvents: ["cron"],
  scheduleOnEvents: ["client.created"],
  timingKind: "delay_days",
  timingOffsetDays: days,
  notes: `${subject} LoyalSnap had this switched off. No listmonk template id was captured, so an email row stays without a template until an owner sets one. Enabling it before that holds the job with template_missing.`,
  audit: {
    funnel: "Lead",
    loyalSnap: "off",
    trigger: "client.created",
    filters: "none (last-contact filter was off)",
    delay: `${days} days after creation`,
    stop: "one send per client",
    detail: `D1 ${key}. timing delay_days ${days}, scheduled from client.created, cron rechecks before sending.`,
  },
});

export const external = (id: number, key: string, name: string, days: number | null, channel: "email" | "sms", message: string | null, subject: string): Spec => ({
  id,
  key,
  name,
  channel,
  messageText: message,
  triggerEvents: days === null ? ["lead.created"] : ["cron"],
  scheduleOnEvents: days === null ? [] : ["lead.created"],
  timingKind: days === null ? "immediate" : "delay_days",
  timingOffsetDays: days,
  notes: `${subject} Posts to POST /webhooks/lead with X-Lead-Token (LEAD_WEBHOOK_SECRET). Nothing in Mindbody emits this event. The row does nothing until a source sends lead.created. Facebook itself is not connected.`,
  audit: {
    funnel: "External leads",
    loyalSnap: "off",
    trigger: "lead.created (after their information is received)",
    filters: "none (last-contact filter was off)",
    delay: days === null ? "immediately" : `${days} days after the lead is received`,
    stop: "one send per client",
    detail: `D1 ${key}. Trigger lead.created. ${days === null ? "Immediate." : `delay_days ${days}, morning cron rechecks.`}`,
  },
});

export const absent = (id: number, days: number, subject: string): Spec => ({
  id,
  key: `lapsed-${days}-days`,
  name: `Lapsed ${days} days`,
  channel: "email",
  triggerEvents: ["cron"],
  scheduleOnEvents: ["classRosterBookingStatus.updated"],
  timingKind: "days_since_last_visit",
  timingOffsetDays: days,
  filters: { visitCountMode: "signed_in", clientActivity: "inactive" },
  notes: `${subject} A new signed-in visit moves the pending job to last visit + ${days} days. Inactive means no contract and no current unexpired service. Email template is unset.`,
  audit: {
    funnel: "Lapsed",
    loyalSnap: "off",
    trigger: "class sign-in, then the morning cron",
    filters: "inactive client",
    delay: `${days} days after the last visit`,
    stop: "one send per absence; a newer visit reschedules the job",
    detail: `D1 lapsed-${days}-days. timing days_since_last_visit ${days}, clientActivity inactive. Visit start dates come from Mindbody StartDateTime.`,
  },
});

export const anniversary = (id: number, visits: number, channel: "email" | "sms", message: string | null, subject: string): Spec => ({
  id,
  key: `anniversary-${visits}${channel === "sms" ? "-text" : ""}`,
  name: `${visits}th class${channel === "sms" ? " (text)" : ""}`,
  channel,
  messageText: message,
  triggerEvents: ["classRosterBookingStatus.updated"],
  timingKind: "immediate",
  filters: { signedInStatus: "SignedIn", visitCountMode: "signed_in" },
  skipRules: { exactVisits: visits },
  notes: `${subject} listmonk /api/tx cannot CC bondi@balancemoves.com.au. extra_recipient stays empty. A short visit count stays pending for the morning cron.`,
  audit: {
    funnel: "Member",
    loyalSnap: "off",
    trigger: "class sign-in",
    filters: "signed in",
    delay: "immediately on that visit",
    stop: `exactly ${visits} signed-in visits; one send`,
    detail: `D1 anniversary-${visits}${channel === "sms" ? "-text" : ""}. exactVisits ${visits}. CC to bondi@ is not available on /api/tx.`,
  },
});

export const SPECS_PART1A: Spec[] = [
  leadDelay(14, "lead-day-2-text", "Lead day 2 (text)", 2, "sms", SMS.leadDay2, "LoyalSnap text, off."),
  leadDelay(15, "lead-day-7-text", "Lead day 7 (text)", 7, "sms", SMS.leadDay7, "LoyalSnap text, off."),
  leadDelay(16, "lead-day-14", "Lead day 14", 14, "email", null, "Subject: Register NOW for a Complimentary Session. LoyalSnap template Leads followup - day 14-Oxigen."),
  leadDelay(17, "lead-day-90", "Lead day 90", 90, "email", null, "Subject: Is now a better time? LoyalSnap template Leads followup - day 90-Oxigen."),
  leadDelay(18, "lead-day-120", "Lead day 120", 120, "email", null, "LoyalSnap titled this 'every 30 days' but the description is 120 days after creation, not a loop. Subject: let's start your fitness journey."),
  leadDelay(19, "lead-day-150", "Lead day 150", 150, "email", null, "LoyalSnap titled this 'every 30 days' but the description is 150 days after creation, not a loop."),
  {
    id: 20,
    key: "trial-day-2-no-booking",
    name: "Trial day 2 – no class booked",
    channel: "sms",
    messageText: SMS.trialDay2,
    triggerEvents: ["cron"],
    scheduleOnEvents: ["clientSale.created"],
    timingKind: "delay_days",
    timingOffsetDays: 2,
    filters: { packageNameIncludes: INTRO, visitCountMode: "booked" },
    skipRules: { skipIfHasBooking: true },
    notes: "Off LoyalSnap text. Same booking skip as the day-7 text, two days after the intro purchase.",
    audit: {
      funnel: "Trial",
      loyalSnap: "off",
      trigger: "clientSale.created",
      filters: "intro pass",
      delay: "2 days after purchase",
      stop: "skip when any non-cancelled visit or booking exists",
      detail: "D1 trial-day-2-no-booking. delay_days 2, skipIfHasBooking, intro tokens.",
    },
  },
  {
    id: 21,
    key: "trial-third-visit-text",
    name: "Trial 3rd visit (text)",
    channel: "sms",
    messageText: SMS.trialThird,
    triggerEvents: ["classRosterBookingStatus.updated"],
    timingKind: "immediate",
    filters: { packageNameIncludes: [], signedInStatus: "SignedIn", visitCountMode: "signed_in" },
    skipRules: { exactVisits: 3 },
    notes: "Off LoyalSnap text. The inventory says one of 5 packages and the message is a placeholder. packageNameIncludes is empty, so the row matches nothing until those names are saved. Copy is stored as LoyalSnap had it, including 'It'sThiago' with no space.",
    audit: {
      funnel: "Trial",
      loyalSnap: "off",
      trigger: "class sign-in",
      filters: "one of 5 packages (names were not in the export)",
      delay: "immediately on the 3rd visit",
      stop: "exactly 3 signed-in visits",
      detail: "D1 trial-third-visit-text. exactVisits 3. Empty packageNameIncludes fails closed until the 5 names are saved.",
    },
  },
  external(22, "external-immediate", "External lead welcome", null, "email", null, "Subject: Welcome! LoyalSnap template lead-immediate-external."),
  external(23, "external-immediate-text", "External lead welcome (text)", null, "sms", SMS.externalNow, "LoyalSnap text, off. The body already contains Reply STOP, so the footer setting will not add a second line."),
  external(24, "external-day-2", "External lead day 2", 2, "email", null, "Subject: We can't wait to meet you!"),
  external(25, "external-day-5-text", "External lead day 5 (text)", 5, "sms", SMS.externalDay5, "LoyalSnap text, off."),
  external(26, "external-day-7-text", "External lead day 7 (text)", 7, "sms", SMS.externalDay7, "LoyalSnap text, off."),
  external(27, "external-day-10", "External lead day 10", 10, "email", null, "Subject: let's get you all set."),
  external(28, "external-day-10-text", "External lead day 10 (text)", 10, "sms", SMS.externalDay10, "LoyalSnap text, off."),
  external(29, "external-day-14", "External lead day 14", 14, "email", null, "Subject: Are you ready? We are!"),
  external(30, "external-day-30-text", "External lead day 30 (text)", 30, "sms", SMS.externalDay30, "LoyalSnap text, off."),
  external(31, "external-day-60", "External lead day 60", 60, "email", null, "Subject: keep health and fitness a top priority."),
  {
    id: 32,
    key: "member-referral-7th-text",
    name: "Referral after 7th visit (text)",
    channel: "sms",
    messageText: SMS.referral,
    triggerEvents: ["classRosterBookingStatus.updated"],
    timingKind: "immediate",
    filters: { signedInStatus: "SignedIn", visitCountMode: "signed_in" },
    skipRules: { exactVisits: 7 },
    notes: "Off LoyalSnap text after the 7th signed-in visit.",
    audit: {
      funnel: "Member",
      loyalSnap: "off",
      trigger: "class sign-in",
      filters: "signed in",
      delay: "immediately",
      stop: "exactly 7 visits",
      detail: "D1 member-referral-7th-text. exactVisits 7.",
    },
  },
  {
    id: 33,
    key: "member-referral-every-35",
    name: "Referral every 35 visits",
    channel: "email",
    triggerEvents: ["classRosterBookingStatus.updated"],
    timingKind: "immediate",
    filters: { packageNameIncludes: [], signedInStatus: "SignedIn", visitCountMode: "signed_in" },
    skipRules: { everyNthVisit: 35, dedupeScope: "visit_milestone" },
    notes: "Subject: Bring a friend for free! LoyalSnap limited this to 74 packages. Those names were not in the export, so packageNameIncludes is empty and the row matches nothing until they are saved. Dedupe is per visit milestone (35, 70, …), not once per client.",
    audit: {
      funnel: "Member",
      loyalSnap: "off",
      trigger: "class sign-in",
      filters: "one of 74 packages (names were not in the export)",
      delay: "immediately when visits are a multiple of 35",
      stop: "send again at each multiple; not a single lifetime send",
      detail: "D1 member-referral-every-35. everyNthVisit 35, dedupeScope visit_milestone. Empty package list fails closed.",
    },
  },
  {
    id: 34,
    key: "member-absent-7-text",
    name: "7 days since last class (text)",
    channel: "sms",
    messageText: SMS.absent7,
    triggerEvents: ["cron"],
    scheduleOnEvents: ["classRosterBookingStatus.updated"],
    timingKind: "days_since_last_visit",
    timingOffsetDays: 7,
    filters: { visitCountMode: "signed_in", clientActivity: "active" },
    notes: "Off LoyalSnap text for an active client. Active means a contract on file or a current service that has not expired. A newer visit reschedules the job.",
    audit: {
      funnel: "Member",
      loyalSnap: "off",
      trigger: "class sign-in, then the morning cron",
      filters: "active client",
      delay: "7 days after the last visit",
      stop: "one send for that absence; a newer visit reschedules",
      detail: "D1 member-absent-7-text. days_since_last_visit 7, clientActivity active.",
    },
  }
];
