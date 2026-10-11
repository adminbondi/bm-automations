import { bytesToBase64 } from "./bytes";
import { timingSafeEqualString } from "./crypto-equal";

export async function mindbodySignature(rawBody: string, key: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(rawBody));
  return `sha256=${bytesToBase64(new Uint8Array(digest))}`;
}

export async function verifyMindbodySignature(rawBody: string, header: string | null, key: string): Promise<boolean> {
  if (!header || !key) return false;
  const expected = await mindbodySignature(rawBody, key);
  return timingSafeEqualString(expected, header.trim());
}
