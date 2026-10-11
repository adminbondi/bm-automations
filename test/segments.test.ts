import { describe, expect, it } from "vitest";
import { emptySnapshot, visit } from "./helpers";
import { DYNAMIC_LISTS, LANES, segmentExpiredWithin, segmentExpiringNamed } from "../src/segments/catalog";
import { matchSegment, type SegmentFacts } from "../src/segments/match";

function facts(partial: Partial<SegmentFacts> = {}): SegmentFacts {
  return {
    todaySydney: "2026-10-11",
    createdSydney: "2026-10-11",
    referredBy: null,
    snapshot: emptySnapshot(),
    ...partial,
  };
}

describe("saved segments", () => {
  it("matches each covered lane filter and refuses the red-flag gap", () => {
    const intro = emptySnapshot({
      services: [{ name: "2 Week Intro Pass", expirationSydney: "2026-10-11", current: true, remaining: 2 }],
      visits: [visit({ serviceName: "2 Week Intro Pass", startSydney: "2026-10-10" })],
    });
    const lead = facts({ createdSydney: "2026-10-11" });
    expect(matchSegment({ createdWithinDays: 1, noPurchase: true }, lead)).toBe(true);
    expect(matchSegment({ createdWithinDays: 1, noPurchase: true }, facts({ snapshot: intro }))).toBe(false);
    expect(matchSegment({ introCurrent: true }, facts({ snapshot: intro }))).toBe(true);
    expect(matchSegment({ introCurrent: true, noBooking: true }, facts({ snapshot: intro }))).toBe(false);
    expect(matchSegment({ bookedNotSignedIn: true }, facts({
      snapshot: emptySnapshot({ visits: [visit({ serviceName: "Intro", signedIn: false })] }),
    }))).toBe(true);
    expect(matchSegment({ noShowOn: true }, facts({
      snapshot: emptySnapshot({ visits: [visit({ serviceName: "Intro", lateCancelled: true, signedIn: false, startSydney: "2026-10-11" })] }),
    }))).toBe(true);
    expect(matchSegment({ maxRemaining: 4 }, facts({ snapshot: intro }))).toBe(true);
    expect(matchSegment({ referredBy: "Instagram" }, facts({ referredBy: "instagram" }))).toBe(true);
    expect(matchSegment({ referredBy: "Instagram" }, facts({ referredBy: "Google" }))).toBe(false);
    for (const lane of LANES) {
      if (lane.status === "gap") expect(lane.filter).toBeNull();
      else expect(lane.filter).toBeTruthy();
    }
    expect(LANES.find((lane) => lane.name.startsWith("RED FLAG"))?.status).toBe("gap");
  });

  it("covers dynamic list windows, including a range of expiry days", () => {
    expect(DYNAMIC_LISTS.filter((row) => row.status === "covered")).toHaveLength(DYNAMIC_LISTS.length);
    const services = [{ name: "10 Class Pack", expirationSydney: "2026-10-01", current: false }];
    expect(segmentExpiredWithin(services, "2026-10-11", 30)).toBe(true);
    expect(segmentExpiredWithin(services, "2026-12-01", 30)).toBe(false);
    expect(segmentExpiringNamed(
      [{ name: "Upfront 6 month", expirationSydney: "2026-10-20", current: true }],
      "2026-10-11",
      "upfront",
      30,
    )).toBe(true);
  });
});
