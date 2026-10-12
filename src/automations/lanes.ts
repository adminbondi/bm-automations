function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

/** LoyalSnap funnel lanes, in the order Thiago approved. `Other` holds a row with no funnel. */
export const LANE_ORDER: { name: string; description: string; expanded: boolean }[] = [
  {
    name: "LEAD FUNNEL",
    description: "Automations for Leads who haven't yet booked or taken a class",
    expanded: true,
  },
  {
    name: "TRIAL FUNNEL",
    description: "Rules related to clients on a trial / intro offer",
    expanded: true,
  },
  {
    name: "External Leads / Facebook Leads",
    description: "Convert leads into paying clients.",
    expanded: true,
  },
  {
    name: "MEMBER FUNNEL",
    description: "ENGAGEMENT WITH YOUR MEMBERS",
    expanded: true,
  },
  {
    name: "LAPSED CLIENT FUNNEL",
    description: "Follow up with lapsed clients, and bring them back.",
    expanded: false,
  },
  { name: "UNUSED FUNNELS", description: "", expanded: false },
  {
    name: "CLASS PACKS FUNNEL",
    description: "Notify valued clients that their packages are running out.",
    expanded: false,
  },
  {
    name: "CLASSPASS",
    description: "Follow-up with clients using ClassPass packages.",
    expanded: true,
  },
  {
    name: "BIRTHDAY",
    description: "Message clients for their birthdays.",
    expanded: false,
  },
  {
    name: "Other",
    description: "Automations that are not in a LoyalSnap funnel.",
    expanded: true,
  },
];

export type LaneStep = {
  key: string;
  funnel: string;
  timingLabel: string;
};

/**
 * LoyalSnap step order within each funnel. Timing labels are the sketch labels.
 * Birthday steps and classpass-two-in-two-weeks are still unconfirmed by Thiago.
 */
