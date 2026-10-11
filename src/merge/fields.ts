import { CONTACT_FIELDS, STUDIO_ADDRESS, STUDIO_PHONE_DISPLAY } from "@balancemoves/contacts-core";

export const STUDIO_PHONE = STUDIO_PHONE_DISPLAY;
export { STUDIO_ADDRESS };

export type MergeField = {
  loyalSnap: string;
  key: string;
  type: string;
  optOut: string;
  mindbody: string;
  attrib: string;
  syntax: string;
  example: string;
  fallback: string;
  gap: boolean;
  insert: string;
};

type Presentation = {
  loyalSnap: string;
  syntax: string;
  fallback: string;
  insert: string;
};

const PRESENTATION: Record<string, Presentation> = {
  first_name: {
    loyalSnap: "*|FNAME|*, [First name], @Client's first name",
    syntax: "{{ .Subscriber.FirstName }} and {{ .Tx.Data.FirstName }}",
    fallback: "there",
    insert: "[First name]",
  },
  last_name: {
    loyalSnap: "[Last name]",
    syntax: "{{ .Subscriber.LastName }} and {{ .Tx.Data.LastName }}",
    fallback: "",
    insert: "[Last name]",
  },
  email: {
    loyalSnap: "*|EMAIL|*",
    syntax: "{{ .Subscriber.Email }} and {{ .Tx.Data.Email }}",
    fallback: "",
    insert: "*|EMAIL|*",
  },
  phone: {
    loyalSnap: "client mobile (Chatwoot phone_number; not a LoyalSnap token)",
    syntax: "Chatwoot custom_attributes.phone and {{ .Subscriber.Attribs.phone }}",
    fallback: "",
    insert: "",
  },
  email_opt_out: {
    loyalSnap: "email opt-out (not a LoyalSnap token)",
    syntax: "Chatwoot custom_attributes.email_opt_out and {{ .Subscriber.Attribs.email_opt_out }}",
    fallback: "false",
    insert: "",
  },
  sms_opt_out: {
    loyalSnap: "SMS opt-out (not a LoyalSnap token)",
    syntax: "Chatwoot custom_attributes.sms_opt_out and {{ .Subscriber.Attribs.sms_opt_out }}",
    fallback: "false",
    insert: "",
  },
  studio: {
    loyalSnap: "*|STUDIO|*, [Studio], @Name of the client's studio",
    syntax: "{{ .Subscriber.Attribs.studio }} and {{ .Tx.Data.studio }}",
    fallback: "Balance Moves",
    insert: "[Studio]",
  },
  pack_name: {
    loyalSnap: "*|PACK_NAME|*, @Name of the client's package",
    syntax: "{{ .Subscriber.Attribs.pack_name }} and {{ .Tx.Data.packName }}",
    fallback: "your pass",
    insert: "*|PACK_NAME|*",
  },
  pass_end_date: {
    loyalSnap: "pass end date (expiring automations; no *|DATE|* tag in the export)",
    syntax: "{{ .Subscriber.Attribs.pass_end_date }} and {{ .Tx.Data.passEndDate }}",
    fallback: "",
    insert: "*|PASS_END|*",
  },
  visits: {
    loyalSnap: "visits (trial expiring copy says how many sessions; the preview hardcodes 5)",
    syntax: "{{ .Subscriber.Attribs.visits }} and {{ .Tx.Data.visits }}",
    fallback: "0",
    insert: "*|VISITS|*",
  },
  credits_remaining: {
    loyalSnap: "@Number of credits remaining on the client's current package",
    syntax: "{{ .Subscriber.Attribs.credits_remaining }} and {{ .Tx.Data.creditsRemaining }}",
    fallback: "",
    insert: "*|CREDITS|*",
  },
  days_since_expiry: {
    loyalSnap: "@Days since the client's package expiration, in words",
    syntax: "{{ .Subscriber.Attribs.days_since_expiry }} and {{ .Tx.Data.daysSinceExpiry }}",
    fallback: "",
    insert: "*|DAYS_SINCE_EXPIRY|*",
  },
  days_since_last_visit: {
    loyalSnap: "@Number of days since the client's last visit, in words",
    syntax: "{{ .Subscriber.Attribs.days_since_last_visit }} and {{ .Tx.Data.daysSinceLastVisit }}",
    fallback: "",
    insert: "*|DAYS_SINCE_VISIT|*",
  },
  studio_phone: {
    loyalSnap: "@Studio phone number, |STUDIO PHONE|, STUDIO_PHONE",
    syntax: "{{ .Subscriber.Attribs.studio_phone }} and {{ .Tx.Data.studioPhone }}",
    fallback: STUDIO_PHONE,
    insert: "@Studio phone number",
  },
  studio_address: {
    loyalSnap: "@Studio address",
    syntax: "{{ .Subscriber.Attribs.studio_address }} and {{ .Tx.Data.studioAddress }}",
    fallback: STUDIO_ADDRESS,
    insert: "@Studio address",
  },
};

