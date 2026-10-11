import { describe, expect, it } from "vitest";
import { evaluateAutomation, type EvalContext } from "../src/automations/engine";
import { dedupeKey, gateSend } from "../src/automations/gate";
import { findSeed } from "../src/automations/seed";
import type { Automation, Visit } from "../src/automations/types";
import { isQuietHours } from "../src/time";
import { visit } from "./helpers";

function ctx(partial: Partial<EvalContext> = {}): EvalContext {
  return {
    phase: "trigger",
    eventId: "client.created",
    todaySydney: "2026-10-11",
    anchorSydney: "2026-10-11",
    dueOn: null,
    signedInStatus: null,
    triggeringContractName: null,
    candidatePackageNames: [],
    waiverSigned: false,
    suppressed: false,
    passExpirationSydney: null,
    visits: [],
    serviceCount: 0,
    contracts: [],
    visitCrossingRecorded: false,
    windowAlreadyMatched: false,
    ...partial,
  };
}

function sample(patch: Partial<Automation> = {}): Automation {
  return {
    id: 900,
    key: "sample",
    name: "Sample",
    channel: "email",
    templateId: 5,
    messageText: null,
    triggerEvents: ["client.created"],
    scheduleOnEvents: [],
    timingKind: "immediate",
    timingOffsetDays: null,
    filters: {},
    skipRules: {},
    enabled: false,
    extraRecipient: null,
    notes: null,
    ...patch,
  };
}

function signed(name: string, start: string, extra: Partial<Visit> = {}): Visit {
  return visit({ serviceName: name, startSydney: start, ...extra });
}

describe("triggers", () => {
  it("client.created sends and a different event does not", () => {
    expect(evaluateAutomation(sample(), ctx()).action).toBe("send");
    expect(evaluateAutomation(sample(), ctx({ eventId: "clientSale.created" })).reason).toBe("not_this_trigger");
  });

  it("clientSale.created requires the sale event", () => {
    const sale = sample({ triggerEvents: ["clientSale.created"] });
    expect(evaluateAutomation(sale, ctx({ eventId: "clientSale.created" })).action).toBe("send");
    expect(evaluateAutomation(sale, ctx()).reason).toBe("not_this_trigger");
  });

  it("clientContract.created matches only a listed contract", () => {
    const row = sample({
      triggerEvents: ["clientContract.created"],
      filters: { contractNames: ["Unlimited"] },
    });
    expect(evaluateAutomation(row, ctx({ eventId: "clientContract.created", triggeringContractName: "Unlimited" })).action).toBe("send");
    expect(evaluateAutomation(row, ctx({ eventId: "clientContract.created", triggeringContractName: "Casual" })).reason).toBe("contract_not_on_list");
    expect(evaluateAutomation(row, ctx({ eventId: "clientContract.created" })).reason).toBe("contract_not_on_list");
  });

  it("classRosterBooking.created is the booking trigger", () => {
    const row = sample({ triggerEvents: ["classRosterBooking.created"] });
    expect(evaluateAutomation(row, ctx({ eventId: "classRosterBooking.created" })).action).toBe("send");
  });

  it("classRosterBookingStatus.updated honours signed-in status", () => {
    const row = sample({
      triggerEvents: ["classRosterBookingStatus.updated"],
      filters: { signedInStatus: "SignedIn" },
    });
    expect(evaluateAutomation(row, ctx({ eventId: "classRosterBookingStatus.updated", signedInStatus: "SignedIn" })).action).toBe("send");
    expect(evaluateAutomation(row, ctx({ eventId: "classRosterBookingStatus.updated", signedInStatus: "NotSignedIn" })).reason).toBe("signed_in_status_mismatch");
  });

  it("lead.created is the external-lead trigger", () => {
    const row = findSeed("external-immediate-text");
    expect(evaluateAutomation(row, ctx({ eventId: "lead.created" })).action).toBe("send");
    expect(evaluateAutomation(row, ctx({ eventId: "client.created" })).reason).toBe("not_this_trigger");
  });

  it("cron is not an immediate trigger", () => {
    const row = sample({ triggerEvents: ["cron"], timingKind: "delay_days", timingOffsetDays: 2, scheduleOnEvents: ["client.created"] });
    expect(evaluateAutomation(row, ctx({ eventId: "cron", phase: "trigger" })).reason).toBe("not_this_trigger");
  });
});

