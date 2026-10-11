import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ORIGINAL_AUDIT, SEEDED_AUDIT } from "../src/automations/coverage-seed";
import { SEED_AUTOMATIONS } from "../src/automations/seed";
import { coverageCounts, renderCoverage } from "../src/coverage/doc";
import { DYNAMIC_LISTS, LANES, STATIC_LISTS } from "../src/segments/catalog";

describe("coverage audit", () => {
  it("accounts for 72 automations, 19 lanes, and the client lists", () => {
    expect(ORIGINAL_AUDIT).toHaveLength(13);
    expect(SEEDED_AUDIT).toHaveLength(59);
    expect(new Set([...ORIGINAL_AUDIT, ...SEEDED_AUDIT].map((row) => row.key)).size).toBe(72);
    expect(SEED_AUTOMATIONS.map((row) => row.key).sort()).toEqual([...ORIGINAL_AUDIT, ...SEEDED_AUDIT].map((row) => row.key).sort());
    expect(SEED_AUTOMATIONS.every((row) => row.enabled === false)).toBe(true);
    expect(LANES).toHaveLength(19);
    expect(DYNAMIC_LISTS).toHaveLength(13);
    expect(STATIC_LISTS.length).toBeGreaterThan(200);
    const counts = coverageCounts();
    expect(counts.automationsCovered + counts.automationsGap).toBe(72);
    expect(counts.lanesCovered + counts.lanesGap).toBe(19);
    expect(counts.dynamicCovered + counts.dynamicGap).toBe(13);
    expect(counts.staticCovered + counts.staticGap).toBe(STATIC_LISTS.length);
    expect(readFileSync("COVERAGE.md", "utf8")).toBe(renderCoverage());
  });
});
