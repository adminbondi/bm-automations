import { CONTACT_ATTRIBUTES } from "@balancemoves/contacts-core";
import { MERGE_FIELDS, renderFieldTable } from "../merge/fields";

export function renderSyncContract(): string {
  const keys = MERGE_FIELDS.filter((field) => field.key).map((field) => field.key);
  return `# Shared contact fields

Spec only. bm-automations does not run the contact sync and does not talk to Chatwoot.

The shared Mindbody contact sync is the only writer of listmonk subscribers and Chatwoot contacts. One field list is used for both. The field key is the same string in Chatwoot \`contact.custom_attributes\` and listmonk subscriber \`attribs\`. The table is \`MERGE_FIELDS.md\`. It is repeated below so this file can be read on its own.

## Parallel writes

A contact change writes Chatwoot and listmonk in parallel. Each destination has its own retry queue. A listmonk outage retries on the listmonk queue only. A Chatwoot outage retries on the Chatwoot queue only. One destination being down does not block, delay, or roll back the other. A destination that already succeeded is not written again when the other destination retries.

Upserts are idempotent. Listmonk matches the subscriber by email. Chatwoot matches the contact by email, then by E.164 \`phone_number\`.

## Destinations

Listmonk built-in fields are \`email\` and \`name\`. \`name\` is the Mindbody first and last name separated by a space, so \`{{ .Subscriber.FirstName }}\` and \`{{ .Subscriber.LastName }}\` resolve. \`attribs.first_name\` is the Mindbody first name, including blank. Do not store the message fallback "there".

Chatwoot built-in fields are \`name\`, \`email\`, and \`phone_number\`. \`phone_number\` is the client mobile in E.164. The same keys also go in \`custom_attributes\`.

Every other key in the table is written only as \`attribs.{key}\` and \`custom_attributes.{key}\`.

## Formats

Dates are \`YYYY-MM-DD\`. \`pass_end_date\` \`2026-10-14\` is the stored value. This worker's message text still prints \`14 Oct 2026\`.

Phones are E.164. \`phone\` \`+61412345678\` is the client mobile from Mindbody \`MobilePhone\`. \`studio_phone\` \`+61424133544\` is the studio number. Messages still print \`0424 133 544\`.

## Opt-out

\`email_opt_out\` is true when Mindbody \`SendPromotionalEmails\` is false. True sets the listmonk subscriber status to \`blocklisted\`. False sets it to \`enabled\`. The same boolean is \`attribs.email_opt_out\` and Chatwoot \`custom_attributes.email_opt_out\`.

\`sms_opt_out\` is true when Mindbody \`SendPromotionalTexts\` is false. Chatwoot stores \`custom_attributes.sms_opt_out\` and must not text that contact. Listmonk stores \`attribs.sms_opt_out\` and does not blocklist for this flag. Listmonk has no SMS subscription.

## This worker

While \`CONTACT_WRITE_MODE\` is \`shared_sync\` (the default), this worker looks up the subscriber by email and sends the message. If listmonk has no row, it logs \`send_skipped\` with reason \`subscriber_missing\` and records \`skipped_no_subscriber\`. It does not create or update subscribers, and it does not call Chatwoot.

\`CONTACT_WRITE_MODE=self\` is for dev and test. A write runs only when \`DEV_MODE\` is true and the address is on \`SEND_ALLOWLIST\`.

Per-send values still go in \`POST /api/tx\` \`data\`, including \`passEndDate\`, \`visits\`, \`creditsRemaining\`, \`daysSinceExpiry\`, and \`daysSinceLastVisit\`. Rows with an empty field key are template data only. The sync does not store them.

## Shared module

The field list, the Mindbody-to-contact mapping (ISO dates, E.164 phones, email and SMS opt-out), the Mindbody API client, and the listmonk and Chatwoot contact clients live in \`@balancemoves/contacts-core\`. The source is \`packages/contacts-core\` in this repository. bm-automations already depends on that package and imports \`CONTACT_FIELDS\`, \`mapClient\`, \`MindbodyClient\`, \`ListmonkClient\`, and \`normalizePhone\` from it.

The Chatwoot sync Worker is on hold. Leave that Worker as it is. Do not copy these files into it. When that Worker resumes, it depends on the same package:

\`\`\`ts
import {
  CONTACT_FIELDS,
  mapClient,
  MindbodyClient,
  ListmonkClient,
  ChatwootContacts,
} from "@balancemoves/contacts-core";
\`\`\`

\`mapClient\` turns a Mindbody client payload into the shared attribs. \`MindbodyClient.contact\` loads that client and returns the same object. \`ListmonkClient.upsertContact\` writes the listmonk subscriber and sets \`blocklisted\` when \`emailOptOut\` is true. \`ChatwootContacts.upsert\` writes the Chatwoot contact. \`CONTACT_FIELDS\` is the LoyalSnap merge list below.

## Chatwoot contact attributes

Listmonk \`attribs\` for contact state use the same keys as Chatwoot \`custom_attributes\`. The list is vendored from \`adminbondi/mindbody-chatwoot-sync\` \`shared/contact-attributes.ts\` into \`packages/contacts-core/src/contact-attributes.ts\`. The \`mindbody_\` prefix is dropped. The id key is \`client_id\` (\`mindbody_id\` would collide with Chatwoot's own id). \`sharedContactAttribs\` writes every key below, including \`packs\`, \`pack_credits_total\`, \`reformer_credits\`, \`mat_barre_credits\`, \`breathwork_yoga_credits\`, and the \`intro_*\` keys. Class-pack credits use the same Mindbody product ids as the Chatwoot sync. LoyalSnap tokens such as \`first_name\` and \`pack_name\` stay on the send for the existing templates.

| Key | Display name |
| --- | --- |
${CONTACT_ATTRIBUTES.map((field) => `| ${field.attribute_key} | ${field.attribute_display_name} |`).join("\n")}

## Field list

${keys.length} shared keys.

${renderFieldTable()}
`;
}
