import type { RuntimeConfig } from "../env";
import type { Repo } from "../db/repo";
import { MINDBODY_ALERT, MINDBODY_CAP, utcMonth } from "../mindbody/budget";
import { decryptSecret, encryptSecret } from "./crypto";
import { DEFAULT_TEST_RECIPIENTS } from "./test-recipients";
import { parseClock } from "../time";

export const SETTING_KEYS = {
  listmonkBaseUrl: "listmonk_base_url",
  listmonkApiUser: "listmonk_api_user",
  listmonkApiToken: "listmonk_api_token",
  twilioAccountSid: "twilio_account_sid",
  twilioAuthToken: "twilio_auth_token",
  twilioFromNumber: "twilio_from_number",
  twilioSenderName: "twilio_sender_name",
  defaultFromEmail: "default_from_email",
  smsQuietStart: "sms_quiet_start",
  smsQuietEnd: "sms_quiet_end",
  twilioFromMode: "twilio_from_mode",
  appendReplyStop: "append_reply_stop",
  defaultFromName: "default_from_name",
  defaultReplyTo: "default_reply_to",
  quietAction: "quiet_action",
  listmonkLastChecked: "listmonk_last_checked",
  listmonkTemplateCount: "listmonk_template_count",
  testRecipients: "test_recipients",
} as const;

const SECRET_KEYS = new Set<string>([
  SETTING_KEYS.listmonkApiUser,
  SETTING_KEYS.listmonkApiToken,
  SETTING_KEYS.twilioAccountSid,
  SETTING_KEYS.twilioAuthToken,
]);

export type FromMode = "number" | "name";
export type QuietAction = "hold" | "skip";

export type PublicSettings = {
  listmonk: {
    baseUrl: string;
    apiUser: string;
    connected: boolean;
    lastCheckedAt: string | null;
    templateCount: number | null;
  };
  twilio: { connected: boolean; fromNumber: string; senderName: string; fromMode: FromMode };
  defaultFromEmail: string;
  defaultFromName: string;
  defaultReplyTo: string;
  appendReplyStop: boolean;
  quietAction: QuietAction;
  smsQuietHours: { start: string; end: string; timeZone: "Australia/Sydney" };
  mindbody: {
    month: string;
    calls: number;
    alertAt: number;
    cap: number;
    alert: boolean;
    atCap: boolean;
    callers: { caller: string; calls: number }[];
  };
  testRecipients: string;
};

export type SettingsPatch = {
  listmonk?: { baseUrl?: string; apiUser?: string; apiToken?: string };
  twilio?: {
    accountSid?: string;
    authToken?: string;
    fromNumber?: string;
    senderName?: string;
    fromMode?: FromMode;
  };
  defaultFromEmail?: string;
  defaultFromName?: string;
  defaultReplyTo?: string;
  appendReplyStop?: boolean;
  quietAction?: QuietAction;
  smsQuietHours?: { start?: string; end?: string };
  testRecipients?: string;
};

export type Connections = {
  listmonkBaseUrl: string;
  listmonkApiUser: string;
  listmonkApiToken: string;
  listmonkListId: string;
  listmonkSuppressedListId: string;
  listmonkLastChecked: string | null;
  listmonkTemplateCount: number | null;
  defaultFromEmail: string;
  defaultFromName: string;
  defaultReplyTo: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioFromNumber: string;
  twilioSenderName: string;
  twilioFromMode: FromMode;
  appendReplyStop: boolean;
  quietAction: QuietAction;
  quietStart: string;
  quietEnd: string;
  testRecipients: string;
};

type Stored = Map<string, string>;

export async function noteListmonkCheck(repo: Repo, checkedAt: string, templateCount: number | null): Promise<void> {
  await repo.putSetting(SETTING_KEYS.listmonkLastChecked, checkedAt, false);
  if (templateCount !== null) await repo.putSetting(SETTING_KEYS.listmonkTemplateCount, String(templateCount), false);
}

