import { countVisits, lastVisitDate, selectPassExpiry, selectRemaining } from "../automations/engine";
import type { Automation, ServiceRecord, Visit } from "../automations/types";
import { nameMatchesTokens } from "../names";
import { daysUntil } from "../time";
import { MERGE_FIELDS, STUDIO_ADDRESS, STUDIO_PHONE } from "./fields";

const WORDS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty",
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type MergeInput = {
  automation: Automation;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  studioName: string;
  todaySydney: string;
  services: ServiceRecord[];
  visits: Visit[];
  unsubscribeUrl?: string | null;
};

export type MergeBag = {
  attribs: Record<string, string>;
  data: Record<string, string | number>;
};

export function buildMerge(input: MergeInput): MergeBag {
  const first = input.firstName?.trim() || "";
  const last = input.lastName?.trim() || "";
  const email = input.email?.trim().toLowerCase() || "";
  const studio = input.studioName.trim() || "Balance Moves";
  const pass = selectService(input.services, input.automation.filters.packageNameIncludes ?? []);
  const expiry = pass?.expirationSydney ?? selectPassExpiry(input.services, input.automation.filters.packageNameIncludes ?? []);
  const remaining = pass && typeof pass.remaining === "number"
    ? pass.remaining
    : selectRemaining(input.services, input.automation.filters.packageNameIncludes ?? []);
  const visits = countVisits(input.visits, input.automation);
  const sinceExpiry = expiry ? daysUntil(expiry, input.todaySydney) : null;
  const lastVisit = lastVisitDate(input.visits, input.automation);
  const sinceVisit = lastVisit ? daysUntil(lastVisit, input.todaySydney) : null;
  const data: Record<string, string | number> = {
    FirstName: first || "there",
    LastName: last,
    Email: email,
    studio,
    packName: pass?.name || "your pass",
    passEndDate: expiry ? friendlyDate(expiry) : "",
    visits,
    creditsRemaining: remaining ?? "",
    daysSinceExpiry: sinceExpiry != null && sinceExpiry >= 0 ? inWords(sinceExpiry) : "",
    daysSinceLastVisit: sinceVisit != null && sinceVisit >= 0 ? inWords(sinceVisit) : "",
    studioPhone: STUDIO_PHONE,
    studioAddress: STUDIO_ADDRESS,
    agent: "",
    introOfferUrl: "",
    secondaryOfferUrl: "",
    secondaryOfferName: "",
    secondaryOfferDiscountPrice: "",
    secondaryOfferPrice: "",
    secondaryOfferPromoCode: "",
    secondaryOfferExpiration: "",
  };
  if (input.unsubscribeUrl) data.unsubscribeUrl = input.unsubscribeUrl;
  const attribs: Record<string, string> = {
    first_name: first,
    last_name: last,
    email,
    studio,
    pack_name: String(data.packName),
    pass_end_date: String(data.passEndDate),
    visits: String(visits),
    credits_remaining: remaining == null ? "" : String(remaining),
    days_since_expiry: String(data.daysSinceExpiry),
    days_since_last_visit: String(data.daysSinceLastVisit),
    studio_phone: STUDIO_PHONE,
    studio_address: STUDIO_ADDRESS,
  };
  return { attribs, data };
}

export type SubstitutionRule = { source: string; flags: string; key: string };