describe("filters", () => {
  it("packageNameIncludes is a contains match and an empty list matches nothing", () => {
    const row = sample({ triggerEvents: ["clientSale.created"], filters: { packageNameIncludes: ["2 week"] } });
    expect(evaluateAutomation(row, ctx({ eventId: "clientSale.created", candidatePackageNames: ["2-Week Intro"] })).action).toBe("send");
    expect(evaluateAutomation(row, ctx({ eventId: "clientSale.created", candidatePackageNames: ["Casual"] })).reason).toBe("package_filter_miss");
    const empty = sample({ triggerEvents: ["clientSale.created"], filters: { packageNameIncludes: [] } });
    expect(evaluateAutomation(empty, ctx({ eventId: "clientSale.created", candidatePackageNames: ["10 Class Pack"] })).reason).toBe("package_filter_miss");
  });

  it("visitCountMode booked counts a future booking and signed_in does not", () => {
    const visits = [visit({ serviceName: "Intro", signedIn: false })];
    const booked = sample({ filters: { visitCountMode: "booked" }, skipRules: { skipIfHasVisited: true } });
    const signedIn = sample({ filters: { visitCountMode: "signed_in" }, skipRules: { skipIfHasVisited: true } });
    expect(evaluateAutomation(booked, ctx({ visits })).reason).toBe("has_visited");
    expect(evaluateAutomation(signedIn, ctx({ visits })).action).toBe("send");
  });

  it("includeClassPassVisits drops ClassPass service names", () => {
    const visits = [signed("ClassPass Reformer", "2026-10-01")];
    const row = sample({
      filters: { includeClassPassVisits: false, classPassNameIncludes: ["classpass"] },
      skipRules: { minVisits: 1 },
    });
    expect(evaluateAutomation(row, ctx({ visits })).reason).toBe("visits_below_min");
  });

  it("remaining credits can be exact, minimum, or maximum", () => {
    const base = sample({
      triggerEvents: ["classRosterBookingStatus.updated"],
      filters: { packageNameIncludes: ["pack"], exactRemaining: 2 },
    });
    const facts = { eventId: "classRosterBookingStatus.updated", candidatePackageNames: ["10 Pack"], remaining: 2 };
    expect(evaluateAutomation(base, ctx(facts)).action).toBe("send");
    expect(evaluateAutomation(base, ctx({ ...facts, remaining: 1 })).reason).toBe("remaining_not_exact");
    expect(evaluateAutomation(base, ctx({ ...facts, remaining: null })).reason).toBe("remaining_unknown");
    const range = sample({
      triggerEvents: ["classRosterBookingStatus.updated"],
      filters: { minRemaining: 1, maxRemaining: 4 },
    });
    expect(evaluateAutomation(range, ctx({ eventId: "classRosterBookingStatus.updated", remaining: 4 })).action).toBe("send");
    expect(evaluateAutomation(range, ctx({ eventId: "classRosterBookingStatus.updated", remaining: 5 })).reason).toBe("remaining_above_max");
    expect(evaluateAutomation(range, ctx({ eventId: "classRosterBookingStatus.updated", remaining: 0 })).reason).toBe("remaining_below_min");
  });

  it("clientActivity separates active and inactive clients", () => {
    const active = sample({ filters: { clientActivity: "active" } });
    const inactive = sample({ filters: { clientActivity: "inactive" } });
    expect(evaluateAutomation(active, ctx({ contracts: [{ name: "Unlimited" }] })).action).toBe("send");
    expect(evaluateAutomation(active, ctx()).reason).toBe("not_active");
    expect(evaluateAutomation(inactive, ctx()).action).toBe("send");
    expect(evaluateAutomation(inactive, ctx({
      services: [{ name: "Intro", expirationSydney: "2026-10-20", current: true }],
    })).reason).toBe("not_inactive");
  });
});

