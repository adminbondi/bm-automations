import type { Automation } from "./types";
import { row, type AuditAutomation, type Spec, SPECS_PART1 } from "./coverage-seed-part1";
import { SPECS_PART2 } from "./coverage-seed-part2";

const SPECS: Spec[] = [...SPECS_PART1, ...SPECS_PART2];

export type { AuditAutomation } from "./coverage-seed-part1";

export const COVERAGE_AUTOMATIONS: Automation[] = SPECS.map(row);

export const SEEDED_AUDIT: AuditAutomation[] = SPECS.map((spec) => ({
  funnel: spec.audit.funnel,
  name: spec.name,
  loyalSnap: spec.audit.loyalSnap,
  key: spec.key,
  trigger: spec.audit.trigger,
  filters: spec.audit.filters,
  delay: spec.audit.delay,
  stop: spec.audit.stop,
  status: spec.audit.status ?? "covered",
  detail: spec.audit.detail,
}));

export const ORIGINAL_AUDIT: AuditAutomation[] = [
  { funnel: "Lead", name: "Leads followup - immediate", loyalSnap: "on", key: "lead-immediate", trigger: "client.created", filters: "none", delay: "immediately", stop: "skip if they already have an intro or any purchase", status: "covered", detail: "D1 lead-immediate, listmonk template 5. skipIfHasIntroOrAnyPurchase." },
  { funnel: "Lead", name: "Leads followup - day 60", loyalSnap: "on", key: "lead-day-60", trigger: "client.created", filters: "none", delay: "60 days after creation", stop: "skip if they have visited, purchased, or unsubscribed", status: "covered", detail: "D1 lead-day-60, template 6. delay_days 60. Morning cron rechecks." },
  { funnel: "Trial", name: "New client redeemed or purchased their Trial", loyalSnap: "on", key: "trial-purchased", trigger: "clientSale.created", filters: "intro pass name contains 2-week, 7-day, or intro pass", delay: "immediately", stop: "one send", status: "covered", detail: "D1 trial-purchased, template 7. packageNameIncludes intro tokens." },
  { funnel: "Trial", name: "Client hasn't taken a class in first 7 days (text)", loyalSnap: "on", key: "trial-day-7-no-booking", trigger: "clientSale.created", filters: "intro pass", delay: "7 days after purchase", stop: "skip if they have a booking or visit", status: "covered", detail: "D1 trial-day-7-no-booking. SMS. delay_days 7, skipIfHasBooking, visit count mode booked." },
  { funnel: "Trial", name: "Google review request (text) - Intro Offer", loyalSnap: "on", key: "trial-google-review-text", trigger: "class sign-in", filters: "intro pass, signed in, ClassPass visits excluded", delay: "immediately", stop: "exactly 3 intro visits", status: "covered", detail: "D1 trial-google-review-text. exactVisits 3, scope intro_pass." },
  { funnel: "Trial", name: "Client took their 3rd class on their Trial", loyalSnap: "on", key: "trial-third-class", trigger: "class sign-in", filters: "intro pass, signed in", delay: "immediately", stop: "exactly 3 intro visits; skip membership once contract names are set", status: "covered", detail: "D1 trial-third-class, template 8. membershipContractNames is empty, so membership is not detected yet." },
  { funnel: "Trial", name: "Trial expiring in 3 days", loyalSnap: "on", key: "trial-expiring-3-days", trigger: "clientSale.created", filters: "intro pass, at least 1 intro visit", delay: "3 days before expiry", stop: "skip membership once names are set; skip if the pass already expired", status: "covered", detail: "D1 trial-expiring-3-days, template 9. days_before_expiry 3, minVisits 1." },
  { funnel: "Trial", name: "Trial expiring in 1 day, 1 session only", loyalSnap: "on", key: "trial-expiring-1-day-one-visit", trigger: "clientSale.created", filters: "intro pass", delay: "1 day before expiry", stop: "exactly 1 intro visit; skip membership once names are set", status: "covered", detail: "D1 trial-expiring-1-day-one-visit, template 10. exactVisits 1." },
  { funnel: "Trial", name: "Trial expiring in 1 day (text)", loyalSnap: "on", key: "trial-expiring-1-day-text", trigger: "clientSale.created", filters: "intro pass, at least 1 visit", delay: "1 day before expiry", stop: "does not skip membership (LoyalSnap did not list that skip)", status: "covered", detail: "D1 trial-expiring-1-day-text. days_before_expiry 1, minVisits 1. Different from email 6 on purpose." },
  { funnel: "Trial", name: "Follow up 10 days after 2-week trial (text)", loyalSnap: "on", key: "trial-followup-10-day", trigger: "clientSale.created", filters: "2-week intro only", delay: "10 days after expiry", stop: "one send; no membership skip", status: "covered", detail: "D1 trial-followup-10-day. days_after_expiry 10, TWO_WEEK tokens." },
  { funnel: "Member", name: "Membership purchase", loyalSnap: "on", key: "membership-purchase", trigger: "clientContract.created", filters: "one of 11 contracts (names were not in the export)", delay: "immediately", stop: "one send", status: "covered", detail: "D1 membership-purchase, template 11. Empty contractNames matches nothing until the names are saved." },
  { funnel: "Member", name: "Google review request", loyalSnap: "on", key: "member-google-review", trigger: "class sign-in", filters: "signed in, no package filter", delay: "immediately", stop: "exactly 3 signed-in visits", status: "covered", detail: "D1 member-google-review, template 12. exactVisits 3, scope all." },
  { funnel: "ClassPass", name: "ClassPass Welcome (ID 570472)", loyalSnap: "on", key: "classpass-welcome", trigger: "client.created or classRosterBooking.created", filters: "ClassPass package", delay: "immediately", stop: "skip if the waiver is already signed", status: "covered", detail: "D1 classpass-welcome, template 13. skipIfWaiverSigned." },
];
