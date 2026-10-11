export type ContactField = {
  key: string;
  type: string;
  optOut: string;
  mindbody: string;
  example: string;
  gap: boolean;
};

export const STUDIO_PHONE_E164 = "+61424133544";
export const STUDIO_PHONE_DISPLAY = "0424 133 544";
export const STUDIO_ADDRESS = "72A-74 Hall Street, Bondi Beach, NSW, 2026";

export const CONTACT_FIELDS: ContactField[] = [
  {
    key: "first_name",
    type: "string",
    optOut: "—",
    mindbody: "GET /client/clients — FirstName",
    example: "Alex",
    gap: false,
  },
  {
    key: "last_name",
    type: "string",
    optOut: "—",
    mindbody: "GET /client/clients — LastName",
    example: "Nguyen",
    gap: false,
  },
  {
    key: "email",
    type: "email",
    optOut: "—",
    mindbody: "GET /client/clients — Email",
    example: "bondi@balancemoves.com.au",
    gap: false,
  },
  {
    key: "phone",
    type: "phone, E.164",
    optOut: "—",
    mindbody: "GET /client/clients — MobilePhone",
    example: "+61412345678",
    gap: false,
  },
  {
    key: "email_opt_out",
    type: "boolean",
    optOut: "true sets listmonk status blocklisted; false sets enabled. Chatwoot custom_attributes.email_opt_out",
    mindbody: "GET /client/clients — SendPromotionalEmails is false",
    example: "false",
    gap: false,
  },
  {
    key: "sms_opt_out",
    type: "boolean",
    optOut: "Chatwoot custom_attributes.sms_opt_out. listmonk stores the boolean and does not blocklist for this flag",
    mindbody: "GET /client/clients — SendPromotionalTexts is false",
    example: "false",
    gap: false,
  },
  {
    key: "studio",
    type: "string",
    optOut: "—",
    mindbody: "gap",
    example: "Balance Moves",
    gap: true,
  },
  {
    key: "pack_name",
    type: "string",
    optOut: "—",
    mindbody: "GET /client/clientservices — Name",
    example: "2 Week Intro Pass",
    gap: false,
  },
  {
    key: "pass_end_date",
    type: "date, YYYY-MM-DD. Messages print 14 Oct 2026",
    optOut: "—",
    mindbody: "GET /client/clientservices — ExpirationDate",
    example: "2026-10-14",
    gap: false,
  },
  {
    key: "visits",
    type: "integer",
    optOut: "—",
    mindbody: "GET /client/clientvisits — signed-in visits in the automation's count",
    example: "3",
    gap: false,
  },
  {
    key: "credits_remaining",
    type: "integer",
    optOut: "—",
    mindbody: "GET /client/clientservices — Remaining",
    example: "2",
    gap: false,
  },
  {
    key: "days_since_expiry",
    type: "string, English words",
    optOut: "—",
    mindbody: "GET /client/clientservices — ExpirationDate, counted against today",
    example: "two",
    gap: false,
  },
  {
    key: "days_since_last_visit",
    type: "string, English words",
    optOut: "—",
    mindbody: "GET /client/clientvisits — StartDateTime of the latest signed-in visit",
    example: "seven",
    gap: false,
  },
  {
    key: "studio_phone",
    type: "phone, E.164. Messages print 0424 133 544",
    optOut: "—",
    mindbody: "gap",
    example: STUDIO_PHONE_E164,
    gap: true,
  },
  {
    key: "studio_address",
    type: "string",
    optOut: "—",
    mindbody: "gap",
    example: STUDIO_ADDRESS,
    gap: true,
  },
];
