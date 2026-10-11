# Dev deploy

A push to `main` publishes the Balance Moves automations Worker to the dev environment. Production resources are not part of this path.

## Why GitHub Actions

`.github/workflows/deploy-dev.yml` deploys on a push to `main`. Wrangler authenticates with the GitHub Actions secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Do not commit either value.

The job runs, in order:

1. `npm test`
2. `npm run typecheck`
3. `npm run check:dev` (the allowlist check)
4. `node scripts/enforce-dev-off.mjs`
5. `npx wrangler deploy --env dev`
6. `node scripts/enforce-dev-off.mjs`

GitHub Actions skips every later step when one fails, so a failed test, typecheck, or allowlist check does not deploy. The automations-off check runs before and after `wrangler deploy --env dev`.

`.github/workflows/ci.yml` runs the same tests, typecheck, and allowlist check on push and pull request. It does not deploy.

`./scripts/deploy.sh dev` is that same sequence for a manual dev deploy. Any other argument exits 1 and does not call Wrangler.

## One Worker

This repository has one Worker script, `src/index.ts`. It receives Mindbody webhooks, runs the Sydney morning cron, and serves the admin screens (`/automations`, `/log`, `/settings`). PR #1 (`cursor/dev-deploy-env-c9ab`) does not add a second Wrangler project. Its dev target is the Worker `bm-automations-dev` and the D1 database `bm-automations-dev`.

Deploying that script a second time under another name would register the morning cron twice. `mb-task-dashboard` is a different Worker and is not deployed from this repo.

Admin UI and the automation pipeline therefore ship together as `bm-automations-dev`.

## What a main push runs

`.github/workflows/deploy-dev.yml` on branch `main`:

| Step | Command |
| --- | --- |
| Tests | `npm test` |
| Typecheck | `npm run typecheck` |
| Allowlist | `npm run check:dev` |
| Automations off | `node scripts/enforce-dev-off.mjs` |
| Deploy | `npx wrangler deploy --env dev` |
| Automations off again | `node scripts/enforce-dev-off.mjs` |

The Worker is `bm-automations-dev`. The deploy step is not reached when an earlier step fails.

`npm run deploy:dev` is `./scripts/deploy.sh dev`. In order, that script:

1. Runs `npm test` and `npm run typecheck`. A failing test exits before Wrangler. The suite is the Vitest run in this repo (69 or more tests).
2. Runs `node scripts/check-dev-config.mjs`.
3. Applies D1 migrations to `bm-automations-dev` only, forces every automation `enabled = 0`, and exits if none exist or any remain enabled.
4. Runs `npx wrangler deploy --env dev`.
5. Repeats the automations-off check. If any row is enabled, the script fails.

`./scripts/deploy.sh` without `dev` exits 1. Do not run plain `npx wrangler deploy`. That targets the top-level Worker name `bm-automations`, whose D1 id is still the placeholder `00000000-0000-0000-0000-000000000000`.

## Bindings

Wrangler does not inherit `vars`, `d1_databases`, or `secrets` into an environment. `env.dev` repeats them. Triggers are repeated there as well. These are the bindings from PR #1's `wrangler.jsonc`, with the real dev database id filled in.

| Binding | Dev value | Notes |
| --- | --- | --- |
| Worker name | `bm-automations-dev` | `env.dev.name` |
| D1 `DB` | `bm-automations-dev` | id `6b95adf8-010b-4608-b2d2-f3172bd1fb8b` |
| Crons | `0 22 * * *`, `0 23 * * *` | Sydney 09:00 in AEDT and AEST. The handler sends only when the Sydney hour is 9. |
| Account | `a1e049769abbd70837e055ac5a0f9c7b` | Admin@balancemoves.com.au's Account |

No KV, R2, service, or queue bindings. The only remote database this config names, other than the unpublished placeholder, is `bm-automations-dev`. It does not reference `balancemoves-links` or `mb-worker-tasks`.

`scripts/check-dev-config.mjs` fails the build if `env.dev` points at a different database, a different Worker name, or an environment other than `dev`.

## Plain-text variables

These are in `env.dev.vars`. They are not secrets. `wrangler deploy` replaces plain-text vars with this list. Secrets already on the Worker are left in place.

