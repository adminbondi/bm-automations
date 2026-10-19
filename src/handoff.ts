import { timingSafeEqualString } from "./crypto-equal";

export const HANDOFF_APP = "automations";
export const DEFAULT_HOME_ORIGIN = "https://home.balancemoves.com.au";

export type HandoffClaims = {
  email: string;
  app: string;
  exp: number;
  jti: string;
};

export function handoffEnabled(secret: string | undefined): boolean {
  return Boolean(secret?.trim());
}

export function homeLoginUrl(origin: string | undefined): string {
  const trimmed = origin?.trim().replace(/\/$/, "");
  const base = trimmed || DEFAULT_HOME_ORIGIN;
  return `${base}/login?return=${HANDOFF_APP}`;
}

export function redirectToHome(origin: string | undefined): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: homeLoginUrl(origin), "Cache-Control": "no-store" },
  });
}

export async function signHandoffCode(secret: string, claims: HandoffClaims): Promise<string> {
  const payload = base64UrlEncode(JSON.stringify({
    email: claims.email,
    app: claims.app,
    exp: claims.exp,
    jti: claims.jti,
  }));
  const sig = await hmacBase64Url(secret, payload);
  return `${payload}.${sig}`;
}

export async function verifyHandoffCode(secret: string, code: string, now = Date.now()): Promise<HandoffClaims | null> {
  if (!secret.trim() || !code) return null;
  const dot = code.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = code.slice(0, dot);
  const sig = code.slice(dot + 1);
  if (!payload || !sig) return null;
  const expected = await hmacBase64Url(secret, payload);
  if (!(await timingSafeEqualString(expected, sig))) return null;
  let parsed: Partial<HandoffClaims>;
  try {
    parsed = JSON.parse(base64UrlDecode(payload)) as Partial<HandoffClaims>;
  } catch {
    return null;
  }
  if (typeof parsed.email !== "string" || !parsed.email.includes("@")) return null;
  if (parsed.app !== HANDOFF_APP) return null;
  if (typeof parsed.exp !== "number" || !Number.isFinite(parsed.exp) || parsed.exp <= now) return null;
  if (typeof parsed.jti !== "string" || parsed.jti.length === 0) return null;
  return { email: parsed.email, app: parsed.app, exp: parsed.exp, jti: parsed.jti };
}

async function hmacBase64Url(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return bytesToBase64Url(new Uint8Array(mac));
}

function base64UrlEncode(text: string): string {
  return bytesToBase64Url(new TextEncoder().encode(text));
}

function base64UrlDecode(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "==".slice((value.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
