import { normalizePhone } from "@balancemoves/contacts-core";
import { parseContactWriteMode, type ContactWriteMode } from "./sync/mode";
import { DEFAULT_QUIET_END, DEFAULT_QUIET_START } from "./time";

export interface RuntimeBindings {
  DEV_MODE?: string;
  DRY_RUN?: string;
  SEND_ALLOWLIST?: string;
  SMS_ALLOWLIST?: string;
  MINDBODY_SITE_ID?: string;
  LISTMONK_BASE_URL?: string;
  LISTMONK_LIST_ID?: string;
  LISTMONK_SUPPRESSED_LIST_ID?: string;
  SYDNEY_SEND_HOUR?: string;
  ADMIN_EMAILS?: string;
  DEFAULT_FROM_EMAIL?: string;
  SMS_QUIET_START?: string;
  SMS_QUIET_END?: string;
  STUDIO_NAME?: string;
  TWILIO_FROM_NUMBER?: string;
  TWILIO_SENDER_NAME?: string;
  MINDBODY_API_KEY?: string;
  MINDBODY_STAFF_USERNAME?: string;
  MINDBODY_STAFF_PASSWORD?: string;
  MINDBODY_WEBHOOK_SIGNATURE_KEY?: string;
  LISTMONK_API_USER?: string;
  LISTMONK_API_TOKEN?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  SESSION_SECRET?: string;
  SETTINGS_ENCRYPTION_KEY?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  LEAD_WEBHOOK_SECRET?: string;
  CONTACT_WRITE_MODE?: string;
}

export type RuntimeConfig = {
  devMode: boolean;
  dryRun: boolean;
  emailAllowlist: string[];
  phoneAllowlist: string[];
  siteId: string;
  listmonkBaseUrl: string;
  listmonkListId: string;
  listmonkSuppressedListId: string;
  sydneySendHour: number;
  adminEmails: string[];
  defaultFromEmail: string;
  smsQuietStart: string;
  smsQuietEnd: string;
  studioName: string;
  twilioFromNumber: string;
  twilioSenderName: string;
  mindbodyApiKey: string;
  mindbodyStaffUsername: string;
  mindbodyStaffPassword: string;
  webhookSignatureKey: string;
  listmonkApiUser: string;
  listmonkApiToken: string;
  googleClientId: string;
  googleClientSecret: string;
  sessionSecret: string;
  settingsEncryptionKey: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  leadWebhookSecret: string;
  contactWriteMode: ContactWriteMode;
};

export function parseDevMode(value: string | undefined): boolean {
  if (value === undefined || value.trim() === "") return true;
  return value === "true" || value === "1";
}

export function parseFlag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === "") return fallback;
  return value === "true" || value === "1";
}

export function parseEmailList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.includes("@"));
}

export function parsePhoneList(...values: (string | undefined)[]): string[] {
  const phones = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    for (const entry of value.split(",")) {
      const trimmed = entry.trim();
      if (!trimmed || trimmed.includes("@")) continue;
      const phone = normalizePhone(trimmed);
      if (phone) phones.add(phone);
    }
  }
  return [...phones];
}

