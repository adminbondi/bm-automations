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
  signedInStatus: string | null;
  contractName: string | null;
  packageNames: string[];
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
  return {
    messageId,
    eventId,
    siteId: asNumber(data.siteId),
    occurredAt: asString(root.eventInstanceOriginationDateTime),
    clientId: asString(data.clientId) ?? asString(data.purchasingClientId) ?? recipient ?? null,
    email: asString(data.email) ?? asString(data.clientEmail),
    phone: asString(data.mobilePhone) ?? asString(data.MobilePhone) ?? asString(data.phone) ?? asString(data.clientPhone),
    firstName: asString(data.firstName) ?? asString(data.clientFirstName),
    lastName: asString(data.lastName) ?? asString(data.clientLastName),
    createdAt: asString(data.creationDateTime) ?? asString(root.eventInstanceOriginationDateTime),
    waiverSigned: data.isLiabilityReleased === true,
    signedInStatus: asString(data.signedInStatus),
    contractName: asString(data.contractName),
    packageNames,
  };
}
