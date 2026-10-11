import type { SegmentFilter } from "./match";
import { STATIC_CLIENT_LISTS } from "./static-lists";

export type SegmentRow = {
  kind: "lane" | "dynamic" | "static";
  name: string;
  loyalSnap: string;
  status: "covered" | "gap";
  trigger: string;
  filters: string;
  delay: string;
  stop: string;
  detail: string;
  filter: SegmentFilter | null;
};

const lane = (
  name: string,
  filters: string,
  detail: string,
  filter: SegmentFilter | null,
  status: "covered" | "gap" = "covered",
): SegmentRow => ({
  kind: "lane",
  name,
  loyalSnap: "staff script",
  status,
  trigger: "task dashboard audience, not a send",
  filters,
  delay: "none",
  stop: "not an automation; Tasks still links to the task dashboard",
  detail,
  filter,
});

export const LANES: SegmentRow[] = [
  lane("LEADS - LAST 24 HRS", "created in the last 1 day, no purchase", "matchSegment createdWithinDays 1, noPurchase. Scripts stay on the task dashboard.", { createdWithinDays: 1, noPurchase: true }),
  lane("LEADS - LAST 7 DAYS", "created in the last 7 days, no purchase", "matchSegment createdWithinDays 7, noPurchase.", { createdWithinDays: 7, noPurchase: true }),
  lane("LEADS - LAST 30 DAYS", "created in the last 30 days, no purchase", "matchSegment createdWithinDays 30, noPurchase.", { createdWithinDays: 30, noPurchase: true }),
  lane("PURCHASED A TRIAL", "current intro pass", "matchSegment introCurrent.", { introCurrent: true }),
  lane("TRIAL - HAS NOT BOOKED A SESSION", "current intro, no visit or booking", "matchSegment introCurrent, noBooking.", { introCurrent: true, noBooking: true }),
  lane("FIRST VISIT BOOKED", "a visit that is not cancelled and not signed in", "matchSegment bookedNotSignedIn. A future booking and a past no-sign-in both match; staff still confirm in Mindbody.", { bookedNotSignedIn: true }),
  lane("TRIAL OFFER FIRST VISIT - CALL", "intro, exactly 1 signed-in visit", "The export has the call script, not a numeric window. The saved filter is introCurrent and signedInVisits exactly 1.", { introCurrent: true, signedInVisits: { min: 1, max: 1 } }),
  lane("TRIAL- HAS NOT BOOKED 2ND CLASS", "intro, exactly 1 signed-in visit, no unsigned booking", "matchSegment introCurrent, signedInVisits exactly 1, noUnsignedBooking.", { introCurrent: true, signedInVisits: { min: 1, max: 1 }, noUnsignedBooking: true }),
  lane("ATTENDED SECOND CLASS", "exactly 2 signed-in visits", "matchSegment signedInVisits exactly 2.", { signedInVisits: { min: 2, max: 2 } }),
  lane("TRIAL- HAS NOT BOOKED 3RD CLASS", "intro, exactly 2 signed-in visits, no unsigned booking", "matchSegment introCurrent, signedInVisits exactly 2, noUnsignedBooking.", { introCurrent: true, signedInVisits: { min: 2, max: 2 }, noUnsignedBooking: true }),
  lane("ATTENDED THIRD CLASS", "exactly 3 signed-in visits", "matchSegment signedInVisits exactly 3.", { signedInVisits: { min: 3, max: 3 } }),
  lane("TRIAL OFFER EXPIRING SOON (1-2 VISITS)", "intro, 1 or 2 signed-in visits, expiry today or tomorrow", "The call script says the pass expires today. Filter uses expiringWithinDays 1 and signedInVisits 1–2.", { introCurrent: true, signedInVisits: { min: 1, max: 2 }, expiringWithinDays: 1 }),
  lane("TRIAL/MEMBER HAS NO SHOWED/LATE CANCELLED A CLASS", "late or early cancel dated today", "matchSegment noShowOn, using visit start date plus LateCancelled or EarlyCancelled.", { noShowOn: true }),
  lane("TRIAL OFFER EXPIRING SOON (3+ VISITS)", "intro, at least 3 signed-in visits, expiry today or tomorrow", "Same one-day window as the 1–2 visit lane. signedInVisits min 3.", { introCurrent: true, signedInVisits: { min: 3 }, expiringWithinDays: 1 }),
  lane("TRIAL EXPIRED 2 DAYS AGO", "intro expiry was 2 days ago", "matchSegment expiredDaysAgo 2, intro.", { intro: true, expiredDaysAgo: 2 }),
  lane("PACKS - LOW CREDITS", "current service with at most 4 credits left", "The lane script does not give a number. This uses the same line as the dynamic list 'less than 5 credits': maxRemaining 4.", { maxRemaining: 4 }),
  lane("PACKS & UPFRONTS EXPIRING", "current service expiring within 30 days", "The lane does not give a day count. 30 days matches the dynamic 'expiring next 30 days' list.", { expiringWithinDays: 30 }),
  lane(
    "RED FLAG - UNDER 3 CREDITS",
    "current pack with fewer than 3 credits remaining",
    "Thiago set this as credits, not days since the last visit. matchSegment maxRemaining 2 (remaining 0, 1, or 2). A booking or visit webhook that includes clientPassSessionsRemaining answers it, so the check does not call Mindbody. The matching D1 row stays off and has no template.",
    { maxRemaining: 2 },
  ),
  lane("ORANGE FLAG - LOW MEMBER USAGE: ACTIVE MEMBERS", "active member, 0 signed-in visits in the last 7 days", "The call script says they have not been seen as often in the last 7 days. visitsInWindow 7 days max 0, hasContract.", { hasContract: true, active: true, visitsInWindow: { days: 7, max: 0 } }),
];

