# Black Friday automation — Intro Moments 1–3

**Control plane:** https://bm-automations-dev.plain-bush-daad.workers.dev/automations  
**Lane label:** **Black Friday automation** (first funnel on the page)  
**Repo:** `adminbondi/bm-automations`  
**Deploy:** `./scripts/deploy.sh dev` or merge to `main` (see `docs/dev-deploy.md`). Deploy forces every row **off**.

## What ships

| UI name | D1 key | Listmonk TX | Timing (7-day Intro Pass) |
| --- | --- | --- | --- |
| Moment 1 — Start | `bf-intro-moment-1` | **14** `BF Intro holder - Moment 1 - Start` | Day **0** — `clientSale.created` immediate |
| Moment 2 — Midway | `bf-intro-moment-2` | **15** `BF Intro holder - Moment 2 - Midway` | Day **3** since activation (`delay_days` + Sydney morning cron) |
| Moment 3 — Early Bird Access | `bf-intro-moment-3` | **16** `BF Intro holder - Moment 3 - Early Bird Access` | Day **6** since activation (`delay_days` + Sydney morning cron) |

Defaults assume product **486** Intro Pass is **7 days**. Change Moment 2/3 by editing the row → delay days (stored as `timing_offset_days`). Example: day **4** mid-window, or day **5** if you want earlier Early Bird.

## Safety

- Seeded and migrated with `enabled = 0`.
- `DEV_MODE=true` + `SEND_ALLOWLIST` on `bm-automations-dev`.
- Do **not** enable while LoyalSnap still sends the same Moment to the studio.
- Do **not** also enable LoyalSnap twin `trial-purchased` (template **7**) when Moment 1 is on — double email.
- Contact must already exist in Listmonk (sync dual-write). Automations skip with `subscriber_missing` otherwise.
- No `FULL_REPULL`. No Petra send from this change.

## Where to click (Thiago)

1. Sign in at https://bm-automations-dev.plain-bush-daad.workers.dev/automations  
2. Open **Black Friday automation**.  
3. Toggle **Moment 1 — Start** / **Moment 2 — Midway** / **Moment 3 — Early Bird Access** one at a time.  
4. Confirm template id and day offset on each edit page.  
5. Prove on allowlist → turn that Moment off in LoyalSnap → then widen.

`mb-task-dashboard` is ops/task-log only — not the Moments control plane.