export const LANE_STEPS: LaneStep[] = [
  { key: "lead-immediate", funnel: "LEAD FUNNEL", timingLabel: "Day 0" },
  { key: "lead-day-2-text", funnel: "LEAD FUNNEL", timingLabel: "+2 days" },
  { key: "lead-day-7-text", funnel: "LEAD FUNNEL", timingLabel: "+7 days" },
  { key: "lead-day-14", funnel: "LEAD FUNNEL", timingLabel: "+14 days" },
  { key: "lead-day-60", funnel: "LEAD FUNNEL", timingLabel: "+60 days" },
  { key: "lead-day-90", funnel: "LEAD FUNNEL", timingLabel: "+90 days" },
  { key: "lead-day-120", funnel: "LEAD FUNNEL", timingLabel: "+120 days" },
  { key: "lead-day-150", funnel: "LEAD FUNNEL", timingLabel: "+150 days" },

  { key: "trial-purchased", funnel: "TRIAL FUNNEL", timingLabel: "Day 0" },
  { key: "trial-day-2-no-booking", funnel: "TRIAL FUNNEL", timingLabel: "+2 days" },
  { key: "trial-day-7-no-booking", funnel: "TRIAL FUNNEL", timingLabel: "+7 days" },
  { key: "trial-google-review-text", funnel: "TRIAL FUNNEL", timingLabel: "Visit 3" },
  { key: "trial-third-class", funnel: "TRIAL FUNNEL", timingLabel: "Visit 3" },
  { key: "trial-third-visit-text", funnel: "TRIAL FUNNEL", timingLabel: "Visit 3" },
  { key: "trial-expiring-3-days", funnel: "TRIAL FUNNEL", timingLabel: "Expiry −3d" },
  { key: "trial-expiring-1-day-one-visit", funnel: "TRIAL FUNNEL", timingLabel: "Expiry −1d" },
  { key: "trial-expiring-1-day-text", funnel: "TRIAL FUNNEL", timingLabel: "Expiry −1d" },
  { key: "trial-followup-10-day", funnel: "TRIAL FUNNEL", timingLabel: "Expiry +10d" },

  { key: "external-immediate", funnel: "External Leads / Facebook Leads", timingLabel: "Day 0" },
  { key: "external-immediate-text", funnel: "External Leads / Facebook Leads", timingLabel: "Day 0" },
  { key: "external-day-2", funnel: "External Leads / Facebook Leads", timingLabel: "+2 days" },
  { key: "external-day-5-text", funnel: "External Leads / Facebook Leads", timingLabel: "+5 days" },
  { key: "external-day-7-text", funnel: "External Leads / Facebook Leads", timingLabel: "+7 days" },
  { key: "external-day-10", funnel: "External Leads / Facebook Leads", timingLabel: "+10 days" },
  { key: "external-day-10-text", funnel: "External Leads / Facebook Leads", timingLabel: "+10 days" },
  { key: "external-day-14", funnel: "External Leads / Facebook Leads", timingLabel: "+14 days" },
  { key: "external-day-30-text", funnel: "External Leads / Facebook Leads", timingLabel: "+30 days" },
  { key: "external-day-60", funnel: "External Leads / Facebook Leads", timingLabel: "+60 days" },

  { key: "membership-purchase", funnel: "MEMBER FUNNEL", timingLabel: "Day 0" },
  { key: "member-google-review", funnel: "MEMBER FUNNEL", timingLabel: "Visit 3" },
  { key: "member-referral-7th-text", funnel: "MEMBER FUNNEL", timingLabel: "Visit 7" },
  { key: "member-referral-every-35", funnel: "MEMBER FUNNEL", timingLabel: "Every 35 visits" },
  { key: "member-absent-7-text", funnel: "MEMBER FUNNEL", timingLabel: "+7d since last visit" },
  { key: "anniversary-99", funnel: "MEMBER FUNNEL", timingLabel: "Visit 99" },
  { key: "anniversary-100-text", funnel: "MEMBER FUNNEL", timingLabel: "Visit 100" },
  { key: "anniversary-249", funnel: "MEMBER FUNNEL", timingLabel: "Visit 249" },
  { key: "anniversary-250-text", funnel: "MEMBER FUNNEL", timingLabel: "Visit 250" },
  { key: "anniversary-499", funnel: "MEMBER FUNNEL", timingLabel: "Visit 499" },
  { key: "anniversary-500-text", funnel: "MEMBER FUNNEL", timingLabel: "Visit 500" },

  { key: "trial-expired-3-days", funnel: "LAPSED CLIENT FUNNEL", timingLabel: "Expiry +3d" },
  { key: "trial-expired-5-days-text", funnel: "LAPSED CLIENT FUNNEL", timingLabel: "Expiry +5d" },
  { key: "lapsed-30-days", funnel: "LAPSED CLIENT FUNNEL", timingLabel: "+30d since last visit" },
  { key: "lapsed-60-days", funnel: "LAPSED CLIENT FUNNEL", timingLabel: "+60d since last visit" },
  { key: "lapsed-90-days", funnel: "LAPSED CLIENT FUNNEL", timingLabel: "+90d since last visit" },
  { key: "lapsed-180-days", funnel: "LAPSED CLIENT FUNNEL", timingLabel: "+180d since last visit" },
  { key: "lapsed-210-days", funnel: "LAPSED CLIENT FUNNEL", timingLabel: "+210d since last visit" },
  { key: "lapsed-240-days", funnel: "LAPSED CLIENT FUNNEL", timingLabel: "+240d since last visit" },
  { key: "lapsed-270-days", funnel: "LAPSED CLIENT FUNNEL", timingLabel: "+270d since last visit" },
  { key: "lapsed-300-days", funnel: "LAPSED CLIENT FUNNEL", timingLabel: "+300d since last visit" },
  { key: "lapsed-330-days", funnel: "LAPSED CLIENT FUNNEL", timingLabel: "+330d since last visit" },
  { key: "lapsed-360-days", funnel: "LAPSED CLIENT FUNNEL", timingLabel: "+360d since last visit" },

  { key: "unused-lead-immediate-text", funnel: "UNUSED FUNNELS", timingLabel: "Day 0" },
  { key: "unused-trial-purchased-text", funnel: "UNUSED FUNNELS", timingLabel: "Day 0" },
  { key: "unused-first-class-text", funnel: "UNUSED FUNNELS", timingLabel: "Visit 1" },
  { key: "unused-trial-just-expired", funnel: "UNUSED FUNNELS", timingLabel: "Expiry day" },

  { key: "pack-welcome", funnel: "CLASS PACKS FUNNEL", timingLabel: "Day 0" },
  { key: "pack-expiring-3-days", funnel: "CLASS PACKS FUNNEL", timingLabel: "Expiry −3d" },
  { key: "pack-two-remaining", funnel: "CLASS PACKS FUNNEL", timingLabel: "2 classes left" },
  { key: "pack-none-remaining", funnel: "CLASS PACKS FUNNEL", timingLabel: "0 classes left" },
  { key: "pack-none-remaining-text", funnel: "CLASS PACKS FUNNEL", timingLabel: "0 classes left" },
  { key: "pack-expired-5-days", funnel: "CLASS PACKS FUNNEL", timingLabel: "Expiry +5d" },
  { key: "pack-expired-30-days", funnel: "CLASS PACKS FUNNEL", timingLabel: "Expiry +1 month" },
  { key: "red-flag-under-3-credits", funnel: "CLASS PACKS FUNNEL", timingLabel: "Under 3 credits" },

  { key: "classpass-welcome", funnel: "CLASSPASS", timingLabel: "Day 0" },
  { key: "classpass-first-class", funnel: "CLASSPASS", timingLabel: "Visit 1" },
  { key: "classpass-5-classes", funnel: "CLASSPASS", timingLabel: "Visit 5" },
  { key: "classpass-two-in-two-weeks", funnel: "CLASSPASS", timingLabel: "2+ visits / 14d" },
  { key: "classpass-10-classes", funnel: "CLASSPASS", timingLabel: "Visit 10" },

  { key: "birthday-month-text", funnel: "BIRTHDAY", timingLabel: "Birthday" },
  { key: "birthday-month-email", funnel: "BIRTHDAY", timingLabel: "Day 0" },
  { key: "birthday-day-text", funnel: "BIRTHDAY", timingLabel: "Birthday" },
  { key: "birthday-day-email", funnel: "BIRTHDAY", timingLabel: "Birthday" },
];

