# bm-automations

Cloudflare Worker for Balance Moves (Mindbody site `9853`). It replaces the LoyalSnap automations that were on, and seeds the ones that were off so an owner can recreate them. Rules live in D1. Nothing sends until an owner enables that row. `COVERAGE.md` maps all 71 automations, the 19 dashboard lanes, and the client lists.

Mindbody webhooks and the Sydney morning cron re-check the Mindbody Public API, then send email through listmonk (`POST /api/tx` at `https://campaigns.balancemoves.com.au`) or SMS through Twilio. Signed-in owners manage the rows at `/automations`, the send log at `/log`, and connections at `/settings`. Tasks links out to the task dashboard.

## Safety

- `DEV_MODE` defaults to `true`. A send whose address is not on `SEND_ALLOWLIST` (email) or `SMS_ALLOWLIST` / phone entries in `SEND_ALLOWLIST` is logged and skipped.
- Every seeded automation has `enabled = 0`. The worker does not send until that row is turned on.
- `DRY_RUN=true`, `X-Dry-Run: true` on a signed webhook, and `POST /admin/dry-run` return the plan and do not call listmonk or Twilio. The header and the admin preview also skip job and message-id writes.
- SMS quiet hours default to 20:00–09:00 Australia/Sydney (end exclusive, so 09:00 is allowed). The default action holds the text and sends after quiet hours. Settings can switch that to skip. The test-text endpoint always requires an allowlisted number, including when dev mode is off.
- Texts send from the Twilio number unless Settings chooses a sender name. An optional "Reply STOP" footer is off until an owner turns it on.
- Do not deploy this worker or register Mindbody webhooks until owners turn dev mode off on purpose. Amazon SES for listmonk is still in sandbox.

## Coverage

`COVERAGE.md` is the audit. The 13 automations that were on in LoyalSnap keep listmonk templates 5–13. The other 58 are seeded disabled. Emails with no listmonk template id do not send; the job waits with `template_missing`. Package and contract names that were not in the export are an empty list, which matches nothing until an owner fills them in.

New timing and filters, all data on the row: `days_since_last_visit`, `birthday_day`, `birthday_month_start`, `everyNthVisit`, a visit window, remaining credits (`exactRemaining`, `minRemaining`, `maxRemaining`), and `clientActivity` active or inactive. Visit rows store a Sydney start date. Services store Mindbody `Remaining`. Profiles store `BirthDate` and `ReferredBy`.

External leads are not a Mindbody event. `POST /webhooks/lead` accepts the same JSON shape as a Mindbody webhook (`eventId` `lead.created`) and requires header `X-Lead-Token` equal to the `LEAD_WEBHOOK_SECRET` secret. If that secret is unset, the route returns 401. It does not talk to Facebook.

Dashboard lanes and dynamic lists are segment filters in `src/segments/catalog.ts`. They do not send. The red-flag lane is a gap until owners set how many days count as low usage. Static client-list titles are gaps: the export had titles only.

## Merge fields

`MERGE_FIELDS.md` lists every LoyalSnap token from the automation export and the dashboard scripts. On a send the worker reads the mapped values from the Mindbody snapshot already loaded for that client, writes them onto the listmonk subscriber (`PUT /api/subscribers/{id}` `attribs`), and sends the same values in `POST /api/tx` `data`. SMS replaces the token in the message. A missing first name becomes "there" in the text and in `Tx.Data.FirstName`. The subscriber attribute stays the Mindbody value, including blank. Studio phone and address fill from the worker. Offer prices, the agent name, and the purchase URLs are gaps and render as empty.

`GET /admin/merge-fields` returns that list plus example values. The text editor has an Insert field control that drops the token into the message. The phone preview uses the example values.

## Run locally

```bash
npm install
cp .dev.vars.example .dev.vars
npm test
npx wrangler d1 migrations apply bm-automations --local
npm run dev
```

Apply the local D1 migrations before starting the dev server. `wrangler dev` does not always create those tables on its own.

