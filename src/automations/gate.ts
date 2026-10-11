import { normalizePhone } from "../phone";
import type { Channel } from "./types";

export type GateInput = {
  devMode: boolean;
  dryRun: boolean;
  enabled: boolean;
  emailAllowlist: string[];
  phoneAllowlist: string[];
  channel: Channel;
  email: string | null;
  phone: string | null;
  alreadySent: boolean;
  suppressed: boolean;
  withinQuietHours: boolean;
  quietAction?: "hold" | "skip";
};

export type GateResult =
  | { outcome: "send"; listmonkCall: true; twilioCall: false; reason: "send"; terminal: true; email: string; phone: null }
  | { outcome: "send"; listmonkCall: false; twilioCall: true; reason: "send"; terminal: true; email: null; phone: string }
  | { outcome: "dry_run"; listmonkCall: false; twilioCall: false; reason: "dry_run"; terminal: false; email: string | null; phone: string | null }
  | { outcome: "skip"; listmonkCall: false; twilioCall: false; reason: string; terminal: boolean; email: string | null; phone: string | null };

export function gateSend(input: GateInput): GateResult {
  const email = input.email?.trim().toLowerCase() || null;
  const phone = normalizePhone(input.phone);
  const base = { email, phone, listmonkCall: false as const, twilioCall: false as const };
  if (input.channel === "sms" && !phone) return { outcome: "skip", ...base, reason: "no_phone", terminal: true };
  if (input.channel === "email" && !email) return { outcome: "skip", ...base, reason: "no_email", terminal: true };
  if (input.alreadySent) return { outcome: "skip", ...base, reason: "already_sent", terminal: true };
  if (input.suppressed) return { outcome: "skip", ...base, reason: "suppressed", terminal: true };
  if (!input.enabled) return { outcome: "skip", ...base, reason: "automation_disabled", terminal: false };
  const allowed = input.channel === "sms"
    ? !input.devMode || input.phoneAllowlist.includes(phone ?? "")
    : !input.devMode || input.emailAllowlist.includes(email ?? "");
  if (!allowed) return { outcome: "skip", ...base, reason: "dev_allowlist", terminal: false };
  if (input.channel === "sms" && input.withinQuietHours) {
    return { outcome: "skip", ...base, reason: "quiet_hours", terminal: input.quietAction === "skip" };
  }
  if (input.dryRun) return { outcome: "dry_run", ...base, reason: "dry_run", terminal: false };
  if (input.channel === "sms" && phone) {
    return { outcome: "send", listmonkCall: false, twilioCall: true, reason: "send", terminal: true, email: null, phone };
  }
  return { outcome: "send", listmonkCall: true, twilioCall: false, reason: "send", terminal: true, email: email ?? "", phone: null };
}

export function dedupeKey(automationId: number, clientId: string, recipient: "primary" | "copy" = "primary"): string {
  if (recipient === "copy") return `automation:${automationId}:client:${clientId}:copy`;
  return `automation:${automationId}:client:${clientId}`;
}

export function unsubscribeUrl(baseUrl: string, subscriberUuid: string | null): string {
  const root = baseUrl.replace(/\/$/, "");
  if (subscriberUuid) return `${root}/subscription/${subscriberUuid}/${subscriberUuid}`;
  return `${root}/subscription/form`;
}

export function withUnsubscribe(data: Record<string, unknown>, url: string): Record<string, unknown> {
  return { ...data, unsubscribeUrl: url, preferencesUrl: url };
}
