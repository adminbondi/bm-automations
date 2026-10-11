import { describe, expect, it } from "vitest";
import { evaluateAutomation, type EvalContext } from "../src/automations/engine";
import { findSeed } from "../src/automations/seed";
import type { Automation } from "../src/automations/types";
import { visit } from "./helpers";

const intro = "2 Week Intro Pass";

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

function decide(key: string, partial: Partial<EvalContext> = {}, patch?: Partial<Automation>) {
  return evaluateAutomation({ ...findSeed(key), ...patch }, ctx(partial));
}

describe("automation rules", () => {
  it("1 sends a new lead and skips a purchase", () => {
    expect(decide("lead-immediate").action).toBe("send");
    expect(decide("lead-immediate").templateId).toBe(5);
    expect(decide("lead-immediate", { serviceCount: 1 }).reason).toBe("has_intro_or_purchase");
  });

  it("2 schedules day 60 and skips a visit", () => {
    const scheduled = decide("lead-day-60", { phase: "schedule", eventId: "client.created", anchorSydney: "2026-08-01" });
    expect(scheduled.action).toBe("schedule");
    expect(scheduled.dueOn).toBe("2026-09-30");
    const skipped = decide("lead-day-60", {
      phase: "cron",
      dueOn: "2026-09-30",
      todaySydney: "2026-09-30",
      visits: [visit({ serviceName: "Casual" })],
    });
    expect(skipped.reason).toBe("has_visited");
    const sent = decide("lead-day-60", { phase: "cron", dueOn: "2026-09-30", todaySydney: "2026-09-30" });
    expect(sent.action).toBe("send");
    expect(decide("lead-day-60", { phase: "cron", dueOn: "2026-10-01", todaySydney: "2026-09-30" }).reason).toBe("not_due");
  });

  it("3 sends an intro sale and skips other packages", () => {
    expect(decide("trial-purchased", { eventId: "clientSale.created", candidatePackageNames: [intro] }).action).toBe("send");
    expect(decide("trial-purchased", { eventId: "clientSale.created", candidatePackageNames: ["Casual"] }).reason).toBe("package_filter_miss");
  });

  it("4 sends the third intro visit and holds a short count", () => {
    const visits = [1, 2, 3].map((id) => visit({ id, serviceName: intro }));
    const sent = decide("trial-third-class", {
      eventId: "classRosterBookingStatus.updated",
      signedInStatus: "SignedIn",
      candidatePackageNames: [intro],
      visits,
    });
    expect(sent.action).toBe("send");
    expect(sent.templateId).toBe(8);
    const early = decide("trial-third-class", {
      eventId: "classRosterBookingStatus.updated",
      signedInStatus: "SignedIn",
      candidatePackageNames: [intro],
      visits: visits.slice(0, 2),
    });
    expect(early.reason).toBe("visits_not_yet");
    const membership = findSeed("trial-third-class");
    membership.skipRules = { ...membership.skipRules, membershipContractNames: ["Unlimited"] };
    expect(evaluateAutomation(membership, ctx({
      eventId: "classRosterBookingStatus.updated",
      signedInStatus: "SignedIn",
      candidatePackageNames: [intro],
      visits,
      contracts: [{ name: "Unlimited" }],
    })).reason).toBe("has_membership");
  });

  it("5 sends three days before expiry and skips an empty or missed window", () => {
    const base = {
      phase: "cron" as const,
      candidatePackageNames: [intro],
      passExpirationSydney: "2026-10-14",
      visits: [visit({ serviceName: intro })],
    };
    expect(decide("trial-expiring-3-days", { ...base, todaySydney: "2026-10-11" }).action).toBe("send");
    expect(decide("trial-expiring-3-days", { ...base, todaySydney: "2026-10-11" }).data).toEqual({ visits: 1 });
    expect(decide("trial-expiring-3-days", { ...base, todaySydney: "2026-10-10" }).reason).toBe("not_due");
    expect(decide("trial-expiring-3-days", { ...base, todaySydney: "2026-10-12" }).reason).toBe("missed_window");
    expect(decide("trial-expiring-3-days", { ...base, todaySydney: "2026-10-11", visits: [] }).reason).toBe("visits_below_min");
  });

  it("6 sends one day before expiry only at exactly one visit", () => {
    const base = {
      phase: "cron" as const,
      candidatePackageNames: [intro],
      passExpirationSydney: "2026-10-12",
      todaySydney: "2026-10-11",
    };
    expect(decide("trial-expiring-1-day-one-visit", { ...base, visits: [visit({ serviceName: intro })] }).action).toBe("send");
    expect(decide("trial-expiring-1-day-one-visit", {
      ...base,
      visits: [visit({ id: 1, serviceName: intro }), visit({ id: 2, serviceName: intro })],
    }).reason).toBe("visits_not_exact");
  });

  it("7 matches nothing until contract names are saved", () => {
    expect(decide("membership-purchase", { eventId: "clientContract.created", triggeringContractName: "Unlimited" }).reason).toBe("contract_not_on_list");
    const named = findSeed("membership-purchase");
    named.filters = { contractNames: ["Unlimited"] };
    expect(evaluateAutomation(named, ctx({ eventId: "clientContract.created", triggeringContractName: "Unlimited" })).action).toBe("send");
  });

  it("8 sends the third visit of any service", () => {
    const visits = [1, 2, 3].map((id) => visit({ id, serviceName: "Casual" }));
    expect(decide("member-google-review", {
      eventId: "classRosterBookingStatus.updated",
      signedInStatus: "SignedIn",
      visits,
    }).action).toBe("send");
    expect(decide("member-google-review", {
      eventId: "classRosterBookingStatus.updated",
      signedInStatus: "SignedIn",
      visits: visits.slice(0, 2),
    }).reason).toBe("visits_not_yet");
  });

  it("9 sends a ClassPass booking and skips a signed waiver", () => {
    expect(decide("classpass-welcome", {
      eventId: "classRosterBooking.created",
      candidatePackageNames: ["ClassPass"],
    }).action).toBe("send");
    expect(decide("classpass-welcome", {
      eventId: "classRosterBooking.created",
      candidatePackageNames: ["ClassPass"],
      waiverSigned: true,
    }).reason).toBe("waiver_signed");
    expect(decide("classpass-welcome", { eventId: "client.created" }).reason).toBe("package_filter_miss");
  });

  it("10 texts on day 7 only when nothing is booked", () => {
    const scheduled = decide("trial-day-7-no-booking", {
      phase: "schedule",
      eventId: "clientSale.created",
      anchorSydney: "2026-10-01",
      candidatePackageNames: [intro],
    });
    expect(scheduled.action).toBe("schedule");
    expect(scheduled.dueOn).toBe("2026-10-08");
    expect(scheduled.channel).toBe("sms");
    const open = decide("trial-day-7-no-booking", {
      phase: "cron",
      dueOn: "2026-10-08",
      todaySydney: "2026-10-08",
      candidatePackageNames: [intro],
    });
    expect(open.action).toBe("send");
    expect(open.messageText).toContain("haven't booked");
    const booked = decide("trial-day-7-no-booking", {
      phase: "cron",
      dueOn: "2026-10-08",
      todaySydney: "2026-10-08",
      candidatePackageNames: [intro],
      visits: [visit({ serviceName: "Reformer", signedIn: false })],
    });
    expect(booked.reason).toBe("has_booking");
  });

  it("11 sends the intro review text on the third signed-in visit", () => {
    const visits = [1, 2, 3].map((id) => visit({ id, serviceName: intro }));
    const sent = decide("trial-google-review-text", {
      eventId: "classRosterBookingStatus.updated",
      signedInStatus: "SignedIn",
      candidatePackageNames: [intro],
      visits,
    });
    expect(sent.action).toBe("send");
    expect(sent.messageText).toContain("https://g.page/r/CfyVtWt5Wc47EBM/review");
    expect(decide("trial-google-review-text", {
      eventId: "classRosterBookingStatus.updated",
      signedInStatus: "SignedIn",
      candidatePackageNames: ["Casual"],
      visits,
    }).reason).toBe("package_filter_miss");
  });

  it("12 texts one day before expiry with at least one visit and does not skip membership", () => {
    const sent = decide("trial-expiring-1-day-text", {
      phase: "cron",
      todaySydney: "2026-10-11",
      candidatePackageNames: [intro],
      passExpirationSydney: "2026-10-12",
      visits: [visit({ serviceName: intro })],
      contracts: [{ name: "Unlimited" }],
    });
    expect(sent.action).toBe("send");
    expect(decide("trial-expiring-1-day-text", {
      phase: "cron",
      todaySydney: "2026-10-11",
      candidatePackageNames: [intro],
      passExpirationSydney: "2026-10-12",
      visits: [],
    }).reason).toBe("visits_below_min");
  });

  it("13 sends ten days after a 2 week pass expires", () => {
    const sent = decide("trial-followup-10-day", {
      phase: "cron",
      todaySydney: "2026-10-21",
      candidatePackageNames: ["2-week Intro"],
      passExpirationSydney: "2026-10-11",
    });
    expect(sent.action).toBe("send");
    expect(sent.messageText).toContain("Yvette xx");
    expect(decide("trial-followup-10-day", {
      phase: "cron",
      todaySydney: "2026-10-16",
      candidatePackageNames: ["2-week Intro"],
      passExpirationSydney: "2026-10-11",
    }).reason).toBe("not_due");
    expect(decide("trial-followup-10-day", {
      phase: "cron",
      todaySydney: "2026-10-22",
      candidatePackageNames: ["2-week Intro"],
      passExpirationSydney: "2026-10-11",
    }).reason).toBe("missed_window");
    expect(decide("trial-followup-10-day", {
      phase: "cron",
      todaySydney: "2026-10-22",
      candidatePackageNames: ["2-week Intro"],
      passExpirationSydney: "2026-10-11",
      windowAlreadyMatched: true,
    }).action).toBe("send");
    expect(decide("trial-followup-10-day", {
      phase: "schedule",
      eventId: "clientSale.created",
      candidatePackageNames: ["7 Day Intro"],
    }).reason).toBe("package_filter_miss");
  });
});