| Name | Value in git | Purpose | Who supplies changes |
| --- | --- | --- | --- |
| `DEV_MODE` | `true` | Sends off the allowlist are logged and skipped. Empty also means on. The check requires the string `true`. | Locked in git |
| `DRY_RUN` | `false` | `true` plans a send and does not call listmonk or Twilio. Allowlisted dev sends are still gated by the allowlists. | Already set |
| `SEND_ALLOWLIST` | `bondi@balancemoves.com.au` | Only this email may be sent in dev. | Locked in git |
| `SMS_ALLOWLIST` | empty | Test handsets. Must match `scripts/dev-sms-allowlist.txt`. Empty means no SMS. | Thiago, by editing both files together |
| `MINDBODY_SITE_ID` | `9853` | Mindbody site. Other site ids are ignored. | Already known |
| `LISTMONK_BASE_URL` | `https://campaigns.balancemoves.com.au` | listmonk origin | Already known |
| `LISTMONK_LIST_ID` | empty | List new subscribers join. This Worker does not write subscribers while `CONTACT_WRITE_MODE` is `shared_sync`. | Thiago, when a list is chosen |
| `LISTMONK_SUPPRESSED_LIST_ID` | empty | Suppressed list id | Thiago, when a list is chosen |
| `SYDNEY_SEND_HOUR` | `9` | Local hour the cron is allowed to send | Already known |
| `ADMIN_EMAILS` | `admin@balancemoves.com.au` | Google sign-in allowlist. This is the value already on the dev Worker. An empty list locks the admin API. | Already known. Add another owner in `env.dev` and keep `admin@balancemoves.com.au`. |
| `DEFAULT_FROM_EMAIL` | `bondi@balancemoves.com.au` | From address on a dev send before Settings is saved. A deploy replaces plain-text vars, so an empty value would clear it. The allowlist check requires this address. | Locked in git |
| `SMS_QUIET_START` | `20:00` | Sydney quiet hours, end exclusive | Already known |
| `SMS_QUIET_END` | `09:00` | 09:00 is allowed | Already known |
| `STUDIO_NAME` | `Balance Moves` | Merge field | Already known |
| `CONTACT_WRITE_MODE` | `shared_sync` | From PR #1. This Worker does not write listmonk subscribers in this mode. `self` writes only while `DEV_MODE` is true and the address is on `SEND_ALLOWLIST`. | Already set by PR #1 |
| `TWILIO_FROM_NUMBER` | empty | Sending number. Settings can store one later. | Thiago |
| `TWILIO_SENDER_NAME` | empty | Unused while sends use the number | Thiago, only if a sender name is registered |

## Secrets

No secret values belong in the repo, in docs, or in `wrangler.jsonc`. Set them with `npx wrangler secret put <NAME> --env dev`. That publishes a new version of `bm-automations-dev` only.

`SESSION_SECRET` and `SETTINGS_ENCRYPTION_KEY` are already present on `bm-automations-dev` (secret text bindings, values not recorded here). The others were not set on that Worker when this document was written. `secrets.required` in `env.dev` warns during local dev when a required name is missing from `.dev.vars`. It does not print the values.

| Name | Worker | Purpose | Who supplies it |
| --- | --- | --- | --- |
| `MINDBODY_API_KEY` | `bm-automations-dev` | Mindbody Public API `Api-Key` | Thiago |
| `MINDBODY_STAFF_USERNAME` | `bm-automations-dev` | Staff user for `usertoken/issue` | Thiago |
| `MINDBODY_STAFF_PASSWORD` | `bm-automations-dev` | Staff password for that token | Thiago |
| `MINDBODY_WEBHOOK_SIGNATURE_KEY` | `bm-automations-dev` | HMAC key Mindbody returns once, when the subscription is created | Thiago. Do not subscribe until dev sends are meant to be exercised. |
| `LISTMONK_API_USER` | `bm-automations-dev` | listmonk `Authorization: token user:token` | Thiago |
| `LISTMONK_API_TOKEN` | `bm-automations-dev` | listmonk API token | Thiago |
| `GOOGLE_CLIENT_ID` | `bm-automations-dev` | Google OAuth, scope `openid email` | Thiago |
| `GOOGLE_CLIENT_SECRET` | `bm-automations-dev` | Google OAuth client secret | Thiago |
| `SESSION_SECRET` | `bm-automations-dev` | HMAC for the `bm_automations_session` cookie | Already on the dev Worker. Thiago supplies a new value only to rotate it. |
| `SETTINGS_ENCRYPTION_KEY` | `bm-automations-dev` | AES-GCM key for settings secrets stored in D1 | Already on the dev Worker. Thiago supplies a new value only to rotate it. Rotating it makes old ciphertext unreadable. |
| `TWILIO_ACCOUNT_SID` | `bm-automations-dev` | Twilio account for `POST /Messages.json` | Thiago |
| `TWILIO_AUTH_TOKEN` | `bm-automations-dev` | Twilio auth token | Thiago |
| `LEAD_WEBHOOK_SECRET` | `bm-automations-dev` | `X-Lead-Token` for `POST /webhooks/lead`. Optional. Unset returns 401. Not in `secrets.required`. | Thiago, when a lead source should call dev |

