# bm-alerts

Posts failure alerts to the Balance Moves Slack channel `#bm-alerts` (`C0CABUPL2BW`). Successful runs are ignored.

| Environment | Worker | Queue |
| --- | --- | --- |
| preview | `bm-alerts-preview` | `bm-alerts-preview` |
| prod | `bm-alerts` | `bm-alerts` |

Cloudflare account `a1e049769abbd70837e055ac5a0f9c7b`. CI and `scripts/deploy-preview.mjs` deploy **preview only**. Prod is not deployed from this repo's workflows.

The top-level Wrangler name is `bm-alerts-preview`, so a bare `wrangler deploy` publishes preview rather than prod. The supported commands are `wrangler deploy --env preview` and, after the owner approves, `wrangler deploy --env prod`.

## What gets posted

Plain text, one message per failure.

1. **GitHub Actions.** `POST /webhooks/github` accepts `workflow_run` events whose action is `completed` and whose conclusion is `failure`, `cancelled`, or `timed_out`. The body is checked against `X-Hub-Signature-256` (HMAC SHA-256 of the raw body). The message names the repo, workflow, branch, commit message, who triggered the run, and the run link.
2. **Workers Builds.** The preview queue consumes `build.failed` and `build.canceled` only. The message names the worker, branch, commit, author, and error, plus a dashboard link. Started and succeeded builds are acked and not posted.
3. **Workflow instances.** The same queue consumes `instance.errored` only. Completed, queued, and started instances are ignored.

`GET /` answers `{worker name} is up. It posts failures only.` It does not call Slack.

## Secrets

Worker secrets (never commit the values):

| Name | Purpose |
| --- | --- |
| `SLACK_BOT_TOKEN` | Bot `bm-forms-notify`. Needs `chat:write`, and the bot must be in `#bm-alerts`. |
| `GITHUB_WEBHOOK_SECRET` | Shared HMAC secret for the GitHub webhook. |

```bash
cd alerts
printf '%s' "$SLACK_BOT_TOKEN" | npx wrangler secret put SLACK_BOT_TOKEN --env preview
printf '%s' "$GITHUB_WEBHOOK_SECRET" | npx wrangler secret put GITHUB_WEBHOOK_SECRET --env preview
```

`scripts/deploy-preview.mjs` sets those two when the same names are present in the environment, and skips them when they are absent. It does not print the values. Wrangler will not create a Worker that lists `secrets.required` until every name has a value. If this is the first deploy and those values are not in the environment, the script creates the Worker with a random stand-in for each missing name, deletes the temp file, and does not record the stand-in. Replace the stand-in with `wrangler secret put` before expecting a real alert. Later deploys keep the secrets already on the Worker.

Optional, not required for the worker to boot: `CLOUDFLARE_API_TOKEN` on the worker, with **Workers Builds Configuration: Read**. Workers Builds events do not include the log line. When this read token is set, a failed build alert quotes the first error line from the build log (same idea as the [Workers Builds notifications template](https://github.com/cloudflare/templates/tree/main/workers-builds-notifications-template)). Without it, the alert says the event did not include an error line and links to the build. Do not reuse the deploy token for this. The deploy script does not copy it onto the worker.

GitHub Actions deploy uses the same names as `.github/workflows/deploy-dev.yml`:

| Name | Purpose |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Deploy the worker, create the queue, create event subscriptions. Needs Workers Scripts Edit and Queues Edit. |
| `CLOUDFLARE_ACCOUNT_ID` | Optional. Wrangler also reads the account id in `wrangler.jsonc`. |

## Preview deploy

```bash
cd alerts
npm ci
npm test
node scripts/deploy-preview.mjs
```

The script:

1. Refuses any `prod` argument.
2. Creates queue `bm-alerts-preview` with a 24 hour retention (the Workers Free maximum).
3. Runs `wrangler deploy --env preview`.
4. Subscribes **each current Worker script** to `build.failed,build.canceled`. The event source `workersBuilds.worker` requires a worker name, so this is one subscription per script, not one account-wide hook. No script in this account uses Workers Builds today, so these subscriptions stay quiet until one does. Re-run the script after a new Worker is added.
5. Subscribes each Workflow whose name does not end in `-test` to `instance.errored`.

`.github/workflows/deploy-alerts-preview.yml` runs that script on pull requests that touch `alerts/`, on pushes to `main`, and via `workflow_dispatch`. It never deploys prod.

Free tier: Queues includes 10,000 operations a day. Subscriptions are failure events only, so successful builds do not enter the queue. Workers Free is 100,000 requests a day.

## Register the GitHub webhook

After preview is deployed, point GitHub at the webhook URL. The current preview origin is `https://bm-alerts-preview.plain-bush-daad.workers.dev` (same account subdomain as `bm-automations-dev`). The path is `/webhooks/github`.

The script is a dry-run until `--apply`. It never prints the secret.

Org webhook (one hook, every `adminbondi` repository). The token needs `admin:org_hook`:

```bash
cd alerts
export GITHUB_WEBHOOK_SECRET="..."   # same value as the Worker secret
export WEBHOOK_URL="https://bm-alerts-preview.<subdomain>.workers.dev"
node scripts/register-github-webhook.mjs --mode org --org adminbondi
node scripts/register-github-webhook.mjs --mode org --org adminbondi --apply
```

If the org token cannot manage hooks, register one webhook on each repository that has Actions workflows. Each repository needs admin:

```bash
node scripts/register-github-webhook.mjs --mode repos --org adminbondi
node scripts/register-github-webhook.mjs --mode repos --org adminbondi --apply
```

The hook sends only `workflow_run`, as JSON, over HTTPS. Ping and successful runs get HTTP 200 and no Slack message. A bad signature gets HTTP 401. A failed Slack post gets HTTP 502 so GitHub retries.

Invite `bm-forms-notify` to `#bm-alerts` before expecting a message. `not_in_channel` means the bot is not in the channel.

## Runtime exceptions are deferred

A Tail Worker would see uncaught exceptions, but it is invoked for **every** producer request, including successes. That spends Workers Free requests even when nothing is posted, and every producer Worker has to set `tail_consumers` to `bm-alerts-preview` (and later `bm-alerts`). Those producers are not all in this repo. Wiring that up is not a small, free, low-noise change, so this worker does not install a tail handler.

Workflow failures are not deferred. `instance.errored` is delivered only when an instance errors, on the same free-tier queue. A cron that listed instances would need a Cloudflare API token on the worker and would run when nothing had failed. The event subscription replaces that cron.

The Workflow event payload does not include the error text. The Slack message says so unless the payload grows an `error` field later.

## Prod

Do not deploy prod from this change. After Thiago approves and Pedro deploys `npx wrangler deploy --env prod` from `alerts/`:

1. Put the same two Worker secrets with `--env prod`.
2. Create queue `bm-alerts` (24 hour retention) and move the event subscriptions onto it. Delete the preview subscriptions, or each failure will post twice.
3. Point the GitHub webhook at the `bm-alerts` workers.dev URL.

## bm-short-links

The GitHub Actions run `Deploy preview Worker` on `adminbondi/bm-short-links` failed because that repository's `CLOUDFLARE_API_TOKEN` secret is missing. This folder does not read or change that repository or its secrets. Once the webhook is registered, a repeat of that failure posts to `#bm-alerts`.
