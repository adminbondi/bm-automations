/**
 * Vendored from adminbondi/mindbody-chatwoot-sync shared/contact-attributes.ts
 * (commit d5fa073, blob c8244b2e4f430a63d5b3293e9dbfa865a9901c73).
 * Listmonk attribs use these keys so they match Chatwoot custom attributes.
 *
 * Shared contact custom-attribute mapping.
 *
 * The Chatwoot sync writes these keys and display names. Keep this module as
 * the only list so another attribute sync (listmonk) uses the same names.
 *
 * Keys drop the `mindbody_` prefix. Display names drop a leading `Mindbody `.
 * `mindbody_id` would become `id`, which is the Chatwoot contact's own id, so
 * that one stays `client_id` / "Client ID".
 *
 * Chatwoot display types: text 0, number 1, date 5, list 6, checkbox 7.
 * attribute_model 1 is a contact attribute.
 *
 * Intro stage values match `INTRO_STAGES` in `shared/account.ts`. The test
 * checks that. This file does not import `account.ts`, so the one-off rename
 * script can load it under Node's type stripper.
 */

/** Chatwoot contact columns and standard filter keys. Custom keys must not use these. */
export const CHATWOOT_CONTACT_BUILTIN_KEYS: ReadonlySet<string> = new Set([
  "id",
  "name",
  "email",
  "phone_number",
  "identifier",
  "country_code",
  "city",
  "company_name",
  "created_at",
  "updated_at",
  "last_activity_at",
  "referer",
  "blocked",
  "account_id",
  "additional_attributes",
  "custom_attributes",
]);

export const CONTACT_ATTRIBUTES = [
  {
    attribute_key: "client_id",
    attribute_display_name: "Client ID",
    attribute_display_type: 0,
    attribute_description: "Mindbody client id",
    attribute_model: 1,
  },
  {
    attribute_key: "active",
    attribute_display_name: "active",
    attribute_display_type: 7,
    attribute_description: "Mindbody client Active flag",
    attribute_model: 1,
  },
  {
    attribute_key: "membership_name",
    attribute_display_name: "membership name",
    attribute_display_type: 0,
    attribute_description: "Current membership name. Empty when Mindbody shows none.",
    attribute_model: 1,
  },
  {
    attribute_key: "membership_status",
    attribute_display_name: "Member status",
    attribute_display_type: 6,
    attribute_description: "Active, On Hold, or None.",
    attribute_values: ["Active", "On Hold", "None"],
    attribute_model: 1,
  },
  {
    attribute_key: "membership_expiry",
    attribute_display_name: "membership expiry",
    attribute_display_type: 5,
    attribute_description: "Membership expiry date. Empty when there is no membership.",
    attribute_model: 1,
  },
  {
    attribute_key: "packs",
    attribute_display_name: "Packs",
    attribute_display_type: 0,
    attribute_description: "Active packs: name, credits left, and expiry.",
    attribute_model: 1,
  },
  {
    attribute_key: "pack_credits_total",
    attribute_display_name: "pack credits",
    attribute_display_type: 1,
    attribute_description: "Credits left across active packs.",
    attribute_model: 1,
  },
  {
    attribute_key: "reformer_credits",
    attribute_display_name: "Reformer credits",
    attribute_display_type: 1,
    attribute_description: "Credits left on usable Reformer packs. 0 when there are none.",
    attribute_model: 1,
  },
  {
    attribute_key: "mat_barre_credits",
    attribute_display_name: "Mat & Barre credits",
    attribute_display_type: 1,
    attribute_description: "Credits left on usable Mat & Barre packs. 0 when there are none.",
    attribute_model: 1,
  },
  {
    attribute_key: "breathwork_yoga_credits",
    attribute_display_name: "Breathwork & Yoga credits",
    attribute_display_type: 1,
    attribute_description: "Credits left on usable Breathwork & Yoga packs. 0 when there are none.",
    attribute_model: 1,
  },
  {
    attribute_key: "pack_next_expiry",
    attribute_display_name: "pack next expiry",
    attribute_display_type: 5,
    attribute_description: "Earliest expiry among active packs.",
    attribute_model: 1,
  },
  {
    attribute_key: "intro_client",
    attribute_display_name: "intro client",
    attribute_display_type: 7,
    attribute_description: "True when the client has ever had an Intro Pass.",
    attribute_model: 1,
  },
  {
    attribute_key: "intro_active",
    attribute_display_name: "intro active",
    attribute_display_type: 7,
    attribute_description: "True when an Intro Pass has not expired, including one whose start date is still ahead.",
    attribute_model: 1,
  },
  {
    attribute_key: "intro_visits_used",
    attribute_display_name: "intro visits used",
    attribute_display_type: 1,
    attribute_description: "Intro Pass classes attended (signed in). Bookings are not counted.",
    attribute_model: 1,
  },
  {
    attribute_key: "intro_expiry",
    attribute_display_name: "intro expiry",
    attribute_display_type: 5,
    attribute_description: "Expiry of the current or most recent Intro Pass.",
    attribute_model: 1,
  },
  {
    attribute_key: "intro_days_left",
    attribute_display_name: "Intro days left",
    attribute_display_type: 1,
    attribute_description: "Whole days until the Intro Pass expires in Australia/Sydney. 0 on the expiry day.",
    attribute_model: 1,
  },
  {
    attribute_key: "intro_classes_attended",
    attribute_display_name: "Intro classes attended",
    attribute_display_type: 1,
    attribute_description: "Past Intro Pass visits with SignedIn true.",
    attribute_model: 1,
  },
  {
    attribute_key: "intro_classes_missed",
    attribute_display_name: "Intro classes missed",
    attribute_display_type: 1,
    attribute_description: "Past Intro Pass visits that were late-cancelled or not signed in after the class ended.",
    attribute_model: 1,
  },
  {
    attribute_key: "intro_last_visit",
    attribute_display_name: "Intro last visit",
    attribute_display_type: 5,
    attribute_description: "Sydney date of the most recent ended Intro Pass visit.",
    attribute_model: 1,
  },
  {
    attribute_key: "intro_next_class",
    attribute_display_name: "Intro next class",
    attribute_display_type: 5,
    attribute_description: "Sydney date of the next Intro Pass booking.",
    attribute_model: 1,
  },
  {
    attribute_key: "intro_stage",
    attribute_display_name: "Intro stage",
    attribute_display_type: 6,
    attribute_description:
      "Recomputed from the latest Mindbody intro data each sync. Not from the order events arrive.",
    attribute_values: [
      "Not booked yet",
      "Booked not visited yet",
      "Visited",
      "Missed last visit",
      "Expiring soon",
      "Finished",
    ],
    attribute_model: 1,
  },
] as const;

