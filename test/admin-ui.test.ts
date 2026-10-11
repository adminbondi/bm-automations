import { describe, expect, it } from "vitest";
import { createSessionToken } from "../src/auth";
import { applyEditor, derivedAudience, derivedDelay, derivedTrigger } from "../src/http/editor";
import { createApp } from "../src/index";
import { findSeed, SMS_DAY_7 } from "../src/automations/seed";
import { TEMPLATE_SUBJECTS } from "../src/automations/subjects";
import { withReplyStop } from "../src/sms";
import { asD1, openSqlite, testEnv } from "./helpers";

describe("admin pages", () => {
  it("keeps the listmonk subjects and leaves Reply STOP off", () => {
    expect(TEMPLATE_SUBJECTS[5]).toBe("Welcome aboard — we’ve saved your spot!");
    expect(TEMPLATE_SUBJECTS[6]).toBe("{{ .Subscriber.FirstName }}, keep health and fitness a top priority");
    expect(TEMPLATE_SUBJECTS[8]).toBe("Congrats, {{ .Subscriber.FirstName }}! You're on a roll!");
    expect(TEMPLATE_SUBJECTS[13]).toBe("Welcome to Balance Moves - WAIVER SIGNATURE & What to expect");
    expect(withReplyStop("Hello", false)).toBe("Hello");
    expect(withReplyStop("Hello", true)).toBe("Hello\nReply STOP");
    expect(withReplyStop("Reply STOP", true)).toBe("Reply STOP");
  });

  it("saves the day-7 text without enabling it or widening the rules", () => {
    const current = findSeed("trial-day-7-no-booking");
    const saved = applyEditor(current, {
      name: current.name,
      channel: "sms",
      templateId: "7",
      messageText: current.messageText ?? "",
      trigger: derivedTrigger(current),
      audience: derivedAudience(current),
      delay: derivedDelay(current),
      delayDays: String(current.timingOffsetDays ?? ""),
      skipBooking: true,
      skipMembership: false,
      skipSent: true,
      skipUnsubscribed: false,
    }, false);
    expect(typeof saved).not.toBe("string");
    if (typeof saved === "string") return;
    expect(saved.enabled).toBe(false);
    expect(saved.messageText).toBe(SMS_DAY_7);
    expect(saved.templateId).toBeNull();
    expect(saved.skipRules.skipIfHasBooking).toBe(true);
    expect(saved.skipRules.skipIfMembership).toBeFalsy();
    expect(saved.filters.packageNameIncludes).toEqual(current.filters.packageNameIncludes);
    expect(saved.timingKind).toBe("delay_days");
    expect(saved.timingOffsetDays).toBe(7);
    expect(saved.scheduleOnEvents).toEqual(["clientSale.created"]);
  });

  it("serves the list behind the session and keeps every automation off", async () => {
    const sqlite = openSqlite();
    const env = testEnv(asD1(sqlite));
    const app = createApp({ now: () => new Date("2026-10-11T00:00:00Z"), fetchImpl: async () => { throw new Error("unexpected"); } });
    const anon = await app.fetch(new Request("https://automations.example/automations"), env, {} as ExecutionContext);
    expect(anon.status).toBe(200);
    expect(await anon.text()).toContain("Sign in with a Google account");
    const token = await createSessionToken("session-secret", "owner@balancemoves.com.au");
    const headers = { Cookie: `bm_automations_session=${token}` };
    const list = await app.fetch(new Request("https://automations.example/automations", { headers }), env, {} as ExecutionContext);
    const html = await list.text();
    expect(list.status).toBe(200);
    expect(html).toContain("Lead welcome");
    expect(html).toContain("Welcome aboard — we’ve saved your spot!");
    expect(html).toContain("https://mb-task-dashboard.plain-bush-daad.workers.dev/");
    expect(html).toContain("Trial day 7 – no class booked");
    expect(html).toContain("All 13 automations are <b>off</b>");
    const settings = await app.fetch(new Request("https://automations.example/settings", { headers }), env, {} as ExecutionContext);
    const settingsHtml = await settings.text();
    expect(settingsHtml).toContain("Not connected");
    expect(settingsHtml).toContain("20:00");
    expect(settingsHtml).toContain("09:00");
    expect(settingsHtml).toContain("Reply STOP");
    expect(settingsHtml).toContain("https://campaigns.balancemoves.com.au");
    const log = await app.fetch(new Request("https://automations.example/log", { headers }), env, {} as ExecutionContext);
    expect(await log.text()).toContain("Example data");
    const edit = await app.fetch(new Request("https://automations.example/automations/10", { headers }), env, {} as ExecutionContext);
    const editHtml = await edit.text();
    expect(editHtml).toContain("Hey [First name]");
    expect(editHtml).toContain("Has booked or taken a class");
    const body = new URLSearchParams({
      name: "Trial day 7 – no class booked",
      channel: "sms",
      messageText: SMS_DAY_7,
      trigger: "daily",
      audience: "intro",
      delay: "after-purchase",
      delayDays: "7",
      skipBooking: "on",
      skipSent: "on",
    });
    const saved = await app.fetch(new Request("https://automations.example/automations/10", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }), env, {} as ExecutionContext);
    expect(saved.status).toBe(303);
    const row = await app.fetch(new Request("https://automations.example/admin/automations/10", { headers }), env, {} as ExecutionContext);
    const json = await row.json() as { automation: { enabled: boolean; skipRules: { skipIfHasBooking?: boolean }; filters: { packageNameIncludes?: string[] } } };
    expect(json.automation.enabled).toBe(false);
    expect(json.automation.skipRules.skipIfHasBooking).toBe(true);
    expect(json.automation.filters.packageNameIncludes).toContain("intro pass");
  });
});
