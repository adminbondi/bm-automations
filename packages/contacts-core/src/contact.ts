import { daysBetween, toIsoDate } from "./dates";
import { STUDIO_ADDRESS, STUDIO_PHONE_E164 } from "./fields";
import { normalizePhone } from "./phone";

const WORDS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty",
];

export type ContactService = {
  name?: string | null;
  expiration?: string | null;
  remaining?: number | null;
  current?: boolean;
};

export type ContactVisit = {
  start?: string | null;
  signedIn?: boolean;
  cancelled?: boolean;
};

export type ContactExtras = {
  services?: ContactService[];
  visits?: ContactVisit[];
  today?: string;
  studioName?: string;
};

export type NormalizedContact = {
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  name: string;
  emailOptOut: boolean;
  smsOptOut: boolean;
  attribs: Record<string, string>;
};

export function inWords(value: number): string {
  if (value >= 0 && value < WORDS.length) return WORDS[value] ?? String(value);
  return String(value);
}

export function mapClient(client: Record<string, unknown>, extras: ContactExtras = {}): NormalizedContact {
  const firstName = text(client.FirstName);
  const lastName = text(client.LastName);
  const email = text(client.Email)?.toLowerCase() ?? null;
  const phone = normalizePhone(text(client.MobilePhone) ?? text(client.HomePhone) ?? text(client.WorkPhone));
  const emailOptOut = client.SendPromotionalEmails === false;
  const smsOptOut = client.SendPromotionalTexts === false;
  const studio = extras.studioName?.trim() || "Balance Moves";
  const service = currentService(extras.services ?? []);
  const passEnd = service ? toIsoDate(service.expiration) : null;
  const today = extras.today ?? null;
  const sinceExpiry = passEnd && today ? daysBetween(passEnd, today) : null;
  const counted = (extras.visits ?? []).filter((visit) => visit.signedIn !== false && !visit.cancelled && visit.start);
  const lastStart = counted.map((visit) => toIsoDate(visit.start)).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
  const sinceVisit = lastStart && today ? daysBetween(lastStart, today) : null;
  const name = [firstName, lastName].filter(Boolean).join(" ");
  const attribs: Record<string, string> = {
    first_name: firstName ?? "",
    last_name: lastName ?? "",
    email: email ?? "",
    phone: phone ?? "",
    email_opt_out: emailOptOut ? "true" : "false",
    sms_opt_out: smsOptOut ? "true" : "false",
    studio,
    pack_name: service?.name?.trim() || "",
    pass_end_date: passEnd ?? "",
    visits: String(counted.length),
    credits_remaining: typeof service?.remaining === "number" ? String(service.remaining) : "",
    days_since_expiry: sinceExpiry != null && sinceExpiry >= 0 ? inWords(sinceExpiry) : "",
    days_since_last_visit: sinceVisit != null && sinceVisit >= 0 ? inWords(sinceVisit) : "",
    studio_phone: STUDIO_PHONE_E164,
    studio_address: STUDIO_ADDRESS,
  };
  return { email, phone, firstName, lastName, name, emailOptOut, smsOptOut, attribs };
}

function currentService(services: ContactService[]): ContactService | null {
  const named = services.filter((service) => service.name?.trim());
  const current = named.filter((service) => service.current !== false);
  const pool = current.length > 0 ? current : named;
  return [...pool].sort((left, right) => (toIsoDate(left.expiration) ?? "9999-12-31").localeCompare(toIsoDate(right.expiration) ?? "9999-12-31"))[0] ?? null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
