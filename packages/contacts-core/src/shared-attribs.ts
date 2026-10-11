import { CLASS_PACK_TYPE_BY_PRODUCT, INTRO_PASS_PRODUCT_ID } from "./class-packs";
import { CONTACT_ATTRIBUTES, type ContactAttributeKey } from "./contact-attributes";

export type SharedService = {
  name?: string | null;
  productId?: number | null;
  remaining?: number | null;
  current?: boolean | null;
  expiration?: string | null;
  activeDate?: string | null;
  returned?: boolean | null;
};

export type SharedAttribInput = {
  clientId?: string | null;
  active?: boolean | null;
  services?: SharedService[];
  today?: string | null;
};

/** Every Chatwoot contact attribute, as a listmonk attrib string. */
export function sharedContactAttribs(input: SharedAttribInput = {}): Record<ContactAttributeKey, string> {
  const values = blankAttribs();
  if (input.clientId) values.client_id = input.clientId;
  if (input.active === true) values.active = "true";
  if (input.active === false) values.active = "false";

  const today = input.today ?? "";
  const packs = (input.services ?? []).filter((service) => isUsablePack(service, today));
  if (packs.length > 0) {
    values.packs = packs.map(packLine).join("; ");
    values.pack_credits_total = String(packs.reduce((sum, pack) => sum + (pack.remaining ?? 0), 0));
    let reformer = 0;
    let mat = 0;
    let breath = 0;
    for (const pack of packs) {
      const type = CLASS_PACK_TYPE_BY_PRODUCT.get(pack.productId ?? -1);
      if (type === "reformer") reformer += pack.remaining ?? 0;
      if (type === "mat_barre") mat += pack.remaining ?? 0;
      if (type === "breathwork_yoga") breath += pack.remaining ?? 0;
    }
    values.reformer_credits = String(reformer);
    values.mat_barre_credits = String(mat);
    values.breathwork_yoga_credits = String(breath);
    const expiries = packs.map((pack) => dateOnly(pack.expiration)).filter((date): date is string => Boolean(date)).sort();
    if (expiries[0]) values.pack_next_expiry = expiries[0];
  }

  const intros = (input.services ?? []).filter((service) => service.productId === INTRO_PASS_PRODUCT_ID && !service.returned);
  if (intros.length > 0) {
    values.intro_client = "true";
    const expiries = intros.map((service) => dateOnly(service.expiration)).filter((date): date is string => Boolean(date)).sort();
    const activeExpiry = expiries.find((date) => !today || date >= today) ?? null;
    const expiry = activeExpiry ?? expiries.at(-1) ?? "";
    if (expiry) values.intro_expiry = expiry;
    values.intro_active = activeExpiry ? "true" : "false";
    if (today && expiry) {
      const days = Math.max(0, calendarDays(today, expiry));
      values.intro_days_left = String(activeExpiry ? days : 0);
    }
  }
  return values;
}

function blankAttribs(): Record<ContactAttributeKey, string> {
  const values = {} as Record<ContactAttributeKey, string>;
  for (const field of CONTACT_ATTRIBUTES) {
    if (field.attribute_display_type === 7) values[field.attribute_key] = "false";
    else if (field.attribute_display_type === 1) values[field.attribute_key] = "0";
    else if (field.attribute_key === "membership_status") values[field.attribute_key] = "None";
    else values[field.attribute_key] = "";
  }
  return values;
}

function isUsablePack(service: SharedService, today: string): boolean {
  if (service.returned) return false;
  if (service.current !== true) return false;
  if (typeof service.productId !== "number" || !CLASS_PACK_TYPE_BY_PRODUCT.has(service.productId)) return false;
  if (typeof service.remaining !== "number" || service.remaining <= 0) return false;
  const active = dateOnly(service.activeDate);
  if (today && active && active > today) return false;
  const expiry = dateOnly(service.expiration);
  if (today && expiry && expiry < today) return false;
  if (today && !expiry) return false;
  return true;
}

function packLine(pack: SharedService): string {
  const name = pack.name?.trim() || "Pack";
  const credits = `${name}: ${pack.remaining ?? 0} left`;
  const expiry = dateOnly(pack.expiration);
  return expiry ? `${credits}, exp ${expiry}` : credits;
}

function dateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  return match?.[1] ?? null;
}

function calendarDays(from: string, to: string): number {
  const [fromYear, fromMonth, fromDay] = from.split("-").map(Number);
  const [toYear, toMonth, toDay] = to.split("-").map(Number);
  const start = Date.UTC(fromYear ?? 1970, (fromMonth ?? 1) - 1, fromDay ?? 1);
  const end = Date.UTC(toYear ?? 1970, (toMonth ?? 1) - 1, toDay ?? 1);
  return Math.round((end - start) / 86_400_000);
}
