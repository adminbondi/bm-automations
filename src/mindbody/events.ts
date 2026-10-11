import { toIsoDate } from "@balancemoves/contacts-core";

export type ParsedEvent = {
  messageId: string;
  eventId: string;
  siteId: number | null;
  occurredAt: string | null;
  clientId: string | null;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  createdAt: string | null;
  waiverSigned: boolean;
  waiverKnown: boolean;
  signedInStatus: string | null;
  contractName: string | null;
  packageNames: string[];
  birthDate: string | null;
  referredBy: string | null;
  emailOptOut: boolean | null;
  smsOptOut: boolean | null;
  visitCount: number | null;
  creditsRemaining: number | null;
  passExpiration: string | null;
  visitStart: string | null;
  profileInPayload: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number") return String(value);
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

export function parseMindbodyEvent(body: unknown): ParsedEvent | null {
  const root = asRecord(body);
  if (!root) return null;
  const eventId = asString(root.eventId);
  const messageId = asString(root.messageId);
  if (!eventId || !messageId) return null;
  const data = asRecord(root.eventData) ?? {};
  const items = Array.isArray(data.items) ? data.items : [];
  const packageNames = items
    .map((item) => asString(asRecord(item)?.name))
    .filter((name): name is string => Boolean(name));
  const itemName = asString(data.itemName);
  if (itemName) packageNames.push(itemName);
  const recipient = items.map((item) => asString(asRecord(item)?.recipientClientId)).find((id) => id);
  const email = asString(data.email) ?? asString(data.clientEmail);
  const firstName = asString(data.firstName) ?? asString(data.clientFirstName);
  const emailOptOut = optOut(data, ["sendPromotionalEmails", "SendPromotionalEmails"]);
  const smsOptOut = optOut(data, ["sendPromotionalTexts", "SendPromotionalTexts"]);
  const waiverKnown = "isLiabilityReleased" in data || "IsLiabilityReleased" in data;
  const birthDate = toIsoDate(asString(data.birthDateTime) ?? asString(data.birthDate) ?? asString(data.BirthDate));
  const profileInPayload = eventId.startsWith("client.") || emailOptOut !== null || smsOptOut !== null || waiverKnown || Boolean(birthDate);
  return {
    messageId,
    eventId,
    siteId: asNumber(data.siteId),
    occurredAt: asString(root.eventInstanceOriginationDateTime),
    clientId: asString(data.clientId) ?? asString(data.purchasingClientId) ?? recipient ?? null,
    email,
    phone: asString(data.mobilePhone) ?? asString(data.MobilePhone) ?? asString(data.phone) ?? asString(data.clientPhone),
    firstName,
    lastName: asString(data.lastName) ?? asString(data.clientLastName),
    createdAt: asString(data.creationDateTime) ?? asString(root.eventInstanceOriginationDateTime),
    waiverSigned: data.isLiabilityReleased === true || data.IsLiabilityReleased === true,
    waiverKnown,
    signedInStatus: asString(data.signedInStatus),
    contractName: asString(data.contractName),
    packageNames,
    birthDate,
    referredBy: asString(data.referredBy) ?? asString(data.ReferredBy),
    emailOptOut,
    smsOptOut,
    visitCount: firstNumber(data, ["clientsNumberOfVisitsAtSite", "clientNumberOfVisitsAtSite", "visitCount"]),
    creditsRemaining: firstNumber(data, ["clientPassSessionsRemaining", "visitsRemaining", "remaining"]),
    passExpiration: toIsoDate(firstString(data, ["clientPassExpirationDateTime", "expirationDate", "ExpirationDate"])),
    visitStart: toIsoDate(firstString(data, ["classStartDateTime", "lastVisitDateTime", "startDateTime"])),
    profileInPayload,
  };
}

function optOut(data: Record<string, unknown>, keys: string[]): boolean | null {
  for (const key of keys) {
    if (key in data) return data[key] === false;
  }
  return null;
}

function firstNumber(data: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = asNumber(data[key]);
    if (value !== null) return value;
  }
  return null;
}

function firstString(data: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = asString(data[key]);
    if (value) return value;
  }
  return null;
}
