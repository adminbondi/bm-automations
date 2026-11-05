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

export type ContactAttributeGroup = "profile" | "membership" | "packs" | "intro";

export type ContactAttribute = {
  label: string;
  key: string;
  legacyKey: string;
  type: "text" | "number" | "date" | "list" | "checkbox";
  group: ContactAttributeGroup;
  description: string;
  values?: string[];
};

/** Chatwoot custom attributes. Labels are what staff see. `key` is the proposed attribute key. `legacyKey` is the key the on-hold sync writes today. */
export const STAFF_CONTACT_ATTRIBUTES: ContactAttribute[] = [
  {
    label: "Mindbody ID",
    key: "mindbody_id",
    legacyKey: "mindbody_id",
    type: "text",
    group: "profile",
    description: "Mindbody client id. This key is not renamed.",
  },
  {
    label: "Active",
    key: "active",
    legacyKey: "mindbody_active",
    type: "checkbox",
    group: "profile",
    description: "Client Active flag.",
  },
  {
    label: "Membership name",
    key: "membership_name",
    legacyKey: "mindbody_membership_name",
    type: "text",
    group: "membership",
    description: "Current membership name. Empty when there is none.",
  },
  {
    label: "Member status",
    key: "member_status",
    legacyKey: "mindbody_membership_status",
    type: "list",
    group: "membership",
    description: "Active, On Hold, or None.",
    values: ["Active", "On Hold", "None"],
  },
  {
    label: "Membership expiry",
    key: "membership_expiry",
    legacyKey: "mindbody_membership_expiry",
    type: "date",
    group: "membership",
    description: "Membership expiry date. Empty when there is no membership.",
  },
  {
    label: "Packs",
    key: "packs",
    legacyKey: "mindbody_packs",
    type: "text",
    group: "packs",
    description: "Active packs: name, credits left, and expiry.",
  },
  {
    label: "Pack credits",
    key: "pack_credits",
    legacyKey: "mindbody_pack_credits_total",
    type: "number",
    group: "packs",
    description: "Credits left across active packs.",
  },
  {
    label: "Pack next expiry",
    key: "pack_next_expiry",
    legacyKey: "mindbody_pack_next_expiry",
    type: "date",
    group: "packs",
    description: "Earliest expiry among active packs.",
  },
  {
    label: "Intro client",
    key: "intro_client",
    legacyKey: "mindbody_intro_client",
    type: "checkbox",
    group: "intro",
    description: "True when the client has ever had an Intro Pass.",
  },
  {
    label: "Intro active",
    key: "intro_active",
    legacyKey: "mindbody_intro_active",
    type: "checkbox",
    group: "intro",
    description: "True when an Intro Pass has not expired, including one whose start date is still ahead.",
  },
  {
    label: "Intro visits used",
    key: "intro_visits_used",
    legacyKey: "mindbody_intro_visits_used",
    type: "number",
    group: "intro",
    description: "Intro Pass classes attended (signed in). Bookings are not counted.",
  },
  {
    label: "Intro expires",
    key: "intro_expires",
    legacyKey: "mindbody_intro_expiry",
    type: "date",
    group: "intro",
    description: "Expiry of the current or most recent Intro Pass.",
  },
  {
    label: "Intro days left",
    key: "intro_days_left",
    legacyKey: "mindbody_intro_days_left",
    type: "number",
    group: "intro",
    description: "Whole days until the Intro Pass expires in Australia/Sydney. 0 on the expiry day.",
  },
  {
    label: "Intro classes attended",
    key: "intro_classes_attended",
    legacyKey: "mindbody_intro_classes_attended",
    type: "number",
    group: "intro",
    description: "Past Intro Pass visits with SignedIn true.",
  },
  {
    label: "Intro classes missed",
    key: "intro_classes_missed",
    legacyKey: "mindbody_intro_classes_missed",
    type: "number",
    group: "intro",
    description: "Past Intro Pass visits that were late-cancelled or not signed in after the class ended.",
  },
  {
    label: "Intro last visit",
    key: "intro_last_visit",
    legacyKey: "mindbody_intro_last_visit",
    type: "date",
    group: "intro",
    description: "Sydney date of the most recent ended Intro Pass visit.",
  },
  {
    label: "Intro next class",
    key: "intro_next_class",
    legacyKey: "mindbody_intro_next_class",
    type: "date",
    group: "intro",
    description: "Sydney date of the next Intro Pass booking.",
  },
  {
    label: "Intro stage",
    key: "intro_stage",
    legacyKey: "mindbody_intro_stage",
    type: "list",
    group: "intro",
    description: "Recomputed from the latest intro data each sync.",
    values: ["Not booked yet", "Booked not visited yet", "Visited", "Missed last visit", "Expiring soon", "Finished"],
  },
];