describe("delays", () => {
  it("delay_days waits for the due date and then sends", () => {
    const row = sample({ timingKind: "delay_days", timingOffsetDays: 14, triggerEvents: ["cron"], scheduleOnEvents: ["client.created"] });
    expect(evaluateAutomation(row, ctx({ phase: "schedule", eventId: "client.created", anchorSydney: "2026-10-01" })).dueOn).toBe("2026-10-15");
    expect(evaluateAutomation(row, ctx({ phase: "cron", dueOn: "2026-10-15", todaySydney: "2026-10-14" })).reason).toBe("not_due");
    expect(evaluateAutomation(row, ctx({ phase: "cron", dueOn: "2026-10-15", todaySydney: "2026-10-15" })).action).toBe("send");
  });

  it("days_before_expiry sends only on the exact day", () => {
    const row = sample({ timingKind: "days_before_expiry", timingOffsetDays: 3, triggerEvents: ["cron"] });
    const run = (today: string) => evaluateAutomation(row, ctx({ phase: "cron", todaySydney: today, passExpirationSydney: "2026-10-14" }));
    expect(run("2026-10-10").reason).toBe("not_due");
    expect(run("2026-10-11").action).toBe("send");
    expect(run("2026-10-12").reason).toBe("missed_window");
  });

  it("days_after_expiry offset 0 is the expiry day", () => {
    const row = sample({ timingKind: "days_after_expiry", timingOffsetDays: 0, triggerEvents: ["cron"] });
    expect(evaluateAutomation(row, ctx({ phase: "cron", todaySydney: "2026-10-10", passExpirationSydney: "2026-10-11" })).reason).toBe("not_due");
    expect(evaluateAutomation(row, ctx({ phase: "cron", todaySydney: "2026-10-11", passExpirationSydney: "2026-10-11" })).action).toBe("send");
    expect(evaluateAutomation(row, ctx({ phase: "cron", todaySydney: "2026-10-12", passExpirationSydney: "2026-10-11" })).reason).toBe("missed_window");
  });

  it("days_since_last_visit uses the visit start date and reschedules when it is early", () => {
    const row = sample({ timingKind: "days_since_last_visit", timingOffsetDays: 30, triggerEvents: ["cron"], filters: { visitCountMode: "signed_in" } });
    const early = evaluateAutomation(row, ctx({
      phase: "cron",
      todaySydney: "2026-10-11",
      visits: [signed("Reformer", "2026-10-01")],
    }));
    expect(early.reason).toBe("not_due");
    expect(early.dueOn).toBe("2026-10-31");
    expect(evaluateAutomation(row, ctx({
      phase: "cron",
      todaySydney: "2026-10-31",
      visits: [signed("Reformer", "2026-10-01")],
    })).action).toBe("send");
    expect(evaluateAutomation(row, ctx({ phase: "cron", visits: [] })).reason).toBe("last_visit_unknown");
  });

  it("birthday_day and birthday_month_start match the Sydney calendar", () => {
    const day = sample({ timingKind: "birthday_day", timingOffsetDays: 0, triggerEvents: ["cron"], skipRules: { repeat: "yearly" } });
    const onDay = evaluateAutomation(day, ctx({ phase: "cron", todaySydney: "2026-10-11", birthDate: "1990-10-11" }));
    expect(onDay.action).toBe("send");
    expect(onDay.dueOn).toBe("2027-10-11");
    expect(evaluateAutomation(day, ctx({ phase: "cron", todaySydney: "2026-10-10", birthDate: "1990-10-11" })).reason).toBe("not_due");
    expect(evaluateAutomation(day, ctx({ phase: "cron" })).reason).toBe("birth_date_unknown");
    const month = sample({ timingKind: "birthday_month_start", timingOffsetDays: 0, triggerEvents: ["cron"] });
    expect(evaluateAutomation(month, ctx({ phase: "cron", todaySydney: "2026-10-01", birthDate: "1990-10-11" })).action).toBe("send");
    expect(evaluateAutomation(month, ctx({ phase: "cron", todaySydney: "2026-10-11", birthDate: "1990-10-11" })).reason).toBe("not_due");
  });
});