export const DYNAMIC_LISTS: SegmentRow[] = [
  { kind: "dynamic", name: "ClassPass", loyalSnap: "6,938 clients when captured", status: "covered", trigger: "saved segment", filters: "service name contains ClassPass", delay: "none", stop: "not a send", detail: "matchSegment classPass.", filter: { classPass: true } },
  { kind: "dynamic", name: "LEADS last 30 days", loyalSnap: "39", status: "covered", trigger: "saved segment", filters: "created within 30 days, no purchase", delay: "none", stop: "not a send", detail: "matchSegment createdWithinDays 30, noPurchase.", filter: { createdWithinDays: 30, noPurchase: true } },
  { kind: "dynamic", name: "LEADS last 60 days", loyalSnap: "52", status: "covered", trigger: "saved segment", filters: "created within 60 days, no purchase", delay: "none", stop: "not a send", detail: "matchSegment createdWithinDays 60, noPurchase.", filter: { createdWithinDays: 60, noPurchase: true } },
  { kind: "dynamic", name: "DROP-INS last 30 days", loyalSnap: "39", status: "covered", trigger: "saved segment", filters: "a signed-in visit in the last 30 days, no contract", delay: "none", stop: "not a send", detail: "matchSegment visitsInWindow 30 min 1, active false. Drop-in pricing names were not in the export, so this is any non-member with a recent visit.", filter: { visitsInWindow: { days: 30, min: 1 }, active: false } },
  { kind: "dynamic", name: "TRIALERS- active", loyalSnap: "20", status: "covered", trigger: "saved segment", filters: "current intro pass", delay: "none", stop: "not a send", detail: "matchSegment introCurrent.", filter: { introCurrent: true } },
  { kind: "dynamic", name: "TRIALS who have not come in", loyalSnap: "27", status: "covered", trigger: "saved segment", filters: "intro, no visit or booking", delay: "none", stop: "not a send", detail: "matchSegment intro, noBooking.", filter: { intro: true, noBooking: true } },
  { kind: "dynamic", name: "TRIAL visits last 30 days", loyalSnap: "55", status: "covered", trigger: "saved segment", filters: "intro and a signed-in visit in 30 days", delay: "none", stop: "not a send", detail: "matchSegment intro, visitsInWindow 30 min 1.", filter: { intro: true, visitsInWindow: { days: 30, min: 1 } } },
  { kind: "dynamic", name: "PACKS less than 5 credits left", loyalSnap: "17", status: "covered", trigger: "saved segment", filters: "remaining credits at most 4", delay: "none", stop: "not a send", detail: "matchSegment maxRemaining 4.", filter: { maxRemaining: 4 } },
  { kind: "dynamic", name: "PACKS expired last 30 days", loyalSnap: "7", status: "covered", trigger: "saved segment", filters: "expiration from 1 to 30 days ago", delay: "none", stop: "not a send", detail: "No single expiredDaysAgo covers a range. The row is covered by checking each of the last 30 days with expiredDaysAgo. See segmentExpiredWithin.", filter: null },
  { kind: "dynamic", name: "PACKS expiring next 30 days", loyalSnap: "10", status: "covered", trigger: "saved segment", filters: "current service expiring within 30 days", delay: "none", stop: "not a send", detail: "matchSegment expiringWithinDays 30.", filter: { expiringWithinDays: 30 } },
  { kind: "dynamic", name: "MEMBERS- less than 12 visits 30 days", loyalSnap: "82", status: "covered", trigger: "saved segment", filters: "has a contract, fewer than 12 signed-in visits in 30 days", delay: "none", stop: "not a send", detail: "matchSegment hasContract, visitsInWindow 30 max 11.", filter: { hasContract: true, visitsInWindow: { days: 30, max: 11 } } },
  { kind: "dynamic", name: "UPFRONT memberships expired in the last 30 days", loyalSnap: "0", status: "covered", trigger: "saved segment", filters: "contract on file was not in the service list; expiry of a service named upfront within 30 days", delay: "none", stop: "not a send", detail: "Upfront contract names were not in the export. Filter is a service whose name contains 'upfront' and whose expiry is in the last 30 days (segmentExpiredWithin). It matches nothing until that name appears on a service.", filter: null },
  { kind: "dynamic", name: "UPFRONT memberships expiring in the next 30 days", loyalSnap: "0", status: "covered", trigger: "saved segment", filters: "service name contains upfront, expiring within 30 days", delay: "none", stop: "not a send", detail: "matchSegment expiringWithinDays 30 is not name-specific. segmentExpiringNamed('upfront', 30) is the saved check. Names were not in the export.", filter: null },
];