export async function readPublicSettings(repo: Repo, config: RuntimeConfig, now: Date = new Date()): Promise<PublicSettings> {
  const connections = await resolveConnections(repo, config);
  const month = utcMonth(now);
  const rows = await repo.mindbodyUsage(month);
  const calls = rows.reduce((sum, row) => sum + row.count, 0);
  return {
    ...toPublic(connections),
    mindbody: {
      month,
      calls,
      alertAt: MINDBODY_ALERT,
      cap: MINDBODY_CAP,
      alert: calls >= MINDBODY_ALERT,
      atCap: calls >= MINDBODY_CAP,
      callers: rows.map((row) => ({ caller: row.caller, calls: row.count })),
    },
  };
}

export async function writeSettings(repo: Repo, config: RuntimeConfig, patch: SettingsPatch): Promise<PublicSettings> {
  const quietError = validateQuiet(patch.smsQuietHours);
  if (quietError) throw new Error(quietError);
  const writes: { key: string; value: string | undefined }[] = [];
  if (patch.listmonk) {
    writes.push({ key: SETTING_KEYS.listmonkBaseUrl, value: clean(patch.listmonk.baseUrl) });
    writes.push({ key: SETTING_KEYS.listmonkApiUser, value: patch.listmonk.apiUser });
    writes.push({ key: SETTING_KEYS.listmonkApiToken, value: patch.listmonk.apiToken });
  }
  if (patch.twilio) {
    writes.push({ key: SETTING_KEYS.twilioAccountSid, value: patch.twilio.accountSid });
    writes.push({ key: SETTING_KEYS.twilioAuthToken, value: patch.twilio.authToken });
    writes.push({ key: SETTING_KEYS.twilioFromNumber, value: clean(patch.twilio.fromNumber) });
    writes.push({ key: SETTING_KEYS.twilioSenderName, value: clean(patch.twilio.senderName) });
    if (patch.twilio.fromMode) writes.push({ key: SETTING_KEYS.twilioFromMode, value: patch.twilio.fromMode });
  }
  if ("defaultFromEmail" in patch) writes.push({ key: SETTING_KEYS.defaultFromEmail, value: clean(patch.defaultFromEmail) });
  if ("defaultFromName" in patch) writes.push({ key: SETTING_KEYS.defaultFromName, value: clean(patch.defaultFromName) });
  if ("defaultReplyTo" in patch) writes.push({ key: SETTING_KEYS.defaultReplyTo, value: clean(patch.defaultReplyTo) });
  if ("appendReplyStop" in patch) {
    writes.push({ key: SETTING_KEYS.appendReplyStop, value: patch.appendReplyStop ? "1" : "0" });
  }
  if (patch.quietAction) writes.push({ key: SETTING_KEYS.quietAction, value: patch.quietAction });
  if (patch.smsQuietHours) {
    writes.push({ key: SETTING_KEYS.smsQuietStart, value: clean(patch.smsQuietHours.start) });
    writes.push({ key: SETTING_KEYS.smsQuietEnd, value: clean(patch.smsQuietHours.end) });
  }
  if ("testRecipients" in patch) writes.push({ key: SETTING_KEYS.testRecipients, value: clean(patch.testRecipients) });
  for (const write of writes) {
    if (write.value === undefined) continue;
    if (SECRET_KEYS.has(write.key)) {
      if (write.value === "") await repo.deleteSetting(write.key);
      else await repo.putSetting(write.key, await encryptSecret(write.value, config.settingsEncryptionKey), true);
    } else if (write.value === "") {
      await repo.putSetting(write.key, "", false);
    } else {
      await repo.putSetting(write.key, write.value, false);
    }
  }
  return readPublicSettings(repo, config);
}