Copy names into `.dev.vars` for local `wrangler dev`. `.dev.vars` is gitignored. `.dev.vars.example` lists the names with empty values.

Google's redirect URI is `https://bm-automations-dev.plain-bush-daad.workers.dev/auth/google/callback`.

## Allowlist

`scripts/check-dev-config.mjs` reads `env.dev` and fails unless all of these hold:

- `DEV_MODE` is `true`.
- `SEND_ALLOWLIST` contains exactly `bondi@balancemoves.com.au` and no other email.
- `DEFAULT_FROM_EMAIL` is `bondi@balancemoves.com.au`.
- Phone numbers in `SMS_ALLOWLIST` and `SEND_ALLOWLIST` are the same set as `scripts/dev-sms-allowlist.txt`.
- The studio number `+61424133544` is on neither list.
- The D1 binding is `bm-automations-dev` / `6b95adf8-010b-4608-b2d2-f3172bd1fb8b`.

The file is empty on purpose. Dev SMS cannot be sent until Thiago adds each test handset to that file and to `SMS_ALLOWLIST` in the same change. Runtime gating is unchanged: with `DEV_MODE` on, a number that is not on the list is logged and skipped.

## Automations stay off

`scripts/enforce-dev-off.mjs` is the only script that writes to remote D1, and it only writes `bm-automations-dev` after the config check passes.

1. `wrangler d1 migrations apply bm-automations-dev --remote --env dev`
2. `UPDATE automations SET enabled = 0 WHERE enabled != 0`
3. Fail if the table has no rows, or if any `key` still has `enabled != 0`.

The same check runs again after `wrangler deploy --env dev`. A main deploy turns dev automations off, including a row someone enabled in the admin UI for a test.

Migrations in this repo insert with `enabled = 0` and `INSERT OR IGNORE`, so a later migration does not turn an existing row on. The update is still applied on every deploy.

## Manual steps still required

1. Add GitHub Actions repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. The workflow reads those names and no others. Do not commit the token.
2. Give that token **Workers Scripts Edit** and **D1 Edit**. `scripts/enforce-dev-off.mjs` applies migrations and writes `enabled = 0` on `bm-automations-dev`. Without D1 Edit that step fails and the workflow does not run `wrangler deploy --env dev`.
3. Thiago sets the Worker secrets in the table above that are not already on the Worker: `npx wrangler secret put <NAME> --env dev`. Those are Worker secrets, not GitHub Actions secrets.
4. Thiago adds test mobiles to `scripts/dev-sms-allowlist.txt` and `SMS_ALLOWLIST` when SMS tests should be possible.
5. Add the Google redirect URI on the OAuth client before sign-in will succeed.

On 11 October 2026 the dev database already had migrations `0001` through `0004`, 71 automation rows, and `enabled_count` 0. Migrations `0005_mindbody_budget.sql` and `0006_red_flag_credits.sql` were applied to that same database. It now has 72 rows, all with `enabled = 0`. The live Worker still has no cron schedules. The first successful deploy attaches `0 22 * * *` and `0 23 * * *`. With every row off, that cron does not send.

Until the Actions secrets are set and the token can edit D1, a push to `main` fails the automations-off step and does not publish the Worker. The allowlist check can be run locally with `npm run check:dev`. `npm run deploy:dev` is the manual command for the same sequence.
