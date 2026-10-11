import { describe, expect, it } from "vitest";
import { SMS_DAY_7, SMS_EXPIRING_1_DAY, SMS_FOLLOWUP_10, SMS_GOOGLE_REVIEW, SEED_AUTOMATIONS } from "../src/automations/seed";
import { testRepo } from "./helpers";

describe("seeded automations", () => {
  it("ships every row disabled, with the nine templates and four texts", async () => {
    expect(SEED_AUTOMATIONS).toHaveLength(71);
    expect(SEED_AUTOMATIONS.every((row) => row.enabled === false)).toBe(true);
    expect(SEED_AUTOMATIONS.slice(0, 9).map((row) => row.templateId)).toEqual([5, 6, 7, 8, 9, 10, 11, 12, 13]);
    const repo = testRepo();
    const rows = await repo.listAutomations();
    expect(rows.map((row) => row.key)).toEqual(SEED_AUTOMATIONS.map((row) => row.key));
    expect(rows.map((row) => row.name)).toEqual(SEED_AUTOMATIONS.map((row) => row.name));
    expect(rows.find((row) => row.id === 1)?.name).toBe("Lead welcome");
    expect(rows.every((row) => row.enabled === false)).toBe(true);
    expect(rows.find((row) => row.id === 10)?.messageText).toBe(SMS_DAY_7);
    expect(rows.find((row) => row.id === 11)?.messageText).toBe(SMS_GOOGLE_REVIEW);
    expect(rows.find((row) => row.id === 12)?.messageText).toBe(SMS_EXPIRING_1_DAY);
    expect(rows.find((row) => row.id === 13)?.messageText).toBe(SMS_FOLLOWUP_10);
    await repo.toggleAutomation(1);
    await repo.ensureSeed();
    expect((await repo.getAutomation(1))?.enabled).toBe(true);
  });
});
