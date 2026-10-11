import { describe, expect, it } from "vitest";
import { createSessionToken } from "../src/auth";
import { applyEditor, derivedAudience, derivedDelay, derivedTrigger } from "../src/http/editor";
import { createApp } from "../src/index";
import { findSeed, LOYALSNAP_LIVE_KEYS, SEED_AUTOMATIONS, SMS_DAY_7 } from "../src/automations/seed";
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
    expect(html).toContain(`All ${SEED_AUTOMATIONS.length} automations are <b>off</b>`);
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

  it("lists the 13 LoyalSnap automations above a collapsed Not in use group", async () => {
    const sqlite = openSqlite();
    const env = testEnv(asD1(sqlite));
    const app = createApp({ now: () => new Date("2026-10-11T00:00:00Z"), fetchImpl: async () => { throw new Error("unexpected"); } });
    const token = await createSessionToken("session-secret", "owner@balancemoves.com.au");
    const list = await app.fetch(new Request("https://automations.example/automations", {
      headers: { Cookie: `bm_automations_session=${token}` },
    }), env, {} as ExecutionContext);
    const html = await list.text();
    expect(LOYALSNAP_LIVE_KEYS.size).toBe(13);
    expect(html.indexOf("Lead welcome")).toBeGreaterThan(-1);
    expect(html.indexOf("Lead welcome")).toBeLessThan(html.indexOf("Not in use"));
    expect(html.indexOf("Not in use")).toBeLessThan(html.indexOf("Lapsed 30 days"));
    expect(html).toContain(".side{position:fixed");
    expect(html).toContain("height:100vh");
    expect(html).toContain(">Tasks<");
    expect(html).toContain("<details class=\"unused\">");
    expect(html).not.toContain("<details class=\"unused\" open");
    expect(html).toContain(">59<");
    expect(html).toContain("Red flag, under 3 credits");
  });

  it("shows a number or date under the trigger for each new rule", async () => {
    const sqlite = openSqlite();
    const env = testEnv(asD1(sqlite));
    const app = createApp({ now: () => new Date("2026-10-11T00:00:00Z"), fetchImpl: async () => { throw new Error("unexpected"); } });
    const token = await createSessionToken("session-secret", "owner@balancemoves.com.au");
    const headers = { Cookie: `bm_automations_session=${token}` };
    const page = async (id: number) => {
      const response = await app.fetch(new Request(`https://automations.example/automations/${id}`, { headers }), env, {} as ExecutionContext);
      return response.text();
    };
    const since = await page(43);
    expect(since).toContain("Days since last visit");
    expect(since).toContain("value=\"30\"");
    expect(since).not.toContain("id=\"rule-box\" hidden");
    expect(since).toContain("id=\"delay-box\" hidden");
    const birthday = await page(70);
    expect(birthday).toContain("On their birthday");
    expect(birthday).toContain("id=\"rule-date\"");
    expect(birthday).toContain("29 Feb");
    const nth = await page(33);
    expect(nth).toContain("Every Nth visit");
    expect(nth).toContain("value=\"35\"");
    const credits = await page(59);
    expect(credits).toContain("Credits remaining");
    expect(credits).toContain("value=\"2\"");
    const under = await page(72);
    expect(under).toContain("Red flag, under 3 credits");
    expect(under).toContain("value=\"under-credits\" selected");
    expect(under).toContain("Under this many credits");
    expect(under).toContain("value=\"3\"");
    expect(under).toContain("booking or visit payload");
    const window = await page(66);
    expect(window).toContain("Visit window");
    expect(window).toContain("value=\"14\"");
    const lead = await page(24);
    expect(lead).toContain("External lead");
    expect(lead).toContain("value=\"2\"");
    const classic = await page(10);
    expect(classic).toContain("id=\"rule-box\" hidden");
    expect(classic).toContain("id=\"delay-box\"");
    expect(classic).not.toContain("id=\"delay-box\" hidden");
  });

  it("saves the new trigger rules without turning the automation on", () => {
    const base = (current: ReturnType<typeof findSeed>, trigger: string, ruleNumber: string) => applyEditor(current, {
      name: current.name,
      channel: current.channel,
      templateId: String(current.templateId ?? ""),
      messageText: current.messageText ?? "",
      trigger,
      audience: derivedAudience(current),
      delay: derivedDelay(current),
      delayDays: String(current.timingOffsetDays ?? ""),
      skipBooking: Boolean(current.skipRules.skipIfHasBooking),
      skipMembership: Boolean(current.skipRules.skipIfMembership),
      skipSent: current.skipRules.skipIfAlreadySent !== false,
      skipUnsubscribed: Boolean(current.skipRules.skipIfUnsubscribed),
      ruleNumber,
    }, false);

    const lapsed = base(findSeed("lapsed-30-days"), "since-visit", "45");
    expect(typeof lapsed).not.toBe("string");
    if (typeof lapsed === "string") return;
    expect(lapsed.enabled).toBe(false);
    expect(lapsed.timingKind).toBe("days_since_last_visit");
    expect(lapsed.timingOffsetDays).toBe(45);
    expect(lapsed.filters.clientActivity).toBe("inactive");

    const birthday = base(findSeed("birthday-day-text"), "birthday", "");
    expect(typeof birthday).not.toBe("string");
    if (typeof birthday === "string") return;
    expect(birthday.timingKind).toBe("birthday_day");
    expect(birthday.skipRules.repeat).toBe("yearly");

    const nth = base(findSeed("member-referral-every-35"), "every-nth", "35");
    expect(typeof nth).not.toBe("string");
    if (typeof nth === "string") return;
    expect(nth.skipRules.everyNthVisit).toBe(35);
    expect(nth.skipRules.dedupeScope).toBe("visit_milestone");

    const credits = base(findSeed("pack-two-remaining"), "credits", "2");
    expect(typeof credits).not.toBe("string");
    if (typeof credits === "string") return;
    expect(credits.filters.exactRemaining).toBe(2);
    expect(credits.timingKind).toBe("immediate");

    const red = base(findSeed("red-flag-under-3-credits"), "under-credits", "3");
    expect(typeof red).not.toBe("string");
    if (typeof red === "string") return;
    expect(red.enabled).toBe(false);
    expect(red.filters.maxRemaining).toBe(2);
    expect(red.filters.exactRemaining).toBeUndefined();
    expect(red.filters.signedInStatus).toBeUndefined();
    expect(red.timingKind).toBe("immediate");
    expect(red.triggerEvents).toEqual(["classRosterBooking.created", "classRosterBookingStatus.updated"]);
    expect(base(findSeed("red-flag-under-3-credits"), "under-credits", "0")).toBe("invalid_offset");

    const windowed = base(findSeed("classpass-two-in-two-weeks"), "visit-window", "14");
    expect(typeof windowed).not.toBe("string");
    if (typeof windowed === "string") return;
    expect(windowed.skipRules.visitWindowDays).toBe(14);
    expect(windowed.skipRules.minVisitsInWindow).toBe(2);

    const lead = base(findSeed("external-day-2"), "lead", "2");
    expect(typeof lead).not.toBe("string");
    if (typeof lead === "string") return;
    expect(lead.timingKind).toBe("delay_days");
    expect(lead.timingOffsetDays).toBe(2);
    expect(lead.scheduleOnEvents).toEqual(["lead.created"]);

    const now = base(findSeed("external-immediate"), "lead", "0");
    expect(typeof now).not.toBe("string");
    if (typeof now === "string") return;
    expect(now.timingKind).toBe("immediate");
    expect(now.triggerEvents).toEqual(["lead.created"]);

    expect(base(findSeed("member-referral-every-35"), "every-nth", "0")).toBe("invalid_offset");
  });
});
