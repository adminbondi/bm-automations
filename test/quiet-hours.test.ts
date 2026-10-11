import { describe, expect, it } from "vitest";
import { isQuietHours, sydneyParts } from "../src/time";

describe("sms quiet hours", () => {
  it("treats 20:00–09:00 Sydney as an overnight quiet window", () => {
    const evening = new Date("2026-10-11T10:00:00Z");
    const opens = new Date("2026-10-10T22:00:00Z");
    const before = new Date("2026-10-11T08:59:00Z");
    const still = new Date("2026-10-10T21:59:00Z");
    expect(sydneyParts(evening)).toMatchObject({ hour: 21, minute: 0 });
    expect(sydneyParts(opens)).toMatchObject({ hour: 9, minute: 0 });
    expect(isQuietHours(evening, "20:00", "09:00")).toBe(true);
    expect(isQuietHours(opens, "20:00", "09:00")).toBe(false);
    expect(isQuietHours(before, "20:00", "09:00")).toBe(false);
    expect(isQuietHours(still, "20:00", "09:00")).toBe(true);
    const noon = new Date("2026-10-11T01:30:00Z");
    expect(sydneyParts(noon).hour).toBe(12);
    expect(isQuietHours(noon, "12:00", "13:00")).toBe(true);
    expect(isQuietHours(opens, "12:00", "13:00")).toBe(false);
  });
});
