import type { RuntimeConfig } from "../env";
import type { Repo } from "../db/repo";
import { decryptSecret, encryptSecret } from "./crypto";
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
} as const;

const SECRET_KEYS = new Set<string>([
  SETTING_KEYS.listmonkApiUser,
  SETTING_KEYS.listmonkApiToken,
  SETTING_KEYS.twilioAccountSid,
  SETTING_KEYS.twilioAuthToken,
]);

export type PublicSettings = {
  listmonk: { baseUrl: string; connected: boolean };
  twilio: { connected: boolean; fromNumber: string; senderName: string };
  defaultFromEmail: string;
  smsQuietHours: { start: string; end: string; timeZone: "Australia/Sydney" };
};

export type SettingsPatch = {
  listmonk?: { baseUrl?: string; apiUser?: string; apiToken?: string };
  twilio?: { accountSid?: string; authToken?: string; fromNumber?: string; senderName?: string };
  defaultFromEmail?: string;
  smsQuietHours?: { start?: string; end?: string };
};

export type Connections = {
  listmonkBaseUrl: string;
  listmonkApiUser: string;
  listmonkApiToken: string;
  listmonkListId: string;
  listmonkSuppressedListId: string;
  defaultFromEmail: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioFromNumber: string;
  twilioSenderName: string;
  quietStart: string;
  quietEnd: string;
};

type Stored = Map<string, string>;

export async function readPublicSettings(repo: Repo, config: RuntimeConfig): Promise<PublicSettings> {
  const connections = await resolveConnections(repo, config);
  return toPublic(connections);
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
  }
  if ("defaultFromEmail" in patch) writes.push({ key: SETTING_KEYS.defaultFromEmail, value: clean(patch.defaultFromEmail) });
  if (patch.smsQuietHours) {
    writes.push({ key: SETTING_KEYS.smsQuietStart, value: clean(patch.smsQuietHours.start) });
    writes.push({ key: SETTING_KEYS.smsQuietEnd, value: clean(patch.smsQuietHours.end) });
  }
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
    defaultFromEmail: plain(stored, SETTING_KEYS.defaultFromEmail, config.defaultFromEmail),
    twilioAccountSid: secret(stored, SETTING_KEYS.twilioAccountSid, config.twilioAccountSid),
    twilioAuthToken: secret(stored, SETTING_KEYS.twilioAuthToken, config.twilioAuthToken),
    twilioFromNumber: plain(stored, SETTING_KEYS.twilioFromNumber, config.twilioFromNumber),
    twilioSenderName: plain(stored, SETTING_KEYS.twilioSenderName, config.twilioSenderName),
    quietStart: parseClock(quietStart) === null ? config.smsQuietStart : quietStart,
    quietEnd: parseClock(quietEnd) === null ? config.smsQuietEnd : quietEnd,
  };
}

export function toPublic(connections: Connections): PublicSettings {
  return {
    listmonk: {
      baseUrl: connections.listmonkBaseUrl,
      connected: Boolean(connections.listmonkApiUser && connections.listmonkApiToken),
    },
    twilio: {
      connected: Boolean(connections.twilioAccountSid && connections.twilioAuthToken),
      fromNumber: connections.twilioFromNumber,
      senderName: connections.twilioSenderName,
    },
    defaultFromEmail: connections.defaultFromEmail,
    smsQuietHours: {
      start: connections.quietStart,
      end: connections.quietEnd,
      timeZone: "Australia/Sydney",
    },
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

function validateQuiet(quiet: SettingsPatch["smsQuietHours"]): string | null {
  if (!quiet) return null;
  if (quiet.start !== undefined && quiet.start !== "" && parseClock(quiet.start) === null) return "invalid_quiet_hours";
  if (quiet.end !== undefined && quiet.end !== "" && parseClock(quiet.end) === null) return "invalid_quiet_hours";
  return null;
}
