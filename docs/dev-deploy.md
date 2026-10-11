# Dev deploy

A push to `main` publishes the Balance Moves automations Worker to the dev environment. Production resources are not part of this path.

## Why Workers Builds

The git host for this repo is Cursor Origin (`origin.cursor.com`). Cloudflare Workers Builds connects to Origin, and since 22 September 2026 it builds on a push to the configured branch and posts a check run back on the Origin pull request. That is the deploy mechanism.

GitHub Actions in `.github/workflows/ci.yml` does not run on an Origin-hosted repository. Origin does not execute that file, and Workers Builds is the integration that already speaks Origin. The workflow still runs `npm test`, `npm run typecheck`, and `npm run check:dev` for a runner that understands GitHub Actions. It never deploys.

Workers Builds is configured in the Cloudflare dashboard, not in `wrangler.jsonc`. The commands below are what that connection must run, so the test gate lives in git even though the trigger is created in the dashboard.

## One Worker

This repository has one Worker script, `src/index.ts`. It receives Mindbody webhooks, runs the Sydney morning cron, and serves the admin screens (`/automations`, `/log`, `/settings`). PR #1 (`cursor/dev-deploy-env-c9ab`) does not add a second Wrangler project. Its dev target is the Worker `bm-automations-dev` and the D1 database `bm-automations-dev`.

Deploying that script a second time under another name would register the morning cron twice. `mb-task-dashboard` is a different Worker and is not deployed from this repo.

Admin UI and the automation pipeline therefore ship together as `bm-automations-dev`.

## What a main push runs

Workers Builds, production branch `main`, preview builds left off:

| Setting | Value |
| --- | --- |
| Worker | `bm-automations-dev` (tag `5358edd182914047b66f7ddc53c172d9`) |
| Root directory | repository root |
| Build command | `npm run check:dev` |
| Deploy command | `npm run deploy:dev` |
| Non-production branch builds | off |

`npm run deploy:dev` is `./scripts/deploy.sh dev`. In order, that script:

1. Runs `npm test` and `npm run typecheck`. A failing test exits before Wrangler. The suite is the Vitest run in this repo (69 or more tests).
2. Runs `node scripts/check-dev-config.mjs`.
3. Applies D1 migrations to `bm-automations-dev` only, forces every automation `enabled = 0`, and exits if none exist or any remain enabled.
4. Runs `npx wrangler deploy --env dev`.
5. Repeats the automations-off check. If any row is enabled, the build fails.

The build command also runs the allowlist check first. Workers Builds runs the build command, then the deploy command. The deploy script repeats the test suite so a dashboard connection that only sets the deploy command still cannot publish after a failed test.

Leave preview builds off. A preview would publish branch code, and this Worker has no separate preview database.

`./scripts/deploy.sh` without `dev` exits 1. Do not set the deploy command to plain `npx wrangler deploy`. That targets the top-level Worker name `bm-automations`, whose D1 id is still the placeholder `00000000-0000-0000-0000-000000000000`.

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
| `DEFAULT_FROM_EMAIL` | empty | Falls back to the settings row, then the code default | Thiago, if dev should show a from address before Settings is saved |
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

1. Install the Cloudflare app for Cursor Origin: [Cloudflare app](https://cursor.com/codebase/settings/apps/public/cloudflare). Grant it `thiago-yvette-balance-moves/bm-automations` only if the installer can limit repositories.
2. In the Cloudflare dashboard, open Worker `bm-automations-dev`, then **Settings > Builds > Connect**. Choose this Origin repository, branch `main`, build command `npm run check:dev`, deploy command `npm run deploy:dev`. Leave non-production branch builds off.
3. The API token on this agent cannot create Workers Builds triggers (`Authentication error` on `/accounts/.../builds/triggers`). Connecting the app is the step that creates the trigger. Cloudflare can generate the build token. Do not commit it.
4. Thiago sets the secrets in the table above that are not already on the Worker: `npx wrangler secret put <NAME> --env dev`.
5. Thiago adds test mobiles to `scripts/dev-sms-allowlist.txt` and `SMS_ALLOWLIST` when SMS tests should be possible.
6. Add the Google redirect URI on the OAuth client before sign-in will succeed.

Until step 2 is done, a push to `main` does not deploy. The allowlist check and the automations-off script are in the repo and can be run locally with `npm run check:dev` and, when a deploy is intended, `npm run deploy:dev`.