export type ContactAttributeKey = (typeof CONTACT_ATTRIBUTES)[number]["attribute_key"];

/**
 * Previous Chatwoot key and display name, and the name written from now on.
 * `mindbody_id` is the only row whose new key is not the prefix stripped off.
 */
export const CONTACT_ATTRIBUTE_RENAMES = [
  { from: "mindbody_id", to: "client_id", fromDisplay: "Mindbody ID", toDisplay: "Client ID" },
  { from: "mindbody_active", to: "active", fromDisplay: "Mindbody active", toDisplay: "active" },
  {
    from: "mindbody_membership_name",
    to: "membership_name",
    fromDisplay: "Mindbody membership name",
    toDisplay: "membership name",
  },
  {
    from: "mindbody_membership_status",
    to: "membership_status",
    fromDisplay: "Mindbody membership status",
    toDisplay: "Member status",
  },
  {
    from: "mindbody_membership_expiry",
    to: "membership_expiry",
    fromDisplay: "Mindbody membership expiry",
    toDisplay: "membership expiry",
  },
  { from: "mindbody_packs", to: "packs", fromDisplay: "Mindbody packs", toDisplay: "Packs" },
  {
    from: "mindbody_pack_credits_total",
    to: "pack_credits_total",
    fromDisplay: "Mindbody pack credits",
    toDisplay: "pack credits",
  },
  {
    from: "mindbody_pack_next_expiry",
    to: "pack_next_expiry",
    fromDisplay: "Mindbody pack next expiry",
    toDisplay: "pack next expiry",
  },
  {
    from: "mindbody_intro_client",
    to: "intro_client",
    fromDisplay: "Mindbody intro client",
    toDisplay: "intro client",
  },
  {
    from: "mindbody_intro_active",
    to: "intro_active",
    fromDisplay: "Mindbody intro active",
    toDisplay: "intro active",
  },
  {
    from: "mindbody_intro_visits_used",
    to: "intro_visits_used",
    fromDisplay: "Mindbody intro visits used",
    toDisplay: "intro visits used",
  },
  {
    from: "mindbody_intro_expiry",
    to: "intro_expiry",
    fromDisplay: "Mindbody intro expiry",
    toDisplay: "intro expiry",
  },
  {
    from: "mindbody_intro_days_left",
    to: "intro_days_left",
    fromDisplay: "Intro days left",
    toDisplay: "Intro days left",
  },
  {
    from: "mindbody_intro_classes_attended",
    to: "intro_classes_attended",
    fromDisplay: "Intro classes attended",
    toDisplay: "Intro classes attended",
  },
  {
    from: "mindbody_intro_classes_missed",
    to: "intro_classes_missed",
    fromDisplay: "Intro classes missed",
    toDisplay: "Intro classes missed",
  },
  {
    from: "mindbody_intro_last_visit",
    to: "intro_last_visit",
    fromDisplay: "Intro last visit",
    toDisplay: "Intro last visit",
  },
  {
    from: "mindbody_intro_next_class",
    to: "intro_next_class",
    fromDisplay: "Intro next class",
    toDisplay: "Intro next class",
  },
  { from: "mindbody_intro_stage", to: "intro_stage", fromDisplay: "Intro stage", toDisplay: "Intro stage" },
] as const;

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

/**
 * New keys to merge onto a contact. A key already present, including null,
 * false, 0, or "", is left as it is. A missing new key is filled from the old
 * key, including an explicit empty value. Old keys are not removed here.
 */
export function attributesToCopy(
  attributes: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const source = attributes ?? {};
  const patch: Record<string, unknown> = {};
  for (const { from, to } of CONTACT_ATTRIBUTE_RENAMES) {
    if (!hasOwn(source, from)) continue;
    if (hasOwn(source, to)) continue;
    patch[to] = source[from];
  }
  return patch;
}
