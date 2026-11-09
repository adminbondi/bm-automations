import { describe, expect, it } from "vitest";
import { ingestDecision, verifyBearerToken } from "../src/ingest";

describe("ingestDecision", () => {
  it("formats a short automation failure", () => {
    const decision = ingestDecision({
      source: "bm-automations-dev",
      event: "subscriber_missing",
      automationKey: "bf-intro-moment-1",
      clientId: "100025122",
      channel: "email",
      detail: "after_retries",
    });
    expect(decision.kind).toBe("alert");
    if (decision.kind !== "alert") return;
    expect(decision.text).toContain("Source: bm-automations-dev");
    expect(decision.text).toContain("Event: subscriber_missing");
    expect(decision.text).toContain("Automation: bf-intro-moment-1");
    expect(decision.text).toContain("Client: 100025122");
    expect(decision.text).not.toContain("@");
  });

  it("rejects missing source or event", () => {
    expect(ingestDecision({ source: "x" })).toEqual({
      kind: "reject",
      status: 400,
      reason: "source_and_event_required",
    });
  });

  it("clips long detail to one short line", () => {
    const decision = ingestDecision({
      source: "bm-automations",
      event: "send_error",
      detail: `${"x".repeat(300)}\nsecret email ada@example.com`,
    });
    expect(decision.kind).toBe("alert");
    if (decision.kind !== "alert") return;
    expect(decision.text).toContain("Detail: ");
    expect(decision.text).not.toContain("ada@example.com");
    const detailLine = decision.text.split("\n").find((line) => line.startsWith("Detail: "));
    expect(detailLine).toBeTruthy();
    expect(detailLine!.endsWith("...")).toBe(true);
    expect(detailLine!.length).toBeLessThanOrEqual(220);
  });
});

describe("verifyBearerToken", () => {
  it("accepts a matching Bearer token", async () => {
    expect(await verifyBearerToken("Bearer secret-token", "secret-token")).toBe(true);
    expect(await verifyBearerToken("bearer secret-token", "secret-token")).toBe(true);
  });

  it("rejects missing, empty, or wrong tokens", async () => {
    expect(await verifyBearerToken(null, "secret-token")).toBe(false);
    expect(await verifyBearerToken("Bearer other", "secret-token")).toBe(false);
    expect(await verifyBearerToken("Bearer secret-token", "")).toBe(false);
    expect(await verifyBearerToken("secret-token", "secret-token")).toBe(false);
  });
});