export function runtimeConfig(env: RuntimeBindings): RuntimeConfig {
  const hour = Number(env.SYDNEY_SEND_HOUR ?? "9");
  const quietStart = env.SMS_QUIET_START?.trim() || DEFAULT_QUIET_START;
  const quietEnd = env.SMS_QUIET_END?.trim() || DEFAULT_QUIET_END;
  return {
    devMode: parseDevMode(env.DEV_MODE),
    dryRun: parseFlag(env.DRY_RUN, false),
    emailAllowlist: parseEmailList(env.SEND_ALLOWLIST),
    phoneAllowlist: parsePhoneList(env.SMS_ALLOWLIST, env.SEND_ALLOWLIST),
    siteId: env.MINDBODY_SITE_ID?.trim() || "9853",
    listmonkBaseUrl: (env.LISTMONK_BASE_URL ?? "https://campaigns.balancemoves.com.au").replace(/\/$/, ""),
    listmonkListId: env.LISTMONK_LIST_ID?.trim() ?? "",
    listmonkSuppressedListId: env.LISTMONK_SUPPRESSED_LIST_ID?.trim() ?? "",
    sydneySendHour: Number.isInteger(hour) ? hour : 9,
    adminEmails: parseEmailList(env.ADMIN_EMAILS),
    defaultFromEmail: env.DEFAULT_FROM_EMAIL?.trim() ?? "",
    smsQuietStart: quietStart,
    smsQuietEnd: quietEnd,
    studioName: env.STUDIO_NAME?.trim() || "Balance Moves",
    twilioFromNumber: env.TWILIO_FROM_NUMBER?.trim() ?? "",
    twilioSenderName: env.TWILIO_SENDER_NAME?.trim() ?? "",
    mindbodyApiKey: env.MINDBODY_API_KEY ?? "",
    mindbodyStaffUsername: env.MINDBODY_STAFF_USERNAME ?? "",
    mindbodyStaffPassword: env.MINDBODY_STAFF_PASSWORD ?? "",
    webhookSignatureKey: env.MINDBODY_WEBHOOK_SIGNATURE_KEY ?? "",
    listmonkApiUser: env.LISTMONK_API_USER ?? "",
    listmonkApiToken: env.LISTMONK_API_TOKEN ?? "",
    googleClientId: env.GOOGLE_CLIENT_ID ?? "",
    googleClientSecret: env.GOOGLE_CLIENT_SECRET ?? "",
    sessionSecret: env.SESSION_SECRET ?? "",
    settingsEncryptionKey: env.SETTINGS_ENCRYPTION_KEY ?? "",
    twilioAccountSid: env.TWILIO_ACCOUNT_SID ?? "",
    twilioAuthToken: env.TWILIO_AUTH_TOKEN ?? "",
    leadWebhookSecret: env.LEAD_WEBHOOK_SECRET ?? "",
    contactWriteMode: parseContactWriteMode(env.CONTACT_WRITE_MODE),
  };
}

export function bindingsFromEnv(env: Env): RuntimeBindings {
  const secret = (name: string) => {
    const value = Reflect.get(env, name);
    return typeof value === "string" ? value : "";
  };
  return {
    DEV_MODE: env.DEV_MODE,
    DRY_RUN: env.DRY_RUN,
    SEND_ALLOWLIST: env.SEND_ALLOWLIST,
    SMS_ALLOWLIST: env.SMS_ALLOWLIST,
    MINDBODY_SITE_ID: env.MINDBODY_SITE_ID,
    LISTMONK_BASE_URL: env.LISTMONK_BASE_URL,
    LISTMONK_LIST_ID: env.LISTMONK_LIST_ID,
    LISTMONK_SUPPRESSED_LIST_ID: env.LISTMONK_SUPPRESSED_LIST_ID,
    SYDNEY_SEND_HOUR: env.SYDNEY_SEND_HOUR,
    ADMIN_EMAILS: env.ADMIN_EMAILS,
    DEFAULT_FROM_EMAIL: env.DEFAULT_FROM_EMAIL,
    SMS_QUIET_START: env.SMS_QUIET_START,
    SMS_QUIET_END: env.SMS_QUIET_END,
    STUDIO_NAME: env.STUDIO_NAME,
    TWILIO_FROM_NUMBER: env.TWILIO_FROM_NUMBER,
    TWILIO_SENDER_NAME: env.TWILIO_SENDER_NAME,
    MINDBODY_API_KEY: secret("MINDBODY_API_KEY"),
    MINDBODY_STAFF_USERNAME: secret("MINDBODY_STAFF_USERNAME"),
    MINDBODY_STAFF_PASSWORD: secret("MINDBODY_STAFF_PASSWORD"),
    MINDBODY_WEBHOOK_SIGNATURE_KEY: secret("MINDBODY_WEBHOOK_SIGNATURE_KEY"),
    LISTMONK_API_USER: secret("LISTMONK_API_USER"),
    LISTMONK_API_TOKEN: secret("LISTMONK_API_TOKEN"),
    GOOGLE_CLIENT_ID: secret("GOOGLE_CLIENT_ID"),
    GOOGLE_CLIENT_SECRET: secret("GOOGLE_CLIENT_SECRET"),
    SESSION_SECRET: secret("SESSION_SECRET"),
    SETTINGS_ENCRYPTION_KEY: secret("SETTINGS_ENCRYPTION_KEY"),
    TWILIO_ACCOUNT_SID: secret("TWILIO_ACCOUNT_SID"),
    TWILIO_AUTH_TOKEN: secret("TWILIO_AUTH_TOKEN"),
    LEAD_WEBHOOK_SECRET: secret("LEAD_WEBHOOK_SECRET"),
    CONTACT_WRITE_MODE: env.CONTACT_WRITE_MODE,
  };
}
