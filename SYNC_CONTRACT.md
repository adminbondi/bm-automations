# Shared contact fields

Spec only. bm-automations does not run the contact sync and does not talk to Chatwoot.

The shared Mindbody contact sync is the only writer of listmonk subscribers and Chatwoot contacts. One field list is used for both. The field key is the same string in Chatwoot `contact.custom_attributes` and listmonk subscriber `attribs`. The table is `MERGE_FIELDS.md`. It is repeated below so this file can be read on its own.

## Parallel writes

A contact change writes Chatwoot and listmonk in parallel. Each destination has its own retry queue. A listmonk outage retries on the listmonk queue only. A Chatwoot outage retries on the Chatwoot queue only. One destination being down does not block, delay, or roll back the other. A destination that already succeeded is not written again when the other destination retries.

Upserts are idempotent. Listmonk matches the subscriber by email. Chatwoot matches the contact by email, then by E.164 `phone_number`.

## Destinations

Listmonk built-in fields are `email` and `name`. `name` is the Mindbody first and last name separated by a space, so `{{ .Subscriber.FirstName }}` and `{{ .Subscriber.LastName }}` resolve. `attribs.first_name` is the Mindbody first name, including blank. Do not store the message fallback "there".

Chatwoot built-in fields are `name`, `email`, and `phone_number`. `phone_number` is the client mobile in E.164. The same keys also go in `custom_attributes`.

Every other key in the table is written only as `attribs.{key}` and `custom_attributes.{key}`.

## Formats

Dates are `YYYY-MM-DD`. `pass_end_date` `2026-10-14` is the stored value. This worker's message text still prints `14 Oct 2026`.

Phones are E.164. `phone` `+61412345678` is the client mobile from Mindbody `MobilePhone`. `studio_phone` `+61424133544` is the studio number. Messages still print `0424 133 544`.

## Opt-out

`email_opt_out` is true when Mindbody `SendPromotionalEmails` is false. True sets the listmonk subscriber status to `blocklisted`. False sets it to `enabled`. The same boolean is `attribs.email_opt_out` and Chatwoot `custom_attributes.email_opt_out`.

`sms_opt_out` is true when Mindbody `SendPromotionalTexts` is false. Chatwoot stores `custom_attributes.sms_opt_out` and must not text that contact. Listmonk stores `attribs.sms_opt_out` and does not blocklist for this flag. Listmonk has no SMS subscription.

## This worker

While `CONTACT_WRITE_MODE` is `shared_sync` (the default), this worker looks up the subscriber by email and sends the message. If listmonk has no row, it logs `send_skipped` with reason `subscriber_missing` and records `skipped_no_subscriber`. It does not create or update subscribers, and it does not call Chatwoot.

`CONTACT_WRITE_MODE=self` is for dev and test. A write runs only when `DEV_MODE` is true and the address is on `SEND_ALLOWLIST`.

Per-send values still go in `POST /api/tx` `data`, including `passEndDate`, `visits`, `creditsRemaining`, `daysSinceExpiry`, and `daysSinceLastVisit`. Rows with an empty field key are template data only. The sync does not store them.

## Shared module

The field list, the Mindbody-to-contact mapping (ISO dates, E.164 phones, email and SMS opt-out), the Mindbody API client, and the listmonk and Chatwoot contact clients live in `@balancemoves/contacts-core`. The source is `packages/contacts-core` in this repository. bm-automations already depends on that package and imports `CONTACT_FIELDS`, `CONTACT_ATTRIBUTES`, `mapClient`, `MindbodyClient`, `ListmonkClient`, and `normalizePhone` from it.

The Chatwoot sync Worker is on hold. Leave that Worker as it is. Do not copy these files into it. When that Worker resumes, it depends on the same package:

```ts
import {
  CONTACT_ATTRIBUTES,
  CONTACT_FIELDS,
  mapClient,
  MindbodyClient,
  ListmonkClient,
  ChatwootContacts,
} from "@balancemoves/contacts-core";
```

`mapClient` turns a Mindbody client payload into the shared attribs. `MindbodyClient.contact` loads that client and returns the same object. `ListmonkClient.upsertContact` writes the listmonk subscriber and sets `blocklisted` when `emailOptOut` is true. `ChatwootContacts.upsert` writes the Chatwoot contact. `CONTACT_FIELDS` is the LoyalSnap merge list below. `CONTACT_ATTRIBUTES` is the live Chatwoot key list. `STAFF_CONTACT_ATTRIBUTES` is the staff label list in the next section.

## Chatwoot contact attributes