export function substitutionRules(): SubstitutionRule[] {
  return [
    { source: "\\[first name\\]", flags: "gi", key: "FirstName" },
    { source: "\\*\\|FNAME\\|\\*", flags: "gi", key: "FirstName" },
    { source: "@Client's first name", flags: "gi", key: "FirstName" },
    { source: "\\{\\{\\s*\\.?\\s*Subscriber\\.FirstName\\s*\\}\\}", flags: "gi", key: "FirstName" },
    { source: "\\{\\{\\s*\\.?\\s*Tx\\.Data\\.FirstName\\s*\\}\\}", flags: "gi", key: "FirstName" },
    { source: "\\{\\{\\s*\\.?\\s*Subscriber\\.Attribs\\.first_name\\s*\\}\\}", flags: "gi", key: "FirstName" },
    { source: "\\[last name\\]", flags: "gi", key: "LastName" },
    { source: "\\*\\|EMAIL\\|\\*", flags: "gi", key: "Email" },
    { source: "\\[studio\\]", flags: "gi", key: "studio" },
    { source: "\\*\\|STUDIO\\|\\*", flags: "gi", key: "studio" },
    { source: "@Name of the client's studio", flags: "gi", key: "studio" },
    { source: "\\*\\|PACK_NAME\\|\\*", flags: "gi", key: "packName" },
    { source: "@Name of the client's package", flags: "gi", key: "packName" },
    { source: "\\*\\|PASS_END\\|\\*", flags: "gi", key: "passEndDate" },
    { source: "\\*\\|VISITS\\|\\*", flags: "gi", key: "visits" },
    { source: "\\*\\|CREDITS\\|\\*", flags: "gi", key: "creditsRemaining" },
    { source: "@Number of credits remaining on the client's current package", flags: "gi", key: "creditsRemaining" },
    { source: "\\*\\|DAYS_SINCE_EXPIRY\\|\\*", flags: "gi", key: "daysSinceExpiry" },
    { source: "@Days since the client's package expiration, in words", flags: "gi", key: "daysSinceExpiry" },
    { source: "\\*\\|DAYS_SINCE_VISIT\\|\\*", flags: "gi", key: "daysSinceLastVisit" },
    { source: "@Number of days since the client's last visit, in words", flags: "gi", key: "daysSinceLastVisit" },
    { source: "<%asm_group_unsubscribe_raw_url%>", flags: "g", key: "unsubscribeUrl" },
    { source: "@Studio phone number", flags: "gi", key: "studioPhone" },
    { source: "\\|STUDIO PHONE\\|", flags: "g", key: "studioPhone" },
    { source: "STUDIO_PHONE", flags: "g", key: "studioPhone" },
    { source: "@Studio address", flags: "gi", key: "studioAddress" },
    { source: "@Intro Offer Purchase URL", flags: "gi", key: "introOfferUrl" },
    { source: "@Secondary Offer Purchase URL", flags: "gi", key: "secondaryOfferUrl" },
    { source: "\\[Secondary Offer Display Name\\]", flags: "gi", key: "secondaryOfferName" },
    { source: "\\[Secondary Offer Discount Price\\]", flags: "gi", key: "secondaryOfferDiscountPrice" },
    { source: "\\[Secondary Offer Price\\]", flags: "gi", key: "secondaryOfferPrice" },
    { source: "\\[Secondary Offer Promo Code\\]", flags: "gi", key: "secondaryOfferPromoCode" },
    { source: "\\[Secondary Offer Expiration\\]", flags: "gi", key: "secondaryOfferExpiration" },
    { source: "@Agent", flags: "gi", key: "agent" },
  ];
}

export function renderMerge(template: string, bag: MergeBag): string {
  const value = (key: string): string => {
    const raw = bag.data[key];
    return raw == null ? "" : String(raw);
  };
  let text = template;
  for (const rule of substitutionRules()) {
    text = text.replace(new RegExp(rule.source, rule.flags), value(rule.key));
  }
  return text.replace(/[ \t]{2,}/g, " ").replace(/ +([,.;!?])/g, "$1").trim();
}

export function exampleMerge(): MergeBag {
  const data: Record<string, string | number> = {};
  const attribs: Record<string, string> = {};
  for (const field of MERGE_FIELDS) {
    if (field.attrib) attribs[field.attrib] = field.example || field.fallback;
  }
  data.FirstName = "Alex";
  data.LastName = "Nguyen";
  data.Email = "bondi@balancemoves.com.au";
  data.studio = "Balance Moves";
  data.packName = "2 Week Intro Pass";
  data.passEndDate = "14 Oct 2026";
  data.visits = 3;
  data.creditsRemaining = 2;
  data.daysSinceExpiry = "two";
  data.daysSinceLastVisit = "seven";
  data.studioPhone = STUDIO_PHONE;
  data.studioAddress = STUDIO_ADDRESS;
  data.agent = "";
  data.introOfferUrl = "";
  data.secondaryOfferUrl = "";
  data.secondaryOfferName = "";
  data.secondaryOfferDiscountPrice = "";
  data.secondaryOfferPrice = "";
  data.secondaryOfferPromoCode = "";
  data.secondaryOfferExpiration = "";
  data.unsubscribeUrl = "https://campaigns.balancemoves.com.au/subscription/form";
  return { attribs, data };
}

function selectService(services: ServiceRecord[], tokens: string[]): ServiceRecord | null {
  const named = services.filter((service) => service.name && (tokens.length === 0 || nameMatchesTokens(service.name, tokens)));
  if (named.length === 0) return null;
  const current = named.filter((service) => service.current);
  const pool = current.length > 0 ? current : named;
  return [...pool].sort((left, right) => (left.expirationSydney ?? "9999-12-31").localeCompare(right.expirationSydney ?? "9999-12-31"))[0] ?? null;
}

function inWords(value: number): string {
  if (value >= 0 && value < WORDS.length) return WORDS[value] ?? String(value);
  return String(value);
}

function friendlyDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  const name = MONTHS[Number(month) - 1] ?? month;
  return `${Number(day)} ${name} ${year}`;
}