/** Sketch labels Thiago has not confirmed. The rows still send on the timings already stored. */
export const UNCONFIRMED_TIMING_KEYS = [
  "classpass-two-in-two-weeks",
  "birthday-month-text",
  "birthday-month-email",
  "birthday-day-text",
  "birthday-day-email",
] as const;

export function lanePlacements(): (LaneStep & { position: number })[] {
  const seen = new Set<string>();
  const counts = new Map<string, number>();
  return LANE_STEPS.map((step) => {
    if (seen.has(step.key)) throw new Error(`duplicate lane step ${step.key}`);
    seen.add(step.key);
    if (!LANE_ORDER.some((lane) => lane.name === step.funnel)) throw new Error(`unknown funnel ${step.funnel}`);
    const position = (counts.get(step.funnel) ?? 0) + 1;
    counts.set(step.funnel, position);
    return { ...step, position };
  });
}

export function funnelMigrationSql(): string {
  const lanes = LANE_ORDER.map(
    (lane, index) =>
      `INSERT INTO funnels (name, position, description, expanded) VALUES (${sqlString(lane.name)}, ${index + 1}, ${sqlString(lane.description)}, ${lane.expanded ? 1 : 0});`,
  ).join("\n\n");
  const updates = lanePlacements()
    .map(
      (step) =>
        `UPDATE automations SET funnel = ${sqlString(step.funnel)}, position = ${step.position}, timing_label = ${sqlString(step.timingLabel)} WHERE key = ${sqlString(step.key)};`,
    )
    .join("\n");
  return `-- LoyalSnap funnel lanes for the admin Automations screen.
-- Assigns funnel, position, and the timing label shown on each step.
-- Does not change the on/off flag.

ALTER TABLE automations ADD COLUMN funnel TEXT;
ALTER TABLE automations ADD COLUMN position INTEGER;
ALTER TABLE automations ADD COLUMN timing_label TEXT;

CREATE TABLE IF NOT EXISTS funnels (
  name TEXT PRIMARY KEY,
  position INTEGER NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  expanded INTEGER NOT NULL DEFAULT 0
);

${lanes}

${updates}
`;
}