Listmonk `attribs` for contact state use the same keys as Chatwoot `custom_attributes`. The list is vendored from `adminbondi/mindbody-chatwoot-sync` `shared/contact-attributes.ts` into `packages/contacts-core/src/contact-attributes.ts`. The `mindbody_` prefix is dropped. The id key is `client_id` (`mindbody_id` would collide with Chatwoot's own id). `sharedContactAttribs` writes every key below, including `packs`, `pack_credits_total`, `reformer_credits`, `mat_barre_credits`, `breathwork_yoga_credits`, and the `intro_*` keys. Class-pack credits use the same Mindbody product ids as the Chatwoot sync. LoyalSnap tokens such as `first_name` and `pack_name` stay on the send for the existing templates.

| Key | Display name |
| --- | --- |
| client_id | Client ID |
| active | active |
| membership_name | membership name |
| membership_status | Member status |
| membership_expiry | membership expiry |
| packs | Packs |
| pack_credits_total | pack credits |
| reformer_credits | Reformer credits |
| mat_barre_credits | Mat & Barre credits |
| breathwork_yoga_credits | Breathwork & Yoga credits |
| pack_next_expiry | pack next expiry |
| intro_client | intro client |
| intro_active | intro active |
| intro_visits_used | intro visits used |
| intro_expiry | intro expiry |
| intro_days_left | Intro days left |
| intro_classes_attended | Intro classes attended |
| intro_classes_missed | Intro classes missed |
| intro_last_visit | Intro last visit |
| intro_next_class | Intro next class |
| intro_stage | Intro stage |

## Chatwoot attribute labels

These are the staff-facing labels. Intro fields are grouped together. Every label except Mindbody ID has no Mindbody prefix.

The live keys are the table above. `client_id` is the identifier. The table below keeps the older proposed key next to the key the on-hold sync wrote. This repository does not rename live attributes and does not change that Worker.

### One-time rename

When that Worker resumes, rename each existing Chatwoot custom attribute once:

1. Create the attribute definition with the proposed key and the label in the table.
2. On each contact, copy `custom_attributes.{current key}` onto `custom_attributes.{proposed key}` when the current key has a value and the proposed key is empty.
3. Remove the current key from the contact after the copy.
4. Delete the old attribute definition after no contact still stores that key.

Skip `mindbody_id`. It already uses the proposed key and the label Mindbody ID. The live identifier written by this repository is `client_id`.

### Profile

| Label | Proposed key | Current key | Type |
| --- | --- | --- | --- |
| Mindbody ID | `mindbody_id` | `mindbody_id` | text |
| Active | `active` | `mindbody_active` | checkbox |

### Membership

| Label | Proposed key | Current key | Type |
| --- | --- | --- | --- |
| Membership name | `membership_name` | `mindbody_membership_name` | text |
| Member status | `member_status` | `mindbody_membership_status` | list: Active, On Hold, None |
| Membership expiry | `membership_expiry` | `mindbody_membership_expiry` | date |

### Packs

| Label | Proposed key | Current key | Type |
| --- | --- | --- | --- |
| Packs | `packs` | `mindbody_packs` | text |
| Pack credits | `pack_credits` | `mindbody_pack_credits_total` | number |
| Pack next expiry | `pack_next_expiry` | `mindbody_pack_next_expiry` | date |

### Intro

| Label | Proposed key | Current key | Type |
| --- | --- | --- | --- |
| Intro client | `intro_client` | `mindbody_intro_client` | checkbox |
| Intro active | `intro_active` | `mindbody_intro_active` | checkbox |
| Intro visits used | `intro_visits_used` | `mindbody_intro_visits_used` | number |
| Intro expires | `intro_expires` | `mindbody_intro_expiry` | date |
| Intro days left | `intro_days_left` | `mindbody_intro_days_left` | number |
| Intro classes attended | `intro_classes_attended` | `mindbody_intro_classes_attended` | number |
| Intro classes missed | `intro_classes_missed` | `mindbody_intro_classes_missed` | number |
| Intro last visit | `intro_last_visit` | `mindbody_intro_last_visit` | date |
| Intro next class | `intro_next_class` | `mindbody_intro_next_class` | date |
| Intro stage | `intro_stage` | `mindbody_intro_stage` | list: Not booked yet, Booked not visited yet, Visited, Missed last visit, Expiring soon, Finished |

## Field list

15 shared keys.

| LoyalSnap field | Field key | Type | Mindbody source | Opt-out | listmonk attrib | Template syntax | Example | Fallback |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| *&#124;FNAME&#124;*, [First name], @Client's first name | first_name | string | GET /client/clients — FirstName | — | attribs.first_name | {{ .Subscriber.FirstName }} and {{ .Tx.Data.FirstName }} | Alex | there |
| [Last name] | last_name | string | GET /client/clients — LastName | — | attribs.last_name | {{ .Subscriber.LastName }} and {{ .Tx.Data.LastName }} | Nguyen | empty |
| *&#124;EMAIL&#124;* | email | email | GET /client/clients — Email | — | attribs.email | {{ .Subscriber.Email }} and {{ .Tx.Data.Email }} | bondi@balancemoves.com.au | empty |
| client mobile (Chatwoot phone_number; not a LoyalSnap token) | phone | phone, E.164 | GET /client/clients — MobilePhone | — | attribs.phone | Chatwoot custom_attributes.phone and {{ .Subscriber.Attribs.phone }} | +61412345678 | empty |
| email opt-out (not a LoyalSnap token) | email_opt_out | boolean | GET /client/clients — SendPromotionalEmails is false | true sets listmonk status blocklisted; false sets enabled. Chatwoot custom_attributes.email_opt_out | attribs.email_opt_out | Chatwoot custom_attributes.email_opt_out and {{ .Subscriber.Attribs.email_opt_out }} | false | false |
| SMS opt-out (not a LoyalSnap token) | sms_opt_out | boolean | GET /client/clients — SendPromotionalTexts is false | Chatwoot custom_attributes.sms_opt_out. listmonk stores the boolean and does not blocklist for this flag | attribs.sms_opt_out | Chatwoot custom_attributes.sms_opt_out and {{ .Subscriber.Attribs.sms_opt_out }} | false | false |
| *&#124;STUDIO&#124;*, [Studio], @Name of the client's studio | studio | string | gap | — | attribs.studio | {{ .Subscriber.Attribs.studio }} and {{ .Tx.Data.studio }} | Balance Moves | Balance Moves |
| *&#124;PACK_NAME&#124;*, @Name of the client's package | pack_name | string | GET /client/clientservices — Name | — | attribs.pack_name | {{ .Subscriber.Attribs.pack_name }} and {{ .Tx.Data.packName }} | 2 Week Intro Pass | your pass |
| pass end date (expiring automations; no *&#124;DATE&#124;* tag in the export) | pass_end_date | date, YYYY-MM-DD. Messages print 14 Oct 2026 | GET /client/clientservices — ExpirationDate | — | attribs.pass_end_date | {{ .Subscriber.Attribs.pass_end_date }} and {{ .Tx.Data.passEndDate }} | 2026-10-14 | empty |
| visits (trial expiring copy says how many sessions; the preview hardcodes 5) | visits | integer | GET /client/clientvisits — signed-in visits in the automation's count | — | attribs.visits | {{ .Subscriber.Attribs.visits }} and {{ .Tx.Data.visits }} | 3 | 0 |
| @Number of credits remaining on the client's current package | credits_remaining | integer | GET /client/clientservices — Remaining | — | attribs.credits_remaining | {{ .Subscriber.Attribs.credits_remaining }} and {{ .Tx.Data.creditsRemaining }} | 2 | empty |
| @Days since the client's package expiration, in words | days_since_expiry | string, English words | GET /client/clientservices — ExpirationDate, counted against today | — | attribs.days_since_expiry | {{ .Subscriber.Attribs.days_since_expiry }} and {{ .Tx.Data.daysSinceExpiry }} | two | empty |
| @Number of days since the client's last visit, in words | days_since_last_visit | string, English words | GET /client/clientvisits — StartDateTime of the latest signed-in visit | — | attribs.days_since_last_visit | {{ .Subscriber.Attribs.days_since_last_visit }} and {{ .Tx.Data.daysSinceLastVisit }} | seven | empty |
| <%asm_group_unsubscribe_raw_url%> | — | url | gap | — | — | {{ .Tx.Data.unsubscribeUrl }} | https://campaigns.balancemoves.com.au/subscription/form | empty |
| @Studio phone number, &#124;STUDIO PHONE&#124;, STUDIO_PHONE | studio_phone | phone, E.164. Messages print 0424 133 544 | gap | — | attribs.studio_phone | {{ .Subscriber.Attribs.studio_phone }} and {{ .Tx.Data.studioPhone }} | +61424133544 | 0424 133 544 |
| @Studio address | studio_address | string | gap | — | attribs.studio_address | {{ .Subscriber.Attribs.studio_address }} and {{ .Tx.Data.studioAddress }} | 72A-74 Hall Street, Bondi Beach, NSW, 2026 | 72A-74 Hall Street, Bondi Beach, NSW, 2026 |
| @Agent | — | string | gap | — | — | {{ .Tx.Data.agent }} | empty | empty |
| @Intro Offer Purchase URL | — | url | gap | — | — | {{ .Tx.Data.introOfferUrl }} | empty | empty |
| @Secondary Offer Purchase URL | — | url | gap | — | — | {{ .Tx.Data.secondaryOfferUrl }} | empty | empty |
| [Secondary Offer Display Name] | — | string | gap | — | — | {{ .Tx.Data.secondaryOfferName }} | empty | empty |
| [Secondary Offer Discount Price] | — | string | gap | — | — | {{ .Tx.Data.secondaryOfferDiscountPrice }} | empty | empty |
| [Secondary Offer Price] | — | string | gap | — | — | {{ .Tx.Data.secondaryOfferPrice }} | empty | empty |
| [Secondary Offer Promo Code] | — | string | gap | — | — | {{ .Tx.Data.secondaryOfferPromoCode }} | empty | empty |
| [Secondary Offer Expiration] | — | string | gap | — | — | {{ .Tx.Data.secondaryOfferExpiration }} | empty | empty |
