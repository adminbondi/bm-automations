import { timingSafeEqualString } from "./crypto-equal";

export const SESSION_COOKIE = "bm_automations_session";
export const STATE_COOKIE = "bm_automations_oauth_state";
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7;
const STATE_MAX_AGE_SEC = 60 * 10;

export type SessionPayload = { email: string; exp: number };

export function parseAdminEmails(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.includes("@"));
}

export function isAdminEmail(email: string, allowlist: string[]): boolean {
  const normalized = email.trim().toLowerCase();
  return normalized.length > 0 && allowlist.includes(normalized);
}

export function googleAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export function callbackRedirectUri(origin: string): string {
  return `${origin.replace(/\/$/, "")}/auth/google/callback`;
}

export function googleConfigured(env: { googleClientId: string; googleClientSecret: string; sessionSecret: string }): boolean {
  return Boolean(env.googleClientId && env.googleClientSecret && env.sessionSecret);
}

export async function createSessionToken(secret: string, email: string, now = Date.now()): Promise<string> {
  const payload = { email: email.trim().toLowerCase(), exp: now + SESSION_MAX_AGE_SEC * 1000 };
  return signPayload(secret, JSON.stringify(payload));
}

export async function readSession(secret: string, cookieHeader: string | null, now = Date.now()): Promise<SessionPayload | null> {
  const token = cookieValue(cookieHeader, SESSION_COOKIE);
  const raw = await verifySignedPayload(secret, token);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SessionPayload>;
    if (!parsed.email || typeof parsed.exp !== "number" || parsed.exp <= now) return null;
    return { email: parsed.email, exp: parsed.exp };
  } catch {
    return null;
  }
}

export function sessionCookie(token: string): string {
  return cookie(SESSION_COOKIE, token, SESSION_MAX_AGE_SEC);
}

export function clearSessionCookie(): string {
  return cookie(SESSION_COOKIE, "", 0);
}

export function oauthStateCookie(state: string): string {
  return cookie(STATE_COOKIE, state, STATE_MAX_AGE_SEC);
}

export function clearOauthStateCookie(): string {
  return cookie(STATE_COOKIE, "", 0);
}

export function readOauthState(cookieHeader: string | null): string | null {
  return cookieValue(cookieHeader, STATE_COOKIE);
}

function cookie(name: string, value: string, maxAge: number): string {
  return [`${name}=${value}`, "Path=/", "HttpOnly", "Secure", "SameSite=Lax", `Max-Age=${maxAge}`].join("; ");
}

function cookieValue(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${name}=`)) return trimmed.slice(name.length + 1);
  }
  return null;
}

async function signPayload(secret: string, payload: string): Promise<string> {
  const encoded = base64UrlEncode(payload);
  const key = await hmacKey(secret);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encoded));
  return `${encoded}.${bytesToBase64Url(new Uint8Array(mac))}`;
}

async function verifySignedPayload(secret: string, token: string | null): Promise<string | null> {
  if (!token || !secret) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const key = await hmacKey(secret);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const expected = bytesToBase64Url(new Uint8Array(mac));
  if (!(await timingSafeEqualString(expected, sig))) return null;
  try {
    return base64UrlDecode(payload);
  } catch {
    return null;
  }
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
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
