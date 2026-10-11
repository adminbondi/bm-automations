-- Red flag, under 3 credits. Disabled. Remaining comes from the booking or visit payload.

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  72,
  'red-flag-under-3-credits',
  'Red flag, under 3 credits',
  'email',
  NULL,
  NULL,
  '["classRosterBooking.created","classRosterBookingStatus.updated"]',
  '[]',
  'immediate',
  NULL,
  '{"maxRemaining":2}',
  '{"skipIfAlreadySent":true}',
  0,
  NULL,
  'Off. Thiago: red flag, low member usage is credits, not days. Fires when the pack has fewer than 3 credits (maxRemaining 2). The booking or visit payload remaining count is enough, so this row does not call Mindbody. No listmonk template until an owner sets one. Enabling it before that holds the job with template_missing.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);
