import { describe, expect, it } from "vitest";
import { verifyGithubSignature } from "../src/signature";
import { signBody } from "./sign";

const secret = "webhook-secret";
const body = JSON.stringify({ ok: true });

describe("github signature", () => {
  it("accepts the raw-body sha256 mac and rejects a mismatch", async () => {
    const bytes = new TextEncoder().encode(body);
    const bodyBytes = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(bodyBytes).set(bytes);
    const header = await signBody(body, secret);
    expect(await verifyGithubSignature(bodyBytes, header, secret)).toBe(true);
    expect(await verifyGithubSignature(bodyBytes, header, "other")).toBe(false);
    expect(await verifyGithubSignature(bodyBytes, "sha1=abcd", secret)).toBe(false);
    expect(await verifyGithubSignature(bodyBytes, null, secret)).toBe(false);
    expect(await verifyGithubSignature(bodyBytes, header, "")).toBe(false);
  });
});
