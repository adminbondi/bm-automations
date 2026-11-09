-- Black Friday automation: BF Intro Moments 1–3 (Listmonk TX 14 / 15 / 16).
-- Days since Intro Pass activation on a 7-day pass: day 0 / 3 / 6.
-- All rows stay disabled. Does not enable any LoyalSnap twin.

UPDATE funnels SET position = position + 1;

INSERT OR IGNORE INTO funnels (name, position, description, expanded) VALUES (
  'Black Friday automation',
  1,
  'BF Intro Moments 1–3 for the 7-day Intro Pass (product 486). Listmonk TX templates 14 / 15 / 16. Offsets are days since activation — edit the row’s delay days in the UI if you want day 4 instead of 3, or last day instead of 6.',
  1
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  73,
  'bf-intro-moment-1',
  'Moment 1 — Start',
  'email',
  14,
  NULL,
  '["clientSale.created"]',
  '[]',
  'immediate',
  NULL,
  '{"packageNameIncludes":["2 week","2-week","7 day","7-day","intro pass"]}',
  '{"skipIfAlreadySent":true}',
  0,
  NULL,
  'Black Friday automation. Listmonk TX template 14 (BF Intro holder - Moment 1 - Start). Day 0 = Intro Pass purchase / activation (7-day product 486). Leave off until LoyalSnap’s matching Moment is cut over. Do not also enable trial-purchased (template 7) for the same clients.',
  '2026-11-09T00:00:00.000Z',
  '2026-11-09T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  74,
  'bf-intro-moment-2',
  'Moment 2 — Midway',
  'email',
  15,
  NULL,
  '["cron"]',
  '["clientSale.created"]',
  'delay_days',
  3,
  '{"packageNameIncludes":["2 week","2-week","7 day","7-day","intro pass"]}',
  '{"skipIfAlreadySent":true}',
  0,
  NULL,
  'Black Friday automation. Listmonk TX template 15 (BF Intro holder - Moment 2 - Midway). Default day 3 since Intro Pass activation for a 7-day pass (mid-window). Change timing_offset_days on this row (UI delay days) if you prefer day 4. Sydney morning cron rechecks before send.',
  '2026-11-09T00:00:00.000Z',
  '2026-11-09T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  75,
  'bf-intro-moment-3',
  'Moment 3 — Early Bird Access',
  'email',
  16,
  NULL,
  '["cron"]',
  '["clientSale.created"]',
  'delay_days',
  6,
  '{"packageNameIncludes":["2 week","2-week","7 day","7-day","intro pass"]}',
  '{"skipIfAlreadySent":true}',
  0,
  NULL,
  'Black Friday automation. Listmonk TX template 16 (BF Intro holder - Moment 3 - Early Bird Access). Default day 6 since activation on a 7-day Intro Pass (near end / last full day). Change timing_offset_days if you want expiry-eve instead. Sydney morning cron rechecks before send.',
  '2026-11-09T00:00:00.000Z',
  '2026-11-09T00:00:00.000Z'
);

UPDATE automations SET funnel = 'Black Friday automation', position = 1, timing_label = 'Day 0' WHERE key = 'bf-intro-moment-1';
UPDATE automations SET funnel = 'Black Friday automation', position = 2, timing_label = 'Day 3' WHERE key = 'bf-intro-moment-2';
UPDATE automations SET funnel = 'Black Friday automation', position = 3, timing_label = 'Day 6' WHERE key = 'bf-intro-moment-3';
