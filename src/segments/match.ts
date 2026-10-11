import { nameMatchesTokens } from "../names";
import { daysUntil } from "../time";
import type { ClientSnapshot } from "../mindbody/client";
import { CLASS_PASS_TOKENS, INTRO_PASS_TOKENS } from "../automations/seed";

export type SegmentFilter = {
  createdWithinDays?: number;
  noPurchase?: boolean;
  intro?: boolean;
  introCurrent?: boolean;
  classPass?: boolean;
  noBooking?: boolean;
  bookedNotSignedIn?: boolean;
  noUnsignedBooking?: boolean;
  signedInVisits?: { min?: number; max?: number };
  visitsInWindow?: { days: number; min?: number; max?: number };
  expiringWithinDays?: number;
  expiredDaysAgo?: number;
  maxRemaining?: number;
  hasContract?: boolean;
  active?: boolean;
  daysSinceLastVisitMin?: number;
  noShowOn?: boolean;
  referredBy?: string;
};

export type SegmentFacts = {
  todaySydney: string;
  createdSydney: string | null;
  referredBy: string | null;
  snapshot: ClientSnapshot;
};

const CLASS_PASS = CLASS_PASS_TOKENS;
const INTRO = INTRO_PASS_TOKENS;

export function matchSegment(filter: SegmentFilter, facts: SegmentFacts): boolean {
  const { snapshot, todaySydney } = facts;
  if (filter.createdWithinDays != null) {
    if (!facts.createdSydney) return false;
    const age = daysUntil(facts.createdSydney, todaySydney);
    if (age < 0 || age > filter.createdWithinDays) return false;
  }
  const purchased = snapshot.services.length > 0 || snapshot.contracts.length > 0;
  if (filter.noPurchase && purchased) return false;
  const introServices = snapshot.services.filter((service) => nameMatchesTokens(service.name, INTRO));
  if (filter.intro && introServices.length === 0) return false;
  if (filter.introCurrent) {
    const current = introServices.some((service) => service.current && (!service.expirationSydney || service.expirationSydney >= todaySydney));
    if (!current) return false;
  }
  if (filter.classPass && !snapshot.services.some((service) => nameMatchesTokens(service.name, CLASS_PASS))) return false;
  const countable = snapshot.visits.filter((visit) => !visit.lateCancelled && !visit.earlyCancelled);
  if (filter.noBooking && countable.length > 0) return false;
  if (filter.bookedNotSignedIn && !countable.some((visit) => !visit.signedIn)) return false;
  if (filter.noUnsignedBooking && countable.some((visit) => !visit.signedIn)) return false;
  if (filter.signedInVisits) {
    const signed = countable.filter((visit) => visit.signedIn).length;
    if (filter.signedInVisits.min != null && signed < filter.signedInVisits.min) return false;
    if (filter.signedInVisits.max != null && signed > filter.signedInVisits.max) return false;
  }
  if (filter.visitsInWindow) {
    const count = countable.filter((visit) => {
      if (!visit.signedIn || !visit.startSydney) return false;
      const since = daysUntil(visit.startSydney, todaySydney);
      return since >= 0 && since <= filter.visitsInWindow!.days;
    }).length;
    if (filter.visitsInWindow.min != null && count < filter.visitsInWindow.min) return false;
    if (filter.visitsInWindow.max != null && count > filter.visitsInWindow.max) return false;
  }
  if (filter.expiringWithinDays != null) {
    const hit = snapshot.services.some((service) => {
      if (!service.expirationSydney || !service.current) return false;
      const delta = daysUntil(todaySydney, service.expirationSydney);
      return delta >= 0 && delta <= filter.expiringWithinDays!;
    });
    if (!hit) return false;
  }
  if (filter.expiredDaysAgo != null) {
    const hit = snapshot.services.some((service) => {
      if (!service.expirationSydney) return false;
      return daysUntil(service.expirationSydney, todaySydney) === filter.expiredDaysAgo;
    });
    if (!hit) return false;
  }
  if (filter.maxRemaining != null) {
    const remaining = snapshot.services.filter((service) => service.current && typeof service.remaining === "number").map((service) => service.remaining as number);
    if (remaining.length === 0 || Math.min(...remaining) > filter.maxRemaining) return false;
  }
  if (filter.hasContract && snapshot.contracts.length === 0) return false;
  if (filter.active === true && !isActive(facts)) return false;
  if (filter.active === false && isActive(facts)) return false;
  if (filter.daysSinceLastVisitMin != null) {
    const dates = countable.filter((visit) => visit.signedIn && visit.startSydney).map((visit) => visit.startSydney as string).sort();
    const last = dates.at(-1);
    if (!last || daysUntil(last, todaySydney) < filter.daysSinceLastVisitMin) return false;
  }
  if (filter.noShowOn) {
    const missed = snapshot.visits.some((visit) => (visit.lateCancelled || visit.earlyCancelled) && visit.startSydney === todaySydney);
    if (!missed) return false;
  }
  if (filter.referredBy != null) {
    if ((facts.referredBy ?? "").trim().toLowerCase() !== filter.referredBy.trim().toLowerCase()) return false;
  }
  return true;
}

function isActive(facts: SegmentFacts): boolean {
  if (facts.snapshot.contracts.length > 0) return true;
  return facts.snapshot.services.some((service) => service.current && (!service.expirationSydney || service.expirationSydney >= facts.todaySydney));
}