export async function resolveConnections(repo: Repo, config: RuntimeConfig): Promise<Connections> {
  const stored = await loadStored(repo, config.settingsEncryptionKey);
  const quietStart = plain(stored, SETTING_KEYS.smsQuietStart, config.smsQuietStart);
  const quietEnd = plain(stored, SETTING_KEYS.smsQuietEnd, config.smsQuietEnd);
  return {
    listmonkBaseUrl: plain(stored, SETTING_KEYS.listmonkBaseUrl, config.listmonkBaseUrl).replace(/\/$/, ""),
    listmonkApiUser: secret(stored, SETTING_KEYS.listmonkApiUser, config.listmonkApiUser),
    listmonkApiToken: secret(stored, SETTING_KEYS.listmonkApiToken, config.listmonkApiToken),
    listmonkListId: config.listmonkListId,
    listmonkSuppressedListId: config.listmonkSuppressedListId,
    listmonkLastChecked: stored.get(SETTING_KEYS.listmonkLastChecked) || null,
    listmonkTemplateCount: countOrNull(stored.get(SETTING_KEYS.listmonkTemplateCount)),
    defaultFromEmail: plain(stored, SETTING_KEYS.defaultFromEmail, config.defaultFromEmail || "hello@balancemoves.com.au"),
    defaultFromName: plain(stored, SETTING_KEYS.defaultFromName, "Balance Moves"),
    defaultReplyTo: plain(stored, SETTING_KEYS.defaultReplyTo, "bondi@balancemoves.com.au"),
    twilioAccountSid: secret(stored, SETTING_KEYS.twilioAccountSid, config.twilioAccountSid),
    twilioAuthToken: secret(stored, SETTING_KEYS.twilioAuthToken, config.twilioAuthToken),
    twilioFromNumber: plain(stored, SETTING_KEYS.twilioFromNumber, config.twilioFromNumber),
    twilioSenderName: plain(stored, SETTING_KEYS.twilioSenderName, config.twilioSenderName),
    twilioFromMode: plain(stored, SETTING_KEYS.twilioFromMode, "number") === "name" ? "name" : "number",
    appendReplyStop: plain(stored, SETTING_KEYS.appendReplyStop, "0") === "1",
    quietAction: plain(stored, SETTING_KEYS.quietAction, "hold") === "skip" ? "skip" : "hold",
    quietStart: parseClock(quietStart) === null ? config.smsQuietStart : quietStart,
    quietEnd: parseClock(quietEnd) === null ? config.smsQuietEnd : quietEnd,
    testRecipients: plain(stored, SETTING_KEYS.testRecipients, DEFAULT_TEST_RECIPIENTS),
  };
}

export function toPublic(connections: Connections): Omit<PublicSettings, "mindbody"> {
  return {
    listmonk: {
      baseUrl: connections.listmonkBaseUrl,
      apiUser: connections.listmonkApiUser,
      connected: Boolean(connections.listmonkApiUser && connections.listmonkApiToken),
      lastCheckedAt: connections.listmonkLastChecked,
      templateCount: connections.listmonkTemplateCount,
    },
    twilio: {
      connected: Boolean(connections.twilioAccountSid && connections.twilioAuthToken),
      fromNumber: connections.twilioFromNumber,
      senderName: connections.twilioSenderName,
      fromMode: connections.twilioFromMode,
    },
    defaultFromEmail: connections.defaultFromEmail,
    defaultFromName: connections.defaultFromName,
    defaultReplyTo: connections.defaultReplyTo,
    appendReplyStop: connections.appendReplyStop,
    quietAction: connections.quietAction,
    smsQuietHours: {
      start: connections.quietStart,
      end: connections.quietEnd,
      timeZone: "Australia/Sydney",
    },
    testRecipients: connections.testRecipients,
  };
}

async function loadStored(repo: Repo, keyMaterial: string): Promise<Stored> {
  const rows = await repo.listSettings();
  const stored: Stored = new Map();
  for (const row of rows) {
    if (row.secret) {
      const plainText = await decryptSecret(row.value, keyMaterial);
      stored.set(row.key, plainText ?? "");
    } else {
      stored.set(row.key, row.value);
    }
  }
  return stored;
}

function plain(stored: Stored, key: string, fallback: string): string {
  return stored.has(key) ? (stored.get(key) ?? "") : fallback;
}

function secret(stored: Stored, key: string, fallback: string): string {
  if (!stored.has(key)) return fallback;
  return stored.get(key) ?? "";
}

function clean(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return value.trim();
}

function countOrNull(value: string | undefined): number | null {
  if (!value) return null;
  const count = Number(value);
  return Number.isInteger(count) && count >= 0 ? count : null;
}

function validateQuiet(quiet: SettingsPatch["smsQuietHours"]): string | null {
  if (!quiet) return null;
  if (quiet.start !== undefined && quiet.start !== "" && parseClock(quiet.start) === null) return "invalid_quiet_hours";
  if (quiet.end !== undefined && quiet.end !== "" && parseClock(quiet.end) === null) return "invalid_quiet_hours";
  return null;
}