export const STATIC_LISTS: SegmentRow[] = STATIC_CLIENT_LISTS.map((name) => ({
  kind: "static" as const,
  name,
  loyalSnap: "title only",
  status: "gap" as const,
  trigger: "saved audience in LoyalSnap",
  filters: "no rule was captured",
  delay: "none",
  stop: "not a send",
  detail: "Mindbody ReferredBy is now read onto the client profile, and matchSegment supports referredBy. These titles were not confirmed as ReferredBy values, and several are one-off campaign audiences with no member export. Do not guess the members.",
  filter: null,
}));

export function segmentExpiredWithin(snapshotServices: { expirationSydney: string | null; name?: string }[], today: string, days: number, nameIncludes?: string): boolean {
  return snapshotServices.some((service) => {
    if (!service.expirationSydney) return false;
    if (nameIncludes && !service.name?.toLowerCase().includes(nameIncludes.toLowerCase())) return false;
    const ago = daysBetween(service.expirationSydney, today);
    return ago >= 1 && ago <= days;
  });
}

export function segmentExpiringNamed(snapshotServices: { expirationSydney: string | null; current: boolean; name: string }[], today: string, nameIncludes: string, days: number): boolean {
  return snapshotServices.some((service) => {
    if (!service.current || !service.expirationSydney) return false;
    if (!service.name.toLowerCase().includes(nameIncludes.toLowerCase())) return false;
    const delta = daysBetween(today, service.expirationSydney);
    return delta >= 0 && delta <= days;
  });
}

function daysBetween(earlier: string, later: string): number {
  const start = Date.parse(`${earlier}T00:00:00Z`);
  const end = Date.parse(`${later}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}
