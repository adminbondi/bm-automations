-- Generated from src/automations/seed.ts. Do not edit by hand.

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  1,
  'lead-immediate',
  'Lead: Leads followup - immediate',
  'email',
  5,
  NULL,
  '["client.created"]',
  '[]',
  'immediate',
  NULL,
  '{}',
  '{"skipIfAlreadySent":true,"skipIfHasIntroOrAnyPurchase":true}',
  0,
  NULL,
  'Open question: LoyalSnap CCs bondi@. listmonk /api/tx has no CC. Leave extra_recipient empty until owners decide whether to send a separate copy.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  2,
  'lead-day-60',
  'Lead: Leads followup - day 60',
  'email',
  6,
  NULL,
  '["cron"]',
  '["client.created"]',
  'delay_days',
  60,
  '{"visitCountMode":"signed_in","includeClassPassVisits":true}',
  '{"skipIfAlreadySent":true,"skipIfHasVisited":true,"skipIfHasAnyPurchase":true,"skipIfUnsubscribed":true,"visitCountScope":"all"}',
  0,
  NULL,
  'Scheduled from client.created. The Sydney morning cron rechecks visits, purchases, and suppression before sending.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  3,
  'trial-purchased',
  'Trial: New client redeemed or purchased their Trial',
  'email',
  7,
  NULL,
  '["clientSale.created"]',
  '[]',
  'immediate',
  NULL,
  '{"packageNameIncludes":["2 week","2-week","7 day","7-day","intro pass"]}',
  '{"skipIfAlreadySent":true}',
  0,
  NULL,
  'Intro pass names are unconfirmed. packageNameIncludes is a contains-match for the spec best values: 2-week and 7-day Intro Pass.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  4,
  'trial-third-class',
  'Trial: Client took their 3rd class on their Trial',
  'email',
  8,
  NULL,
  '["classRosterBookingStatus.updated"]',
  '[]',
  'immediate',
  NULL,
  '{"packageNameIncludes":["2 week","2-week","7 day","7-day","intro pass"],"signedInStatus":"SignedIn","visitCountMode":"signed_in","includeClassPassVisits":false,"classPassNameIncludes":["classpass","class pass"]}',
  '{"skipIfAlreadySent":true,"skipIfMembership":true,"membershipContractNames":[],"exactVisits":3,"visitCountScope":"intro_pass"}',
  0,
  NULL,
  'Counts signed-in visits whose service name matches the intro pass tokens. ClassPass visits are excluded. membershipContractNames is empty until owners confirm the 11 contracts, so a membership on file is not detected yet. A short count stays pending for the morning cron.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  5,
  'trial-expiring-3-days',
  'Trial: Trial expiring in 3 days',
  'email',
  9,
  NULL,
  '["cron"]',
  '["clientSale.created"]',
  'days_before_expiry',
  3,
  '{"packageNameIncludes":["2 week","2-week","7 day","7-day","intro pass"],"visitCountMode":"signed_in","includeClassPassVisits":false,"classPassNameIncludes":["classpass","class pass"]}',
  '{"skipIfAlreadySent":true,"skipIfMembership":true,"membershipContractNames":[],"minVisits":1,"visitCountScope":"intro_pass","skipIfPassExpired":true,"includeVisitsInData":true}',
  0,
  NULL,
  'Sends on the Sydney day that is exactly 3 days before the intro pass expiry, when visits are at least 1. Template data includes visits for listmonk template 9.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  6,
  'trial-expiring-1-day-one-visit',
  'Trial: Expiring in 1 day, client took only 1 session',
  'email',
  10,
  NULL,
  '["cron"]',
  '["clientSale.created"]',
  'days_before_expiry',
  1,
  '{"packageNameIncludes":["2 week","2-week","7 day","7-day","intro pass"],"visitCountMode":"signed_in","includeClassPassVisits":false,"classPassNameIncludes":["classpass","class pass"]}',
  '{"skipIfAlreadySent":true,"skipIfMembership":true,"membershipContractNames":[],"exactVisits":1,"visitCountScope":"intro_pass","skipIfPassExpired":true}',
  0,
  NULL,
  'Sends on the Sydney day that is exactly 1 day before intro pass expiry, and only when the visit count is exactly 1.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  7,
  'membership-purchase',
  'Member: Membership purchase',
  'email',
  11,
  NULL,
  '["clientContract.created"]',
  '[]',
  'immediate',
  NULL,
  '{"contractNames":[]}',
  '{"skipIfAlreadySent":true}',
  0,
  NULL,
  'LoyalSnap filters to one of 11 contracts; the spec says 11-17 and the exact names were not in the inventory. An empty contractNames list matches nothing, so every contract is skipped until the names are saved on this row.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  8,
  'member-google-review',
  'Member: Google review request (email)',
  'email',
  12,
  NULL,
  '["classRosterBookingStatus.updated"]',
  '[]',
  'immediate',
  NULL,
  '{"signedInStatus":"SignedIn","visitCountMode":"signed_in","includeClassPassVisits":true,"classPassNameIncludes":["classpass","class pass"]}',
  '{"skipIfAlreadySent":true,"exactVisits":3,"visitCountScope":"all"}',
  0,
  NULL,
  'LoyalSnap has no package filter. This is the email, not the text review request. It can fire on the same third visit as the trial offer. A short count stays pending for the morning cron.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  9,
  'classpass-welcome',
  'ClassPass: Welcome',
  'email',
  13,
  NULL,
  '["client.created","classRosterBooking.created"]',
  '[]',
  'immediate',
  NULL,
  '{"packageNameIncludes":["classpass","class pass"]}',
  '{"skipIfAlreadySent":true,"skipIfWaiverSigned":true}',
  0,
  NULL,
  'Matches a ClassPass item on the client or the booking. Skips when Mindbody isLiabilityReleased is already true. Confirm that flag is the KAN-13 waiver. The waiver URL itself stays in listmonk template 13.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  10,
  'trial-day-7-no-booking',
  'Trial: Day 7, no class booked',
  'sms',
  NULL,
  'Hey [First name], we noticed you haven''t booked into your first class at [Studio] yet. Can we help getting you booked in?',
  '["cron"]',
  '["clientSale.created"]',
  'delay_days',
  7,
  '{"packageNameIncludes":["2 week","2-week","7 day","7-day","intro pass"],"visitCountMode":"booked","includeClassPassVisits":true}',
  '{"skipIfAlreadySent":true,"skipIfHasBooking":true,"visitCountScope":"all"}',
  0,
  NULL,
  'LoyalSnap text 561548. Wording copied from the LoyalSnap inventory captured 11 Oct 2026. LoyalSnap sent this as WhatsApp/text; this row sends SMS via Twilio. Skips when any non-cancelled visit, including a future booking, is already on the client. Historical visits in the fetched window also count as booked.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  11,
  'trial-google-review-text',
  'Trial: Google review text',
  'sms',
  NULL,
  'Hi [First name]! Are you loving our classes? As a small business Google reviews help us more than you know. Could you please click here and leave us one? Thank you so much! Thiago & Yvette from Balance Moves https://g.page/r/CfyVtWt5Wc47EBM/review',
  '["classRosterBookingStatus.updated"]',
  '[]',
  'immediate',
  NULL,
  '{"packageNameIncludes":["2 week","2-week","7 day","7-day","intro pass"],"signedInStatus":"SignedIn","visitCountMode":"signed_in","includeClassPassVisits":false,"classPassNameIncludes":["classpass","class pass"]}',
  '{"skipIfAlreadySent":true,"exactVisits":3,"visitCountScope":"intro_pass"}',
  0,
  NULL,
  'LoyalSnap text 561561, Intro Offer Google review. Wording copied from the LoyalSnap inventory. The email review request is automation 8 and has no package filter. This text is limited to intro-pass visits. A short count stays pending for the morning cron. Quiet hours hold the send until the next allowed minute.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  12,
  'trial-expiring-1-day-text',
  'Trial: Expiring in 1 day (text)',
  'sms',
  NULL,
  'Hi [First name], It''s Thiago & Yvette at [Studio] We hope you have enjoyed our classes and love our instructors.

