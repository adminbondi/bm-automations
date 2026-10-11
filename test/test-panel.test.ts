import { describe, expect, it } from "vitest";
import { SEED_AUTOMATIONS } from "../src/automations/seed";
import { evaluateTest, subjectFromSample, emptySample } from "../src/automations/test-panel";
import { checkTestRecipient, parseTestRecipients } from "../src/settings/test-recipients";
import { readPublicSettings, writeSettings } from "../src/settings/service";
import { runtimeConfig } from "../src/env";
import { testRepo } from "./helpers";

const today = "2026-10-11";

function automation(key: string) {
  const row = SEED_AUTOMATIONS.find((item) => item.key === key);
  if (!row) throw new Error(key);
  return row;
}

function sample(patch: Partial<ReturnType<typeof emptySample>>) {
  return subjectFromSample({ ...emptySample(), ...patch }, today);
}

describe("send-test rules", () => {
  it("would send a lead with no purchase and skip one who already bought", () => {
    const lead = automation("lead-immediate");
    const open = evaluateTest(lead, sample({ first: "Priya" }), today, { studioName: "Balance Moves", appendReplyStop: false });
    expect(open.outcome).toBe("send");
    expect(open.headline).toContain("Would send");
    expect(open.rendered).toContain("FirstName: Priya");
    expect(lead.enabled).toBe(false);

    const bought = evaluateTest(lead, sample({ first: "Priya", pack: "2 Week Intro Pass" }), today, {
      studioName: "Balance Moves",
      appendReplyStop: false,
    });
    expect(bought.outcome).toBe("skip");
    expect(bought.reason).toBe("has_intro_or_purchase");
    expect(bought.headline).toContain("Would skip");
    expect(bought.rendered).toContain("FirstName: Priya");
  });

  it("fills the day-7 text from sample visits and skips when a class is booked", () => {
    const row = automation("trial-day-7-no-booking");
    const ready = evaluateTest(
      row,
      sample({ first: "Priya", pack: "2 Week Intro Pass", created: "2026-10-04", visits: "0" }),
      today,
      { studioName: "Balance Moves", appendReplyStop: true },
    );
    expect(ready.outcome).toBe("send");
    expect(ready.rendered).toContain("Hey Priya");
    expect(ready.rendered).toContain("Balance Moves");
    expect(ready.rendered).toContain("Reply STOP");

    const booked = evaluateTest(
      row,
      sample({ first: "Priya", pack: "2 Week Intro Pass", created: "2026-10-04", visits: "1" }),
      today,
      { studioName: "Balance Moves", appendReplyStop: false },
    );
    expect(booked.outcome).toBe("skip");
    expect(booked.reason).toBe("has_booking");

    const early = evaluateTest(
      row,
      sample({ first: "Priya", pack: "2 Week Intro Pass", created: today }),
      today,
      { studioName: "Balance Moves", appendReplyStop: false },
    );
    expect(early.outcome).toBe("skip");
    expect(early.reason).toBe("not_due");
  });

  it("sends a birthday text only on the birth date", () => {
    const row = automation("birthday-day-text");
    const todayBirth = evaluateTest(row, sample({ first: "Priya", birth: "1990-10-11" }), today, {
      studioName: "Balance Moves",
      appendReplyStop: false,
    });
    expect(todayBirth.outcome).toBe("send");
    expect(todayBirth.rendered).toContain("Priya");
    const other = evaluateTest(row, sample({ first: "Priya", birth: "1990-03-01" }), today, {
      studioName: "Balance Moves",
      appendReplyStop: false,
    });
    expect(other.outcome).toBe("skip");
    expect(other.reason).toBe("not_due");
  });
});

describe("test recipients", () => {
  it("defaults to bondi@ and matches emails and mobiles", async () => {
    const repo = testRepo();
    const config = runtimeConfig({ SETTINGS_ENCRYPTION_KEY: "settings-key" });
    const fresh = await readPublicSettings(repo, config);
    expect(fresh.testRecipients).toBe("bondi@balancemoves.com.au");
    expect(checkTestRecipient("Bondi@BalanceMoves.com.au", "email", fresh.testRecipients).ok).toBe(true);
    expect(checkTestRecipient("owner@balancemoves.com.au", "email", fresh.testRecipients)).toEqual({
      ok: false,
      error: "test_not_allowlisted",
    });
    expect(checkTestRecipient("", "email", fresh.testRecipients)).toEqual({ ok: false, error: "invalid_recipient" });

    const saved = await writeSettings(repo, config, {
      testRecipients: "bondi@balancemoves.com.au\n0400 000 000",
    });
    expect(parseTestRecipients(saved.testRecipients).phones.has("+61400000000")).toBe(true);
    expect(checkTestRecipient("0400 000 000", "sms", saved.testRecipients)).toMatchObject({ ok: true, phone: "+61400000000" });
    expect(checkTestRecipient("+61411111111", "sms", saved.testRecipients).ok).toBe(false);

    const cleared = await writeSettings(repo, config, { testRecipients: "" });
    expect(cleared.testRecipients).toBe("");
    expect(checkTestRecipient("bondi@balancemoves.com.au", "email", cleared.testRecipients).ok).toBe(false);
  });
});
