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

export const STUDIO_PHONE = "0424 133 544";
export const STUDIO_ADDRESS = "72A-74 Hall Street, Bondi Beach, NSW, 2026";

export const MERGE_FIELDS: MergeField[] = [
  {
    loyalSnap: "*|FNAME|*, [First name], @Client's first name",
    key: "first_name",
    type: "string",
    optOut: "—",
    mindbody: "GET /client/clients — FirstName",
    attrib: "first_name",
    syntax: "{{ .Subscriber.FirstName }} and {{ .Tx.Data.FirstName }}",
    example: "Alex",
    fallback: "there",
    gap: false,
    insert: "[First name]",
  },
  {
    loyalSnap: "[Last name]",
    key: "last_name",
    type: "string",
    optOut: "—",
    mindbody: "GET /client/clients — LastName",
    attrib: "last_name",
    syntax: "{{ .Subscriber.LastName }} and {{ .Tx.Data.LastName }}",
    example: "Nguyen",
    fallback: "",
    gap: false,
    insert: "[Last name]",
  },
  {
    loyalSnap: "*|EMAIL|*",
    key: "email",
    type: "email",
    optOut: "—",
    mindbody: "GET /client/clients — Email",
    attrib: "email",
    syntax: "{{ .Subscriber.Email }} and {{ .Tx.Data.Email }}",
    example: "bondi@balancemoves.com.au",
    fallback: "",
    gap: false,
    insert: "*|EMAIL|*",
  },
  {
    loyalSnap: "client mobile (Chatwoot phone_number; not a LoyalSnap token)",
    key: "phone",
    type: "phone, E.164",
    optOut: "—",
    mindbody: "GET /client/clients — MobilePhone",
    attrib: "phone",
    syntax: "Chatwoot custom_attributes.phone and {{ .Subscriber.Attribs.phone }}",
    example: "+61412345678",
    fallback: "",
    gap: false,
    insert: "",
  },
  {
    loyalSnap: "email opt-out (not a LoyalSnap token)",
    key: "email_opt_out",
    type: "boolean",
    optOut: "true sets listmonk status blocklisted; false sets enabled. Chatwoot custom_attributes.email_opt_out",
    mindbody: "GET /client/clients — SendPromotionalEmails is false",
    attrib: "email_opt_out",
    syntax: "Chatwoot custom_attributes.email_opt_out and {{ .Subscriber.Attribs.email_opt_out }}",
    example: "false",
    fallback: "false",
    gap: false,
    insert: "",
  },
  {
    loyalSnap: "SMS opt-out (not a LoyalSnap token)",
    key: "sms_opt_out",
    type: "boolean",
    optOut: "Chatwoot custom_attributes.sms_opt_out. listmonk stores the boolean and does not blocklist for this flag",
    mindbody: "GET /client/clients — SendPromotionalTexts is false",
    attrib: "sms_opt_out",
    syntax: "Chatwoot custom_attributes.sms_opt_out and {{ .Subscriber.Attribs.sms_opt_out }}",
    example: "false",
    fallback: "false",
    gap: false,
    insert: "",
  },
  {
    loyalSnap: "*|STUDIO|*, [Studio], @Name of the client's studio",
    key: "studio",
    type: "string",
    optOut: "—",
    mindbody: "gap",
    attrib: "studio",
    syntax: "{{ .Subscriber.Attribs.studio }} and {{ .Tx.Data.studio }}",
    example: "Balance Moves",
    fallback: "Balance Moves",
    gap: true,
    insert: "[Studio]",
  },
  {
    loyalSnap: "*|PACK_NAME|*, @Name of the client's package",
    key: "pack_name",
    type: "string",
    optOut: "—",
    mindbody: "GET /client/clientservices — Name",
    attrib: "pack_name",
    syntax: "{{ .Subscriber.Attribs.pack_name }} and {{ .Tx.Data.packName }}",
    example: "2 Week Intro Pass",
    fallback: "your pass",
    gap: false,
    insert: "*|PACK_NAME|*",
  },
  {
    loyalSnap: "pass end date (expiring automations; no *|DATE|* tag in the export)",
    key: "pass_end_date",
    type: "date, YYYY-MM-DD. Messages print 14 Oct 2026",
    optOut: "—",
    mindbody: "GET /client/clientservices — ExpirationDate",
    attrib: "pass_end_date",
    syntax: "{{ .Subscriber.Attribs.pass_end_date }} and {{ .Tx.Data.passEndDate }}",
    example: "2026-10-14",
    fallback: "",
    gap: false,
    insert: "*|PASS_END|*",
  },
  {
    loyalSnap: "visits (trial expiring copy says how many sessions; the preview hardcodes 5)",
    key: "visits",
    type: "integer",
    optOut: "—",
    mindbody: "GET /client/clientvisits — signed-in visits in the automation's count",
    attrib: "visits",
    syntax: "{{ .Subscriber.Attribs.visits }} and {{ .Tx.Data.visits }}",
    example: "3",
    fallback: "0",
    gap: false,
    insert: "*|VISITS|*",
  },
  {
    loyalSnap: "@Number of credits remaining on the client's current package",
    key: "credits_remaining",
    type: "integer",
    optOut: "—",
    mindbody: "GET /client/clientservices — Remaining",
    attrib: "credits_remaining",
    syntax: "{{ .Subscriber.Attribs.credits_remaining }} and {{ .Tx.Data.creditsRemaining }}",
    example: "2",
    fallback: "",
    gap: false,
    insert: "*|CREDITS|*",
  },
  {
    loyalSnap: "@Days since the client's package expiration, in words",
    key: "days_since_expiry",
    type: "string, English words",
    optOut: "—",
    mindbody: "GET /client/clientservices — ExpirationDate, counted against today",
    attrib: "days_since_expiry",
    syntax: "{{ .Subscriber.Attribs.days_since_expiry }} and {{ .Tx.Data.daysSinceExpiry }}",
    example: "two",
    fallback: "",
    gap: false,
    insert: "*|DAYS_SINCE_EXPIRY|*",
  },
  {
    loyalSnap: "@Number of days since the client's last visit, in words",
    key: "days_since_last_visit",
    type: "string, English words",
    optOut: "—",
    mindbody: "GET /client/clientvisits — StartDateTime of the latest signed-in visit",
    attrib: "days_since_last_visit",
    syntax: "{{ .Subscriber.Attribs.days_since_last_visit }} and {{ .Tx.Data.daysSinceLastVisit }}",
    example: "seven",
    fallback: "",
    gap: false,
    insert: "*|DAYS_SINCE_VISIT|*",
  },
  {
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
  },
  {
    loyalSnap: "@Studio phone number, |STUDIO PHONE|, STUDIO_PHONE",
    key: "studio_phone",
    type: "phone, E.164. Messages print 0424 133 544",
    optOut: "—",
    mindbody: "gap",
    attrib: "studio_phone",
    syntax: "{{ .Subscriber.Attribs.studio_phone }} and {{ .Tx.Data.studioPhone }}",
    example: "+61424133544",
    fallback: STUDIO_PHONE,
    gap: true,
    insert: "@Studio phone number",
  },
  {
    loyalSnap: "@Studio address",
    key: "studio_address",
    type: "string",
    optOut: "—",
    mindbody: "gap",
    attrib: "studio_address",
    syntax: "{{ .Subscriber.Attribs.studio_address }} and {{ .Tx.Data.studioAddress }}",
    example: STUDIO_ADDRESS,
    fallback: STUDIO_ADDRESS,
    gap: true,
    insert: "@Studio address",
  },
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

One row is one value. The field key is the same name in Chatwoot \`custom_attributes\` and listmonk \`attribs\`. Dates are ISO \`YYYY-MM-DD\`. Phone numbers are E.164. \`SYNC_CONTRACT.md\` is the spec for writing both systems. This worker does not run that sync.

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
