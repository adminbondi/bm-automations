const HEADER_PREFIX = "sha256=";
const HEX_MAC = /^[0-9a-f]{64}$/;

/**
 * Verify GitHub's X-Hub-Signature-256 header against the raw request body.
 * An empty secret rejects every request. Comparison hashes both MAC strings
 * first so the check does not leak the expected value through timing.
 */
export async function verifyGithubSignature(
  body: ArrayBuffer,
  header: string | null,
  secret: string,
): Promise<boolean> {
  if (!secret || !header || header.length > HEADER_PREFIX.length + 64) return false;
  if (!header.startsWith(HEADER_PREFIX)) return false;
  const provided = header.slice(HEADER_PREFIX.length).toLowerCase();
  if (!HEX_MAC.test(provided)) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, body);
  const actual = toHex(new Uint8Array(mac));
  return fixedEqual(actual, provided);
}

async function fixedEqual(actual: string, provided: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [actualHash, providedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(actual)),
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
  ]);
  if (typeof crypto.subtle.timingSafeEqual === "function") {
    return crypto.subtle.timingSafeEqual(actualHash, providedHash);
  }
  return timingSafeEqualBytes(new Uint8Array(actualHash), new Uint8Array(providedHash));
}

/** Equal-length fallback for runtimes whose Web Crypto has no timingSafeEqual. */
function timingSafeEqualBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return diff === 0;
}

function toHex(bytes: Uint8Array): string {
  let hex = "";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  return hex;
}