describe("stop rules", () => {
  it("skips intro or any purchase, any purchase, a visit, and a booking", () => {
    expect(evaluateAutomation(sample({ skipRules: { skipIfHasIntroOrAnyPurchase: true } }), ctx({ serviceCount: 1 })).reason).toBe("has_intro_or_purchase");
    expect(evaluateAutomation(sample({ skipRules: { skipIfHasAnyPurchase: true } }), ctx({ contracts: [{ name: "Unlimited" }] })).reason).toBe("has_purchase");
    expect(evaluateAutomation(sample({ skipRules: { skipIfHasVisited: true } }), ctx({ visits: [signed("Reformer", "2026-10-01")] })).reason).toBe("has_visited");
    expect(evaluateAutomation(sample({ skipRules: { skipIfHasBooking: true } }), ctx({ visits: [visit({ serviceName: "Reformer", signedIn: false })] })).reason).toBe("has_booking");
  });

  it("skips unsubscribed, membership, waiver, and an expired pass", () => {
    expect(evaluateAutomation(sample({ skipRules: { skipIfUnsubscribed: true } }), ctx({ suppressed: true })).reason).toBe("unsubscribed");
    expect(evaluateAutomation(sample({ skipRules: { skipIfMembership: true, membershipContractNames: ["Unlimited"] } }), ctx({ contracts: [{ name: "Unlimited" }] })).reason).toBe("has_membership");
    expect(evaluateAutomation(sample({ skipRules: { skipIfWaiverSigned: true } }), ctx({ waiverSigned: true })).reason).toBe("waiver_signed");
    expect(evaluateAutomation(sample({ skipRules: { skipIfPassExpired: true } }), ctx({ passExpirationSydney: "2026-10-01" })).reason).toBe("pass_expired");
  });

  it("enforces minimum, exact, maximum, every nth visit, and a visit window", () => {
    const visits = [signed("Reformer", "2026-10-01"), signed("Reformer", "2026-10-08", { id: 2 })];
    expect(evaluateAutomation(sample({ skipRules: { minVisits: 3 } }), ctx({ visits })).reason).toBe("visits_below_min");
    expect(evaluateAutomation(sample({ skipRules: { exactVisits: 2 } }), ctx({ visits })).action).toBe("send");
    expect(evaluateAutomation(sample({ skipRules: { exactVisits: 3 } }), ctx({ visits })).reason).toBe("visits_not_yet");
    expect(evaluateAutomation(sample({ skipRules: { maxVisits: 1 } }), ctx({ visits })).reason).toBe("visits_above_max");
    expect(evaluateAutomation(sample({ skipRules: { everyNthVisit: 2 } }), ctx({ visits })).action).toBe("send");
    expect(evaluateAutomation(sample({ skipRules: { everyNthVisit: 35 } }), ctx({ visits })).reason).toBe("visits_not_yet");
    const windowed = sample({ skipRules: { visitWindowDays: 14, minVisitsInWindow: 2, maxVisitsInWindow: 999 } });
    expect(evaluateAutomation(windowed, ctx({ visits })).action).toBe("send");
    expect(evaluateAutomation(windowed, ctx({ visits: [signed("Reformer", "2026-09-01")] })).reason).toBe("visits_not_yet");
  });

  it("holds an email with no template instead of sending", () => {
    const row = sample({ templateId: null });
    expect(evaluateAutomation(row, ctx()).reason).toBe("template_missing");
  });
});

describe("quiet hours and the enable switch", () => {
  it("treats 8pm–9am Sydney as quiet and 9:00 as allowed", () => {
    expect(isQuietHours(new Date("2026-10-11T10:00:00Z"), "20:00", "09:00")).toBe(true);
    expect(isQuietHours(new Date("2026-10-10T22:00:00Z"), "20:00", "09:00")).toBe(false);
  });

  it("holds a text during quiet hours unless the action is skip", () => {
    const held = gateSend({
      devMode: false,
      dryRun: false,
      enabled: true,
      emailAllowlist: [],
      phoneAllowlist: [],
      channel: "sms",
      email: null,
      phone: "+61400000000",
      alreadySent: false,
      suppressed: false,
      withinQuietHours: true,
      quietAction: "hold",
    });
    expect(held.reason).toBe("quiet_hours");
    expect(held.terminal).toBe(false);
    const skipped = gateSend({ ...{
      devMode: false, dryRun: false, enabled: true, emailAllowlist: [], phoneAllowlist: [],
      channel: "sms" as const, email: null, phone: "+61400000000", alreadySent: false, suppressed: false, withinQuietHours: true, quietAction: "skip" as const,
    } });
    expect(skipped.terminal).toBe(true);
  });

  it("a disabled row does not send, and an enabled allowlisted row does", () => {
    const input = {
      devMode: true, dryRun: false, enabled: false, emailAllowlist: ["bondi@balancemoves.com.au"], phoneAllowlist: [],
      channel: "email" as const, email: "bondi@balancemoves.com.au", phone: null, alreadySent: false, suppressed: false, withinQuietHours: false,
    };
    const off = gateSend(input);
    expect(off.reason).toBe("automation_disabled");
    expect(off.terminal).toBe(false);
    const on = gateSend({ ...input, enabled: true });
    expect(on.reason).toBe("send");
    expect(on.listmonkCall).toBe(true);
  });

  it("milestone and yearly dedupe keys differ from the once-per-client key", () => {
    expect(dedupeKey(33, "100")).toBe("automation:33:client:100");
    expect(dedupeKey(33, "100", "primary", "visits:35")).toBe("automation:33:client:100:visits:35");
    expect(dedupeKey(70, "100", "primary", "year:2026")).not.toBe(dedupeKey(70, "100", "primary", "year:2027"));
  });
});