const UNSUBSCRIBE: MergeField = {
  loyalSnap: "<%asm_group_unsubscribe_raw_url%>",
  key: "",
  type: "url",
  optOut: "—",
  mindbody: "gap",
  attrib: "",
  syntax: "{{ .Tx.Data.unsubscribeUrl }}",
  example: "https://campaigns.balancemoves.com.au/subscription/form",
  fallback: "",
  gap: true,
  insert: "<%asm_group_unsubscribe_raw_url%>",
};

const TEMPLATE_ONLY: MergeField[] = [
  {
    loyalSnap: "@Agent",
    key: "",
    type: "string",
    optOut: "—",
    mindbody: "gap",
    attrib: "",
    syntax: "{{ .Tx.Data.agent }}",
    example: "",
    fallback: "",
    gap: true,
    insert: "@Agent",
  },
  {
    loyalSnap: "@Intro Offer Purchase URL",
    key: "",
    type: "url",
    optOut: "—",
    mindbody: "gap",
    attrib: "",
    syntax: "{{ .Tx.Data.introOfferUrl }}",
    example: "",
    fallback: "",
    gap: true,
    insert: "@Intro Offer Purchase URL",
  },
  {
    loyalSnap: "@Secondary Offer Purchase URL",
    key: "",
    type: "url",
    optOut: "—",
    mindbody: "gap",
    attrib: "",
    syntax: "{{ .Tx.Data.secondaryOfferUrl }}",
    example: "",
    fallback: "",
    gap: true,
    insert: "@Secondary Offer Purchase URL",
  },
  {
    loyalSnap: "[Secondary Offer Display Name]",
    key: "",
    type: "string",
    optOut: "—",
    mindbody: "gap",
    attrib: "",
    syntax: "{{ .Tx.Data.secondaryOfferName }}",
    example: "",
    fallback: "",
    gap: true,
    insert: "[Secondary Offer Display Name]",
  },
  {
    loyalSnap: "[Secondary Offer Discount Price]",
    key: "",
    type: "string",
    optOut: "—",
    mindbody: "gap",
    attrib: "",
    syntax: "{{ .Tx.Data.secondaryOfferDiscountPrice }}",
    example: "",
    fallback: "",
    gap: true,
    insert: "[Secondary Offer Discount Price]",
  },
  {
    loyalSnap: "[Secondary Offer Price]",
    key: "",
    type: "string",
    optOut: "—",
    mindbody: "gap",
    attrib: "",
    syntax: "{{ .Tx.Data.secondaryOfferPrice }}",
    example: "",
    fallback: "",
    gap: true,
    insert: "[Secondary Offer Price]",
  },
  {
    loyalSnap: "[Secondary Offer Promo Code]",
    key: "",
    type: "string",
    optOut: "—",
    mindbody: "gap",
    attrib: "",
    syntax: "{{ .Tx.Data.secondaryOfferPromoCode }}",
    example: "",
    fallback: "",
    gap: true,
    insert: "[Secondary Offer Promo Code]",
  },
  {
    loyalSnap: "[Secondary Offer Expiration]",
    key: "",
    type: "string",
    optOut: "—",
    mindbody: "gap",
    attrib: "",
    syntax: "{{ .Tx.Data.secondaryOfferExpiration }}",
    example: "",
    fallback: "",
    gap: true,
    insert: "[Secondary Offer Expiration]",
  },
];