We have a SPECIAL INTRO CLIENT OFFER for you:

https://www.balancemoves.com.au/membership-sign-up',
  '["cron"]',
  '["clientSale.created"]',
  'days_before_expiry',
  1,
  '{"packageNameIncludes":["2 week","2-week","7 day","7-day","intro pass"],"visitCountMode":"signed_in","includeClassPassVisits":false,"classPassNameIncludes":["classpass","class pass"]}',
  '{"skipIfAlreadySent":true,"minVisits":1,"visitCountScope":"intro_pass","skipIfPassExpired":true}',
  0,
  NULL,
  'LoyalSnap text 561552. At least one intro visit, one day before expiry. Unlike email automation 6, this text does not require exactly one visit and does not skip clients who already have a membership. The LoyalSnap description did not list those skips.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  13,
  'trial-followup-10-day',
  'Trial: 10-day follow-up',
  'sms',
  NULL,
  'Hey [First name], it''s [Studio]! We had so much fun during your Intro Pass - we would love to see you back in the studio:

We have a SPECIAL INTRO CLIENT OFFER for you: https://www.balancemoves.com.au/membership-sign-up

Any questions, let me know. Yvette xx',
  '["cron"]',
  '["clientSale.created"]',
  'days_after_expiry',
  10,
  '{"packageNameIncludes":["2 week","2-week"],"visitCountMode":"signed_in","includeClassPassVisits":false,"classPassNameIncludes":["classpass","class pass"]}',
  '{"skipIfAlreadySent":true}',
  0,
  NULL,
  'LoyalSnap text 561559. Ten Sydney days after a 2 Week Trial expires. The 7-day intro is not included. The LoyalSnap description does not skip memberships. Source channel was WhatsApp/text; this row is SMS.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);
