export type MergeField = {
  loyalSnap: string;
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
    mindbody: "GET /client/clients — Email",
    attrib: "email",
    syntax: "{{ .Subscriber.Email }} and {{ .Tx.Data.Email }}",
    example: "bondi@balancemoves.com.au",
    fallback: "",
    gap: false,
    insert: "*|EMAIL|*",
  },
  {
    loyalSnap: "*|STUDIO|*, [Studio], @Name of the client's studio",
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
    mindbody: "GET /client/clientservices — ExpirationDate",
    attrib: "pass_end_date",
    syntax: "{{ .Subscriber.Attribs.pass_end_date }} and {{ .Tx.Data.passEndDate }}",
    example: "14 Oct 2026",
    fallback: "",
    gap: false,
    insert: "*|PASS_END|*",
  },
  {
    loyalSnap: "visits (trial expiring copy says how many sessions; the preview hardcodes 5)",
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
    mindbody: "gap",
    attrib: "studio_phone",
    syntax: "{{ .Subscriber.Attribs.studio_phone }} and {{ .Tx.Data.studioPhone }}",
    example: STUDIO_PHONE,
    fallback: STUDIO_PHONE,
    gap: true,
    insert: "@Studio phone number",
  },
  {
    loyalSnap: "@Studio address",
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
    mindbody: "gap",
    attrib: "",
    syntax: "{{ .Tx.Data.secondaryOfferExpiration }}",
    example: "",
    fallback: "",
    gap: true,
    insert: "[Secondary Offer Expiration]",
  },
];

export function renderMergeDoc(): string {
  const header = "| LoyalSnap field | Mindbody source | listmonk attrib | Template syntax | Example | Fallback |";
  const rule = "| --- | --- | --- | --- | --- | --- |";
  const lines = MERGE_FIELDS.map((field) => {
    const source = field.gap ? "gap" : field.mindbody;
    const attrib = field.attrib ? `attribs.${field.attrib}` : "—";
    return `| ${cell(field.loyalSnap)} | ${cell(source)} | ${cell(attrib)} | ${cell(field.syntax)} | ${cell(field.example)} | ${cell(field.fallback || "empty")} |`;
  });
  const gaps = MERGE_FIELDS.filter((field) => field.gap).length;
  const mapped = MERGE_FIELDS.length - gaps;
  return `# Merge fields

LoyalSnap tokens from the automation export and the dashboard scripts. One row is one value. Aliases that print the same value share a row.

Mapped fields are read from Mindbody on each send and written to the listmonk subscriber (\`attribs\`) and to \`POST /api/tx\` \`data\`. SMS bodies replace the LoyalSnap token. A gap has no Mindbody field. Studio name, phone, and address still fill from the worker, because the texts already say [Studio]. Offer prices, the agent name, and the purchase URLs stay empty until an owner sets them. A missing first name becomes "there". Other empty fallbacks remove the token.

| | Count |
| --- | ---: |
| Mapped | ${mapped} |
| Gap | ${gaps} |

${[header, rule, ...lines].join("\n")}
`;
}

function cell(value: string): string {
  return value.replaceAll("|", "&#124;");
}
