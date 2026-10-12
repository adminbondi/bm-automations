import { TEMPLATE_SUBJECTS } from "./subjects";
import type { Automation } from "./types";

const LIST: Record<string, { trigger: string; delay: string }> = {
  "lead-immediate": { trigger: "New lead (Mindbody client.created)", delay: "Immediately" },
  "lead-day-60": { trigger: "Daily 9am check: 60 days after created", delay: "Day 60" },
  "trial-purchased": { trigger: "Intro Pass purchased (clientSale.created)", delay: "Immediately" },
  "trial-third-class": { trigger: "3rd sign-in while on trial", delay: "Immediately" },
  "trial-expiring-3-days": { trigger: "Daily 9am check: pass expiry", delay: "Expiry − 3 days" },
  "trial-expiring-1-day-one-visit": { trigger: "Daily 9am check: pass expiry", delay: "Expiry − 1 day" },
  "membership-purchase": { trigger: "New contract (clientContract.created)", delay: "Immediately" },
  "member-google-review": { trigger: "3rd sign-in", delay: "After visit 3" },
  "classpass-welcome": { trigger: "First ClassPass booking", delay: "Immediately" },
  "trial-day-7-no-booking": { trigger: "Daily 9am check: 7 days after Intro Pass, no booking", delay: "Day 7" },
  "trial-google-review-text": { trigger: "3rd sign-in on Intro Offer", delay: "After visit 3" },
  "trial-expiring-1-day-text": { trigger: "Daily 9am check: pass expiry, ≥1 visit", delay: "Expiry − 1 day" },
  "trial-followup-10-day": { trigger: "Daily 9am check: 10 days after 2-week trial expired", delay: "Expiry + 10 days" },
  "red-flag-under-3-credits": { trigger: "Booking or visit, under 3 credits", delay: "Immediately" },
};

export function listTrigger(automation: Automation): string {
  return LIST[automation.key]?.trigger ?? fallbackTrigger(automation);
}

export function listDelay(automation: Automation): string {
  return LIST[automation.key]?.delay ?? fallbackDelay(automation);
}

function fallbackTrigger(automation: Automation): string {
  if (automation.triggerEvents.includes("cron")) return "Daily 9am Sydney check";
  if (automation.triggerEvents.includes("classRosterBookingStatus.updated")) return "Class sign-in";
  if (automation.triggerEvents.includes("clientSale.created")) return "Sale (Intro Pass)";
  if (automation.triggerEvents.includes("clientContract.created")) return "New contract";
  if (automation.triggerEvents.includes("classRosterBooking.created")) return "Class booking";
  if (automation.triggerEvents.includes("lead.created")) return "External lead received";
  if (automation.triggerEvents.includes("client.created")) return "New client";
  return automation.triggerEvents.join(", ") || "Daily 9am Sydney check";
}

function fallbackDelay(automation: Automation): string {
  const days = automation.timingOffsetDays ?? 0;
  if (automation.timingKind === "immediate") {
    if (automation.skipRules.exactVisits) return `After visit ${automation.skipRules.exactVisits}`;
    return "Immediately";
  }
  if (automation.timingKind === "days_before_expiry") return `Expiry − ${days} day${days === 1 ? "" : "s"}`;
  if (automation.timingKind === "days_after_expiry") return `Expiry + ${days} day${days === 1 ? "" : "s"}`;
  if (automation.timingKind === "days_since_last_visit") return `${days} days since last visit`;
  if (automation.timingKind === "birthday_day") return "Birthday";
  if (automation.timingKind === "birthday_month_start") return "1st of birthday month";
  return `Day ${days}`;
}

export function stepPreview(automation: Automation): string {
  if (automation.channel === "sms") return (automation.messageText ?? "").replace(/\s+/g, " ").trim();
  if (automation.templateId !== null) {
    const subject = TEMPLATE_SUBJECTS[automation.templateId];
    if (subject) return subject;
  }
  const subject = automation.notes?.match(/Subject:\s*([^.]*)/);
  if (!subject?.[1]) return "No template yet";
  const line = subject[1].trim();
  const end = line.search(/[!?]/);
  return end >= 0 ? line.slice(0, end + 1) : line;
}

export function stepTimingLabel(automation: Automation): string {
  const stored = automation.timingLabel?.trim();
  if (stored) return stored;
  return listDelay(automation);
}

export function smsListPreview(text: string): string {
  const shown = text.replace(/\[first name\]/gi, "{{first_name}}").replace(/\[studio\]/gi, "Balance Moves").replace(/\s+/g, " ").trim();
  const cut = shown.length > 78 ? `${shown.slice(0, 77)}…` : shown;
  return `“${cut}”`;
}
