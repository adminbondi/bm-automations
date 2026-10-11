# Listmonk contact sync

The shared Mindbody contact sync is the only writer of listmonk subscribers. It is the same sync that feeds Chatwoot. This worker looks up a subscriber by email and sends the message. It does not create or update subscribers while `CONTACT_WRITE_MODE` is `shared_sync`, which is the default.

If listmonk has no subscriber for that email, the email is not sent. The worker logs `send_skipped` with reason `subscriber_missing` and records the send log as `skipped_no_subscriber`.

`CONTACT_WRITE_MODE=self` is for dev and test. A write runs only when `DEV_MODE` is true and the address is on `SEND_ALLOWLIST`. Any other address is read the same way as `shared_sync`. A `self` write creates the subscriber when missing and updates `attribs` when the row already exists. A copy recipient is created without replacing that inbox's attributes.

## What the shared sync must write

Set the listmonk subscriber `name` to the Mindbody first and last name, separated by a space. `{{ .Subscriber.FirstName }}` and `{{ .Subscriber.LastName }}` come from that name. `attribs.first_name` is the Mindbody first name, including blank. Do not store the SMS fallback "there" on the subscriber.

Write every key below. Values that change between sends are also placed in `POST /api/tx` `data` by this worker, so a template can use `{{ .Tx.Data.passEndDate }}` even when the stored attribute is older.

| listmonk key | Mindbody source | Example | Who fills it |
| --- | --- | --- | --- |
| attribs.first_name | GET /client/clients — FirstName | Alex | Shared sync writes attribs.first_name. |
| attribs.last_name | GET /client/clients — LastName | Nguyen | Shared sync writes attribs.last_name. |
| attribs.email | GET /client/clients — Email | bondi@balancemoves.com.au | Shared sync writes attribs.email. |
| attribs.studio | gap | Balance Moves | Shared sync writes attribs.studio. |
| attribs.pack_name | GET /client/clientservices — Name | 2 Week Intro Pass | Shared sync writes attribs.pack_name. This worker also sends the live value in Tx.Data. |
| attribs.pass_end_date | GET /client/clientservices — ExpirationDate | 14 Oct 2026 | Shared sync writes attribs.pass_end_date. This worker also sends the live value in Tx.Data. |
| attribs.visits | GET /client/clientvisits — signed-in visits in the automation's count | 3 | Shared sync writes attribs.visits. This worker also sends the live value in Tx.Data. |
| attribs.credits_remaining | GET /client/clientservices — Remaining | 2 | Shared sync writes attribs.credits_remaining. This worker also sends the live value in Tx.Data. |
| attribs.days_since_expiry | GET /client/clientservices — ExpirationDate, counted against today | two | Shared sync writes attribs.days_since_expiry. This worker also sends the live value in Tx.Data. |
| attribs.days_since_last_visit | GET /client/clientvisits — StartDateTime of the latest signed-in visit | seven | Shared sync writes attribs.days_since_last_visit. This worker also sends the live value in Tx.Data. |
| attribs.studio_phone | gap | 0424 133 544 | Shared sync writes attribs.studio_phone. |
| attribs.studio_address | gap | 72A-74 Hall Street, Bondi Beach, NSW, 2026 | Shared sync writes attribs.studio_address. |

## Sent in Tx.Data, not stored by the sync

| Template field | Mindbody source | Example | Who fills it |
| --- | --- | --- | --- |
| {{ .Tx.Data.unsubscribeUrl }} | gap | https://campaigns.balancemoves.com.au/subscription/form | This worker, on each send. Not a subscriber attribute. |
| {{ .Tx.Data.agent }} | gap | empty | This worker, on each send. Not a subscriber attribute. |
| {{ .Tx.Data.introOfferUrl }} | gap | empty | This worker, on each send. Not a subscriber attribute. |
| {{ .Tx.Data.secondaryOfferUrl }} | gap | empty | This worker, on each send. Not a subscriber attribute. |
| {{ .Tx.Data.secondaryOfferName }} | gap | empty | This worker, on each send. Not a subscriber attribute. |
| {{ .Tx.Data.secondaryOfferDiscountPrice }} | gap | empty | This worker, on each send. Not a subscriber attribute. |
| {{ .Tx.Data.secondaryOfferPrice }} | gap | empty | This worker, on each send. Not a subscriber attribute. |
| {{ .Tx.Data.secondaryOfferPromoCode }} | gap | empty | This worker, on each send. Not a subscriber attribute. |
| {{ .Tx.Data.secondaryOfferExpiration }} | gap | empty | This worker, on each send. Not a subscriber attribute. |

`preferencesUrl` is the same address as `unsubscribeUrl`. Studio name, phone, and address are gaps in Mindbody. Write the examples above: Balance Moves, 0424 133 544, and 72A-74 Hall Street, Bondi Beach, NSW, 2026.