function sharedRow(key: string): MergeField {
  const field = CONTACT_FIELDS.find((row) => row.key === key);
  const presentation = PRESENTATION[key];
  if (!field || !presentation) throw new Error(`contact_field_missing_${key}`);
  return {
    loyalSnap: presentation.loyalSnap,
    key: field.key,
    type: field.type,
    optOut: field.optOut,
    mindbody: field.mindbody,
    attrib: field.key,
    syntax: presentation.syntax,
    example: field.example,
    fallback: presentation.fallback,
    gap: field.gap,
    insert: presentation.insert,
  };
}

const beforeStudio = CONTACT_FIELDS.filter((field) => field.key !== "studio_phone" && field.key !== "studio_address").map((field) => sharedRow(field.key));

export const MERGE_FIELDS: MergeField[] = [
  ...beforeStudio,
  UNSUBSCRIBE,
  sharedRow("studio_phone"),
  sharedRow("studio_address"),
  ...TEMPLATE_ONLY,
];

export function renderFieldTable(): string {
  const header = "| LoyalSnap field | Field key | Type | Mindbody source | Opt-out | listmonk attrib | Template syntax | Example | Fallback |";
  const rule = "| --- | --- | --- | --- | --- | --- | --- | --- | --- |";
  const lines = MERGE_FIELDS.map((field) => {
    const source = field.gap ? "gap" : field.mindbody;
    const attrib = field.attrib ? `attribs.${field.attrib}` : "—";
    return `| ${cell(field.loyalSnap)} | ${cell(field.key || "—")} | ${cell(field.type)} | ${cell(source)} | ${cell(field.optOut)} | ${cell(attrib)} | ${cell(field.syntax)} | ${cell(field.example || "empty")} | ${cell(field.fallback || "empty")} |`;
  });
  return [header, rule, ...lines].join("\n");
}

export function renderMergeDoc(): string {
  const gaps = MERGE_FIELDS.filter((field) => field.gap).length;
  const mapped = MERGE_FIELDS.length - gaps;
  return `# Merge fields

One row is one value. The field key is the same name in Chatwoot \`custom_attributes\` and listmonk \`attribs\`. Dates are ISO \`YYYY-MM-DD\`. Phone numbers are E.164. \`SYNC_CONTRACT.md\` is the spec for writing both systems. This worker does not run that sync. The shared keys, types, Mindbody sources, opt-out rules, and examples come from \`@balancemoves/contacts-core\`.

LoyalSnap tokens from the automation export and the dashboard scripts share rows when they print the same value. Mapped fields are read from Mindbody on each send and placed in \`POST /api/tx\` \`data\`. SMS bodies replace the LoyalSnap token. A gap has no Mindbody field. Studio name, phone, and address still fill from the worker, because the texts already say [Studio]. The message prints the studio phone as 0424 133 544 and a pass end date as 14 Oct 2026. The stored contact fields are \`+61424133544\` and \`2026-10-14\`. Offer prices, the agent name, and the purchase URLs stay empty until an owner sets them. A missing first name becomes "there" in the message. \`attribs.first_name\` stays the Mindbody value, including blank.

| | Count |
| --- | ---: |
| Mapped | ${mapped} |
| Gap | ${gaps} |

${renderFieldTable()}
`;
}

function cell(value: string): string {
  return value.replaceAll("|", "&#124;");
}
