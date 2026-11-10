import { describe, expect, it } from "vitest";
import { delayOffsetMs, MAX_SHORT_DELAY_MS, validateShortDelay } from "../src/automations/delay-units";
import { evaluateAutomation } from "../src/automations/engine";
import { findSeed } from "../src/automations/seed";
import { applyEditor, derivedDelay, derivedDelayUnit } from "../src/http/editor";
import { matchingPhases } from "../src/pipeline/plan";
import { createSessionToken } from "../src/auth";
import { createApp } from "../src/index";
import { asD1, openSqlite, testEnv } from "./helpers";

describe("delay units", () => {
  it("converts short Delay units to milliseconds and caps at 15 minutes", () => {
    expect(delayOffsetMs(1500, "milliseconds")).toBe(1500);
    expect(delayOffsetMs(3, "seconds")).toBe(3000);
    expect(delayOffsetMs(2, "minutes")).toBe(120_000);
    expect(delayOffsetMs(1, "days")).toBeNull();
    expect(validateShortDelay(15, "minutes")).toBeNull();
    expect(validateShortDelay(16, "minutes")).toBe("invalid_offset");
    expect(validateShortDelay(MAX_SHORT_DELAY_MS + 1, "milliseconds")).toBe("invalid_offset");
  });

  it("saves a seconds Delay after purchase as delay_duration on the sale trigger", () => {
    const current = findSeed("bf-intro-moment-1");
    const saved = applyEditor(current, {
      name: current.name,
      channel: "email",
      templateId: String(current.templateId ?? 14),
      messageText: "",
      trigger: "sale",
      audience: "intro",
      delay: "after-purchase",
      delayDays: "3",
      delayUnit: "seconds",
      skipBooking: false,
      skipMembership: false,
      skipSent: true,
      skipUnsubscribed: false,
    }, false);
    expect(typeof saved).not.toBe("string");
    if (typeof saved === "string") return;
    expect(saved.timingKind).toBe("delay_duration");
    expect(saved.timingOffsetDays).toBe(3);
    expect(saved.timingOffsetUnit).toBe("seconds");
    expect(saved.triggerEvents).toEqual(["clientSale.created"]);
    expect(saved.scheduleOnEvents).toEqual([]);
    expect(derivedDelay(saved)).toBe("after-purchase");
    expect(derivedDelayUnit(saved)).toBe("seconds");
    expect(matchingPhases(saved, "clientSale.created")).toEqual(["trigger"]);
    const decision = evaluateAutomation(saved, {
      phase: "trigger",
      eventId: "clientSale.created",
      todaySydney: "2026-11-10",
      anchorSydney: "2026-11-10",
      dueOn: null,
      signedInStatus: null,
      triggeringContractName: null,
      candidatePackageNames: ["Intro Pass"],
      waiverSigned: false,
      suppressed: false,
      passExpirationSydney: null,
      visits: [],
      serviceCount: 0,
      contracts: [],
      visitCrossingRecorded: false,
      windowAlreadyMatched: false,
      services: [],
      birthDate: null,
      remaining: null,
    });
    expect(decision.action).toBe("send");
  });

  it("keeps expiry Delay day-only and rejects minutes", () => {
    const current = findSeed("pack-expiring-3-days");
    const rejected = applyEditor(current, {
      name: current.name,
      channel: "email",
      templateId: String(current.templateId ?? 5),
      messageText: "",
      trigger: "daily",
      audience: "all",
      delay: "before-expiry",
      delayDays: "3",
      delayUnit: "minutes",
      skipBooking: false,
      skipMembership: false,
      skipSent: true,
      skipUnsubscribed: false,
    }, false);
    expect(rejected).toBe("invalid_offset");
  });

  it("shows unit labels on the edit form and persists delayUnit", async () => {
    const sqlite = openSqlite();
    const env = testEnv(asD1(sqlite));
    const app = createApp({ now: () => new Date("2026-11-10T00:00:00Z"), fetchImpl: async () => { throw new Error("unexpected"); } });
    const token = await createSessionToken("session-secret", "owner@balancemoves.com.au");
    const headers = { Cookie: `bm_automations_session=${token}` };
    const edit = await app.fetch(new Request("https://automations.example/automations/73", { headers }), env, {} as ExecutionContext);
    const editHtml = await edit.text();
    expect(editHtml).toContain('name="delayUnit"');
    expect(editHtml).toContain("<option value=\"milliseconds\"");
    expect(editHtml).toContain("<option value=\"seconds\"");
    expect(editHtml).toContain("<option value=\"minutes\"");
    expect(editHtml).toContain("<option value=\"days\"");
    expect(editHtml).toContain("after Intro Pass purchase");
    const body = new URLSearchParams({
      name: "BF Intro Moment 1",
      channel: "email",
      templateId: "14",
      trigger: "sale",
      audience: "intro",
      delay: "after-purchase",
      delayDays: "1500",
      delayUnit: "milliseconds",
      skipSent: "on",
    });
    const saved = await app.fetch(new Request("https://automations.example/automations/73", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }), env, {} as ExecutionContext);
    expect(saved.status).toBe(303);
    const row = await app.fetch(new Request("https://automations.example/admin/automations/73", { headers }), env, {} as ExecutionContext);
    const json = await row.json() as {
      automation: { timingKind: string; timingOffsetDays: number; timingOffsetUnit: string; triggerEvents: string[] };
    };
    expect(json.automation.timingKind).toBe("delay_duration");
    expect(json.automation.timingOffsetDays).toBe(1500);
    expect(json.automation.timingOffsetUnit).toBe("milliseconds");
    expect(json.automation.triggerEvents).toEqual(["clientSale.created"]);
  });
});
