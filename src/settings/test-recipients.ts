import { normalizePhone } from "@balancemoves/contacts-core";
import type { Channel } from "../automations/types";

export const DEFAULT_TEST_RECIPIENTS = "bondi@balancemoves.com.au";

export function parseTestRecipients(raw: string): { emails: Set<string>; phones: Set<string> } {
  const emails = new Set<string>();
  const phones = new Set<string>();
  for (const part of raw.split(/[\n,;]+/)) {
    const token = part.trim();
    if (!token) continue;
    if (token.includes("@")) {
      for (const piece of token.split(/\s+/)) {
        if (piece.includes("@")) emails.add(piece.toLowerCase());
      }
      continue;
    }
    const phone = normalizePhone(token);
    if (phone) phones.add(phone);
  }
  return { emails, phones };
}

export function checkTestRecipient(
  value: string,
  channel: Channel,
  allowlist: string,
): { ok: true; email: string | null; phone: string | null } | { ok: false; error: "invalid_recipient" | "test_not_allowlisted" } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: false, error: "invalid_recipient" };
  const list = parseTestRecipients(allowlist);
  if (channel === "email") {
    if (!trimmed.includes("@") || /\s/.test(trimmed)) return { ok: false, error: "invalid_recipient" };
    const email = trimmed.toLowerCase();
    if (!list.emails.has(email)) return { ok: false, error: "test_not_allowlisted" };
    return { ok: true, email, phone: null };
  }
  const phone = normalizePhone(trimmed);
  if (!phone) return { ok: false, error: "invalid_recipient" };
  if (!list.phones.has(phone)) return { ok: false, error: "test_not_allowlisted" };
  return { ok: true, email: null, phone };
}
