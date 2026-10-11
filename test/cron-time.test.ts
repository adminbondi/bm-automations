import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isSydneySendHour, sydneyParts } from "../src/time";

describe("sydney send hour", () => {
  it("runs the 22:00 UTC cron during daylight saving and the 23:00 UTC cron in winter", () => {
    const summerNine = new Date("2026-01-15T22:00:00Z");
    const summerTen = new Date("2026-01-15T23:00:00Z");
    const winterNine = new Date("2026-07-15T23:00:00Z");
    const winterEight = new Date("2026-07-15T22:00:00Z");
    expect(sydneyParts(summerNine).hour).toBe(9);
    expect(isSydneySendHour(summerNine, 9)).toBe(true);
    expect(isSydneySendHour(summerTen, 9)).toBe(false);
    expect(isSydneySendHour(winterNine, 9)).toBe(true);
    expect(isSydneySendHour(winterEight, 9)).toBe(false);
  });

  it("registers both UTC hours in wrangler", () => {
    const config = readFileSync("wrangler.jsonc", "utf8");
    expect(config).toContain('"0 22 * * *"');
    expect(config).toContain('"0 23 * * *"');
  });
});