[Health check](http://127.0.0.1:8791/health) answers `{ "ok": true, "devMode": true }`. `GET /` is the Google sign-in page, and a signed-in session opens [Automations](http://127.0.0.1:8791/automations). `GET /admin/settings` without a session returns `401`.

`npm run typecheck` generates nothing by itself. `npm run cf-typegen` refreshes `worker-configuration.d.ts` after a binding change.

## Admin API

Google OAuth uses scope `openid email`, an HMAC-signed `bm_automations_session` cookie (7 days), and `ADMIN_EMAILS`. The cookie name is different from the task dashboard so the two workers do not share a session. An empty allowlist locks the API.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/login` | Redirect to Google |
| GET | `/auth/google/callback` | Finish sign-in |
| POST | `/logout` | Clear the session |
| GET | `/admin/automations` | List rows |
| POST | `/admin/automations` | Create a row (disabled unless `enabled: true`) |
| GET, PATCH | `/admin/automations/:id` | Read or update |
| POST | `/admin/automations/:id/toggle` | Flip `enabled` |
| GET | `/admin/send-log` | Recent sends (`limit`, `automationId`) |
| GET, PATCH | `/admin/settings` | Connection settings. Secrets are write-only |
| POST | `/admin/settings/test/listmonk` | Authenticated listmonk check |
| POST | `/admin/settings/test/twilio` | Test SMS to an allowlisted number |
| POST | `/admin/dry-run` | Plan a webhook body without sending |
| GET | `/admin/merge-fields` | Merge-field catalog and example preview values |

PATCH settings omit a field to keep it. Send an empty string to clear it. Stored secrets are AES-GCM ciphertext. The key is the Worker secret `SETTINGS_ENCRYPTION_KEY` (SHA-256, then AES-GCM). The API returns `connected: true/false` and never the secret or the ciphertext.

The same controls are on the signed-in pages: `/automations`, `/automations/:id` (add `#email` to open the email message box), `/log`, `/settings`.

Listmonk settings: base URL, API user (shown again after save), API token (write-only). Twilio settings: account SID, auth token, sending number, sender name, and whether texts use the number or the name. Also stored: default from name, from address, and reply-to; SMS quiet hours and hold-or-skip; the Reply STOP footer. Mindbody keys stay Worker secrets. List ids stay vars (`LISTMONK_LIST_ID`, `LISTMONK_SUPPRESSED_LIST_ID`). If a setting row is missing, the matching env value is the fallback. From name defaults to Balance Moves, from address to hello@balancemoves.com.au, and reply-to to bondi@balancemoves.com.au until a row is saved. Email subjects for templates 5–13 are displayed from the worker, not fetched from listmonk.

## Seeded rows

Emails use listmonk templates 5–13. SMS rows store message text and a null template id. Wording is the LoyalSnap copy captured 11 Oct 2026 (texts 561548, 561561, 561552, 561559). Those texts were WhatsApp. These rows send SMS.

1. Lead, immediate, template 5. Skips when the client already has a service or contract.
2. Lead, day 60, template 6. Skips a signed-in visit, any purchase, or suppression.
3. Intro pass purchased, template 7.
4. Third signed-in intro visit, template 8. Skips a membership once `membershipContractNames` is filled in.
5. Intro expiry minus 3 days, at least one intro visit, template 9 (`visits` in template data).
6. Intro expiry minus 1 day, exactly one intro visit, template 10. Skips a membership once the names are set.
7. Contract created, template 11. `contractNames` is empty, so it matches nothing until owners save the names.
8. Third signed-in visit, any service, template 12. This is the email. No package filter.
9. ClassPass item on `client.created` or `classRosterBooking.created`, template 13. Skips when the liability waiver is already released.
10. SMS, 7 days after an intro sale, only if the client still has no non-cancelled visit (booked or attended).
11. SMS, third signed-in intro visit, Google review link.
12. SMS, one day before intro expiry, at least one intro visit. Unlike email 6, this does not require exactly one visit and does not skip memberships.
13. SMS, 10 days after a 2-week intro expires. The 7-day pass is not included.

`[First name]` and `[Studio]` are filled in at send time. The studio name defaults to Balance Moves. A missing first name becomes `there`.

## Deploy and webhook steps

Do not run these until dev mode, allowlists, and the open questions below are settled.

```bash
npx wrangler d1 create bm-automations
```

Put the returned id in `wrangler.jsonc` (`database_id`), then:

```bash
npx wrangler d1 migrations apply bm-automations --remote
npx wrangler secret put MINDBODY_API_KEY
npx wrangler secret put MINDBODY_STAFF_USERNAME
npx wrangler secret put MINDBODY_STAFF_PASSWORD
npx wrangler secret put MINDBODY_WEBHOOK_SIGNATURE_KEY
npx wrangler secret put LISTMONK_API_USER
npx wrangler secret put LISTMONK_API_TOKEN
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put SESSION_SECRET
npx wrangler secret put SETTINGS_ENCRYPTION_KEY
npx wrangler secret put TWILIO_ACCOUNT_SID
npx wrangler secret put TWILIO_AUTH_TOKEN
./scripts/deploy.sh
```

`scripts/deploy.sh` runs `npm test` and `npm run typecheck` first. If either fails, wrangler does not deploy. The same checks run in `.github/workflows/ci.yml` on push and pull request.

`ADMIN_EMAILS` is a var. Set it to the owner addresses before deploy, or staff cannot sign in. Google's redirect URI is `https://<worker-host>/auth/google/callback`.

The webhook signing key is returned only when the Mindbody subscription is created. Subscribe only when ready:

```bash
curl -X POST https://mb-api.mindbodyonline.com/push/api/v1/subscriptions \
  -H "API-Key: $MINDBODY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "eventIds": ["client.created", "clientSale.created", "clientContract.created", "classRosterBooking.created", "classRosterBookingStatus.updated"],
    "eventSchemaVersion": 1,
    "referenceId": "bm-automations",
    "webhookUrl": "https://<worker-host>/webhooks/mindbody"
  }'
```

Save `messageSignatureKey` with `wrangler secret put MINDBODY_WEBHOOK_SIGNATURE_KEY`, then PATCH the subscription status to `Active`. Signature header: `X-Mindbody-Signature: sha256=` plus base64 HMAC-SHA256 of the raw body. Events for any site other than `9853` are ignored.

Staff token: `POST https://api.mindbodyonline.com/public/v6/usertoken/issue`. Later calls send `Api-Key`, `SiteId`, and `Authorization` set to the raw access token.

Listmonk sends `Authorization: token <user>:<token>`. Transactional templates 5–13 already exist. This worker does not update them. It passes `unsubscribeUrl` and `preferencesUrl` in `Tx.Data` when it sends. A real subscriber uuid uses `https://campaigns.balancemoves.com.au/subscription/<uuid>/<uuid>`. Otherwise it uses `/subscription/form`. The live templates still need to render that field in place of the `mailto:bondi@` unsubscribe.

## Open questions

- Exact Mindbody names for the 2-week and 7-day intro passes. The seed matches `2 week`, `2-week`, `7 day`, `7-day`, and `intro pass`.
- The 11–17 membership contract names. Email 7 matches nothing while `contractNames` is empty. Emails 4, 5, and 6 do not treat any current contract as a membership until `membershipContractNames` is filled in. A warning `membership_contract_names_empty` is attached when a client has contracts and that list is still empty.
- The four ClassPass pricing-option names. The seed matches `classpass` and `class pass`.
- Whether trial visit counts should include ClassPass. Defaults: signed-in visits; ClassPass excluded for automations 4, 5, 6, 11, and 12; included for 2 and 8.
- Whether "has not booked" for the day-7 text should ignore historical visits. Today any non-cancelled visit in a window from 400 days ago to 400 days ahead counts, including a future booking. Late and early cancellations do not count.
- Whether intro `ExpirationDate` starts on the first visit. The worker trusts Mindbody's date.
- Whether `isLiabilityReleased` is the KAN-13 ClassPass waiver. The waiver URL stays inside template 13.
- Which listmonk list new subscribers join, and which list id is the suppressed list.
- Whether the lead email should also be copied to `bondi@`. listmonk `/api/tx` has no CC. `extra_recipient` stays empty. If it is set, that address is a second send with its own dedupe key, still allowlisted.
- Whether a ClassPass registration should also receive the lead welcome. Automation 1 only skips when a purchase or contract already exists.
- Whether "bought anything" includes retail that never becomes a client service.
- The 50% off first 4 weeks line is inside template 8. This worker does not change template HTML.
- Template images still point at the listmonk and LoyalSnap CDNs.
- Send time is 09:00 Australia/Sydney. LoyalSnap does not state an hour. Two UTC crons (`0 22 * * *` and `0 23 * * *`) cover AEDT and AEST. The handler runs only when the Sydney hour is 9, so daylight saving does not double-send. 2026 DST ends on 5 April and starts on 4 October. 09:00 exists on both transition days.
- Quiet hours are confirmed as 20:00–09:00 Australia/Sydney, and texts send from the Twilio number. A sender name remains available in Settings if registration is sorted out later.
- Email 6 is exactly one visit and skips memberships. SMS 12 is at least one visit and does not skip memberships, because the LoyalSnap text description did not list those skips.
- SMS 13 is the 2-week pass only, 10 days after expiry, and does not skip memberships.
- A missed exact expiry day is `missed_window` and is not retried, except when a send was already due and then blocked by dev mode, a disabled row, dry run, or quiet hours. That pending job can still send on a later cron.
- Turning a row off pauses in-flight date jobs. It does not delete them. Enabling the row later can still send.
- Repeat intro purchases share one job per automation and client. If several intro services match, the soonest current expiry is used (otherwise the soonest matching expiry).
- Creation date for the day-60 clock is the Mindbody profile creation date, as a Sydney calendar date. The worker does not scan the whole site. It only knows clients who arrived through a webhook or an existing job.
- Intro expiry is assumed to activate with Mindbody's `ExpirationDate`. Confirm that with a real intro service.
- Where this API is hosted, and which origins may call it. There is no CORS layer yet.
- Cut over on the same day LoyalSnap is switched off, or the two systems can both send.

## Additions beyond the LoyalSnap spec

- D1 rows drive every rule. The worker does not branch on automation id. `ensureSeed` inserts missing keys and does not overwrite owner edits.
- Webhook message ids are stored after a successful handle so Mindbody retries do not double-send. A Mindbody or listmonk failure returns 500 and does not store the id.
- Date-based jobs are created even while the row is disabled, so an expiry window is not thrown away.
- Exact-visit emails and texts (4, 8, 11) stay pending while the count is still short, so the morning cron can finish them. Once a send was due and then blocked, a later count above the target can still send.
- Late and early cancellations are excluded from visit counts.
- Dev-mode and quiet-hour skips leave the job pending and remember that the window already matched.
- Global suppression checks D1 `suppressed` and, when listmonk credentials exist, a blocklisted subscriber or the suppressed list id.
- Unsubscribe URL is passed in transactional data. The templates themselves are not edited.
- Other Mindbody site ids are ignored.
- Visit history is capped at 500 rows, 200 per page.
- Settings secrets are encrypted at rest. The test SMS never dials a number that is not allowlisted.
- Session cookie is `bm_automations_session`, not the task dashboard cookie.
