import { describe, expect, it } from "vitest";
import { mindbodySignature, verifyMindbodySignature } from "../src/signature";

describe("mindbody signature", () => {
  it("accepts the sha256 base64 header and rejects a mismatch", async () => {
    const body = JSON.stringify({ messageId: "m", eventId: "client.created" });
    const header = await mindbodySignature(body, "sign-key");
    expect(header.startsWith("sha256=")).toBe(true);
    expect(await verifyMindbodySignature(body, header, "sign-key")).toBe(true);
    expect(await verifyMindbodySignature(body, header, "other")).toBe(false);
    expect(await verifyMindbodySignature(body, null, "sign-key")).toBe(false);
  });
});
