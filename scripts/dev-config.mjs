import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export const DEV_WORKER_NAME = "bm-automations-dev";
export const DEV_DATABASE_NAME = "bm-automations-dev";
export const DEV_DATABASE_ID = "6b95adf8-010b-4608-b2d2-f3172bd1fb8b";
export const PLACEHOLDER_DATABASE_ID = "00000000-0000-0000-0000-000000000000";
export const SEND_EMAIL = "bondi@balancemoves.com.au";
export const STUDIO_PHONE = "+61424133544";
export const DEV_CRONS = ["0 22 * * *", "0 23 * * *"];
export const OTHER_DATABASE_IDS = [
  "cf00a8bf-018c-4c4a-abd3-371af785e223",
  "789cb694-f6fc-49c4-a109-185e22bab129",
];

export const smsAllowlistPath = join(root, "scripts", "dev-sms-allowlist.txt");

export function stripJsonc(text) {
  let out = "";
  let inString = false;
  let escape = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    if (inString) {
      out += char;
      if (escape) escape = false;
      else if (char === "\\") escape = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      out += char;
      continue;
    }
    if (char === "/" && next === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      out += "\n";
      continue;
    }
    if (char === "/" && next === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i++;
      continue;
    }
    out += char;
  }
  return out;
}

export function loadWranglerConfig() {
  const text = readFileSync(join(root, "wrangler.jsonc"), "utf8");
  return JSON.parse(stripJsonc(text));
}

export function normalizePhone(value) {
  if (!value) return null;
  let compact = value.trim().replace(/[^\d+]/g, "");
  if (!compact) return null;
  if (compact.startsWith("00")) compact = `+${compact.slice(2)}`;
  if (compact.startsWith("+")) {
    const digits = compact.slice(1).replace(/\D/g, "");
    return digits ? `+${digits}` : null;
  }
  const digits = compact.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) return `+61${digits.slice(1)}`;
  if (digits.startsWith("61")) return `+${digits}`;
  return `+${digits}`;
}

export function emailsIn(value) {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.includes("@"));
}

export function phonesIn(...values) {
  const phones = [];
  for (const value of values) {
    if (!value) continue;
    for (const entry of value.split(",")) {
      const trimmed = entry.trim();
      if (!trimmed || trimmed.includes("@")) continue;
      const phone = normalizePhone(trimmed);
      if (phone) phones.push(phone);
    }
  }
  return phones;
}

export function readSmsAllowlist() {
  const text = readFileSync(smsAllowlistPath, "utf8");
  const phones = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const phone = normalizePhone(trimmed);
    if (!phone) throw new Error(`Unreadable phone in scripts/dev-sms-allowlist.txt: ${trimmed}`);
    phones.push(phone);
  }
  return phones;
}

function sameSet(left, right) {
  const a = [...left].sort();
  const b = [...right].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function devConfigErrors(config = loadWranglerConfig()) {
  const errors = [];
  const dev = config.env?.dev;
  if (!dev) {
    errors.push("wrangler.jsonc is missing env.dev.");
    return errors;
  }
  const envNames = Object.keys(config.env ?? {});
  if (envNames.length !== 1 || envNames[0] !== "dev") {
    errors.push(`Only env.dev is allowed. Found: ${envNames.join(", ") || "(none)"}.`);
  }
  if (dev.name !== DEV_WORKER_NAME) errors.push(`env.dev name must be ${DEV_WORKER_NAME}.`);
  const databases = dev.d1_databases ?? [];
  if (databases.length !== 1) errors.push("env.dev must bind exactly one D1 database.");
  const database = databases[0] ?? {};
  if (database.binding !== "DB") errors.push('env.dev D1 binding must be "DB".');
  if (database.database_name !== DEV_DATABASE_NAME) {
    errors.push(`env.dev database_name must be ${DEV_DATABASE_NAME}.`);
  }
  if (database.database_id !== DEV_DATABASE_ID) {
    errors.push(`env.dev database_id must be ${DEV_DATABASE_ID}.`);
  }
  if (database.migrations_dir !== "migrations") errors.push("env.dev migrations_dir must be migrations.");
  const top = (config.d1_databases ?? [])[0] ?? {};
  if (top.database_name !== "bm-automations" || top.database_id !== PLACEHOLDER_DATABASE_ID) {
    errors.push("Top-level D1 must stay the unpublished bm-automations placeholder.");
  }
  if (top.database_id === DEV_DATABASE_ID) {
    errors.push("Top-level config must not use the dev D1 id.");
  }
  const seenIds = [top.database_id, database.database_id];
  for (const id of seenIds) {
    if (OTHER_DATABASE_IDS.includes(id)) errors.push(`Refusing database id ${id}. It is not bm-automations-dev.`);
  }
  const vars = dev.vars ?? {};
  if (vars.DEV_MODE !== "true") errors.push('env.dev DEV_MODE must be "true".');
  const emails = emailsIn(vars.SEND_ALLOWLIST);
  if (emails.length !== 1 || emails[0] !== SEND_EMAIL) {
    errors.push(`env.dev SEND_ALLOWLIST must be exactly ${SEND_EMAIL}.`);
  }
  let allowedPhones = [];
  try {
    allowedPhones = readSmsAllowlist();
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  const configuredPhones = phonesIn(vars.SMS_ALLOWLIST, vars.SEND_ALLOWLIST);
  if (!sameSet(configuredPhones, allowedPhones)) {
    errors.push(
      `env.dev SMS numbers must match scripts/dev-sms-allowlist.txt. Config has [${configuredPhones.join(", ")}]. File has [${allowedPhones.join(", ")}].`,
    );
  }
  for (const phone of [...configuredPhones, ...allowedPhones]) {
    if (phone === STUDIO_PHONE) errors.push(`Refusing studio number ${STUDIO_PHONE} on the dev SMS allowlist.`);
    if (!/^\+[1-9][0-9]{7,14}$/.test(phone)) errors.push(`Refusing phone that is not E.164: ${phone}.`);
  }
  const crons = dev.triggers?.crons ?? [];
  if (!sameSet(crons, DEV_CRONS)) {
    errors.push(`env.dev crons must be ${DEV_CRONS.join(" and ")}.`);
  }
  if (vars.CONTACT_WRITE_MODE !== "shared_sync" && vars.CONTACT_WRITE_MODE !== "self") {
    errors.push('env.dev CONTACT_WRITE_MODE must be "shared_sync" or "self".');
  }
  const adminEmails = emailsIn(vars.ADMIN_EMAILS);
  if (!adminEmails.includes("admin@balancemoves.com.au")) {
    errors.push("env.dev ADMIN_EMAILS must include admin@balancemoves.com.au.");
  }
  if (vars.DEFAULT_FROM_EMAIL !== SEND_EMAIL) {
    errors.push(`env.dev DEFAULT_FROM_EMAIL must be ${SEND_EMAIL}.`);
  }
  return errors;
}
