-- LoyalSnap automations that were off. All rows are disabled.

-- Emails without a listmonk template id stay null and the engine holds them as template_missing.

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  14,
  'lead-day-2-text',
  'Lead day 2 (text)',
  'sms',
  NULL,
  'Hi [First name], it''s Thiago & Yvette from [Studio]! Do you have any questions about getting started on our intro offer?',
  '["cron"]',
  '["client.created"]',
  'delay_days',
  2,
  '{}',
  '{"skipIfAlreadySent":true}',
  0,
  NULL,
  'LoyalSnap text, off. LoyalSnap had this switched off. No listmonk template id was captured, so an email row stays without a template until an owner sets one. Enabling it before that holds the job with template_missing.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  15,
  'lead-day-7-text',
  'Lead day 7 (text)',
  'sms',
  NULL,
  'Hi [First name], really looking forward to connecting about [Studio]! Is AM or PM better for you to chat?',
  '["cron"]',
  '["client.created"]',
  'delay_days',
  7,
  '{}',
  '{"skipIfAlreadySent":true}',
  0,
  NULL,
  'LoyalSnap text, off. LoyalSnap had this switched off. No listmonk template id was captured, so an email row stays without a template until an owner sets one. Enabling it before that holds the job with template_missing.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  16,
  'lead-day-14',
  'Lead day 14',
  'email',
  NULL,
  NULL,
  '["cron"]',
  '["client.created"]',
  'delay_days',
  14,
  '{}',
  '{"skipIfAlreadySent":true}',
  0,
  NULL,
  'Subject: Register NOW for a Complimentary Session. LoyalSnap template Leads followup - day 14-Oxigen. LoyalSnap had this switched off. No listmonk template id was captured, so an email row stays without a template until an owner sets one. Enabling it before that holds the job with template_missing.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  17,
  'lead-day-90',
  'Lead day 90',
  'email',
  NULL,
  NULL,
  '["cron"]',
  '["client.created"]',
  'delay_days',
  90,
  '{}',
  '{"skipIfAlreadySent":true}',
  0,
  NULL,
  'Subject: Is now a better time? LoyalSnap template Leads followup - day 90-Oxigen. LoyalSnap had this switched off. No listmonk template id was captured, so an email row stays without a template until an owner sets one. Enabling it before that holds the job with template_missing.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  18,
  'lead-day-120',
  'Lead day 120',
  'email',
  NULL,
  NULL,
  '["cron"]',
  '["client.created"]',
  'delay_days',
  120,
  '{}',
  '{"skipIfAlreadySent":true}',
  0,
  NULL,
  'LoyalSnap titled this ''every 30 days'' but the description is 120 days after creation, not a loop. Subject: let''s start your fitness journey. LoyalSnap had this switched off. No listmonk template id was captured, so an email row stays without a template until an owner sets one. Enabling it before that holds the job with template_missing.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  19,
  'lead-day-150',
  'Lead day 150',
  'email',
  NULL,
  NULL,
  '["cron"]',
  '["client.created"]',
  'delay_days',
  150,
  '{}',
  '{"skipIfAlreadySent":true}',
  0,
  NULL,
  'LoyalSnap titled this ''every 30 days'' but the description is 150 days after creation, not a loop. LoyalSnap had this switched off. No listmonk template id was captured, so an email row stays without a template until an owner sets one. Enabling it before that holds the job with template_missing.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  20,
  'trial-day-2-no-booking',
  'Trial day 2 – no class booked',
  'sms',
  NULL,
  'Hi [First name], it''s Thiago & Yvette from [Studio]. Happy to help you book into your first class- do you like morning or evening workouts?',
  '["cron"]',
  '["clientSale.created"]',
  'delay_days',
  2,
  '{"packageNameIncludes":["2 week","2-week","7 day","7-day","intro pass"],"visitCountMode":"booked"}',
  '{"skipIfAlreadySent":true,"skipIfHasBooking":true}',
  0,
  NULL,
  'Off LoyalSnap text. Same booking skip as the day-7 text, two days after the intro purchase.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  21,
  'trial-third-visit-text',
  'Trial 3rd visit (text)',
  'sms',
  NULL,
  'Hi [First name], It''sThiago & Yvette at [Studio].',
  '["classRosterBookingStatus.updated"]',
  '[]',
  'immediate',
  NULL,
  '{"packageNameIncludes":[],"signedInStatus":"SignedIn","visitCountMode":"signed_in"}',
  '{"skipIfAlreadySent":true,"exactVisits":3}',
  0,
  NULL,
  'Off LoyalSnap text. The inventory says one of 5 packages and the message is a placeholder. packageNameIncludes is empty, so the row matches nothing until those names are saved. Copy is stored as LoyalSnap had it, including ''It''sThiago'' with no space.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  22,
  'external-immediate',
  'External lead welcome',
  'email',
  NULL,
  NULL,
  '["lead.created"]',
  '[]',
  'immediate',
  NULL,
  '{}',
  '{"skipIfAlreadySent":true}',
  0,
  NULL,
  'Subject: Welcome! LoyalSnap template lead-immediate-external. Posts to POST /webhooks/lead with X-Lead-Token (LEAD_WEBHOOK_SECRET). Nothing in Mindbody emits this event. The row does nothing until a source sends lead.created. Facebook itself is not connected.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  23,
  'external-immediate-text',
  'External lead welcome (text)',
  'sms',
  NULL,
  'Hey [First name], Thanks for checking out [Studio] 💪 I just sent you an email, but I''d love to chat more about your goals. Are you free for a call? Reply STOP and I won''t text again.',
  '["lead.created"]',
  '[]',
  'immediate',
  NULL,
  '{}',
  '{"skipIfAlreadySent":true}',
  0,
  NULL,
  'LoyalSnap text, off. The body already contains Reply STOP, so the footer setting will not add a second line. Posts to POST /webhooks/lead with X-Lead-Token (LEAD_WEBHOOK_SECRET). Nothing in Mindbody emits this event. The row does nothing until a source sends lead.created. Facebook itself is not connected.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  24,
  'external-day-2',
  'External lead day 2',
  'email',
  NULL,
  NULL,
  '["cron"]',
  '["lead.created"]',
  'delay_days',
  2,
  '{}',
  '{"skipIfAlreadySent":true}',
  0,
  NULL,
  'Subject: We can''t wait to meet you! Posts to POST /webhooks/lead with X-Lead-Token (LEAD_WEBHOOK_SECRET). Nothing in Mindbody emits this event. The row does nothing until a source sends lead.created. Facebook itself is not connected.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  25,
  'external-day-5-text',
  'External lead day 5 (text)',
  'sms',
  NULL,
  'Hey [First name], it seems like you are not interested in training with us, but we''d love to help! Reply back to start -[Studio]',
  '["cron"]',
  '["lead.created"]',
  'delay_days',
  5,
  '{}',
  '{"skipIfAlreadySent":true}',
  0,
  NULL,
  'LoyalSnap text, off. Posts to POST /webhooks/lead with X-Lead-Token (LEAD_WEBHOOK_SECRET). Nothing in Mindbody emits this event. The row does nothing until a source sends lead.created. Facebook itself is not connected.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  26,
  'external-day-7-text',
  'External lead day 7 (text)',
  'sms',
  NULL,
  'Hi [First name] 😊 Just checking in again. I''d love to have you workout with us. Would you be interested in a FREE training session?',
  '["cron"]',
  '["lead.created"]',
  'delay_days',
  7,
  '{}',
  '{"skipIfAlreadySent":true}',
  0,
  NULL,
  'LoyalSnap text, off. Posts to POST /webhooks/lead with X-Lead-Token (LEAD_WEBHOOK_SECRET). Nothing in Mindbody emits this event. The row does nothing until a source sends lead.created. Facebook itself is not connected.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  27,
  'external-day-10',
  'External lead day 10',
  'email',
  NULL,
  NULL,
  '["cron"]',
  '["lead.created"]',
  'delay_days',
  10,
  '{}',
  '{"skipIfAlreadySent":true}',
  0,
  NULL,
  'Subject: let''s get you all set. Posts to POST /webhooks/lead with X-Lead-Token (LEAD_WEBHOOK_SECRET). Nothing in Mindbody emits this event. The row does nothing until a source sends lead.created. Facebook itself is not connected.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  28,
  'external-day-10-text',
  'External lead day 10 (text)',
  'sms',
  NULL,
  'Hey [First name], we would love to see you train at [Studio].',
  '["cron"]',
  '["lead.created"]',
  'delay_days',
  10,
  '{}',
  '{"skipIfAlreadySent":true}',
  0,
  NULL,
  'LoyalSnap text, off. Posts to POST /webhooks/lead with X-Lead-Token (LEAD_WEBHOOK_SECRET). Nothing in Mindbody emits this event. The row does nothing until a source sends lead.created. Facebook itself is not connected.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  29,
  'external-day-14',
  'External lead day 14',
  'email',
  NULL,
  NULL,
  '["cron"]',
  '["lead.created"]',
  'delay_days',
  14,
  '{}',
  '{"skipIfAlreadySent":true}',
  0,
  NULL,
  'Subject: Are you ready? We are! Posts to POST /webhooks/lead with X-Lead-Token (LEAD_WEBHOOK_SECRET). Nothing in Mindbody emits this event. The row does nothing until a source sends lead.created. Facebook itself is not connected.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  30,
  'external-day-30-text',
  'External lead day 30 (text)',
  'sms',
  NULL,
  'Hey [First name], it seems like you''re really busy or no longer interested in working out with us. We won''t text you again, but feel free to reach out anytime 😊',
  '["cron"]',
  '["lead.created"]',
  'delay_days',
  30,
  '{}',
  '{"skipIfAlreadySent":true}',
  0,
  NULL,
  'LoyalSnap text, off. Posts to POST /webhooks/lead with X-Lead-Token (LEAD_WEBHOOK_SECRET). Nothing in Mindbody emits this event. The row does nothing until a source sends lead.created. Facebook itself is not connected.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  31,
  'external-day-60',
  'External lead day 60',
  'email',
  NULL,
  NULL,
  '["cron"]',
  '["lead.created"]',
  'delay_days',
  60,
  '{}',
  '{"skipIfAlreadySent":true}',
  0,
  NULL,
  'Subject: keep health and fitness a top priority. Posts to POST /webhooks/lead with X-Lead-Token (LEAD_WEBHOOK_SECRET). Nothing in Mindbody emits this event. The row does nothing until a source sends lead.created. Facebook itself is not connected.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  32,
  'member-referral-7th-text',
  'Referral after 7th visit (text)',
  'sms',
  NULL,
  'Hi [First name], it''s Thiago & Yvette at [Studio]! Working out with a friend is always more fun! All members receive a 10% discount on their membership when they refer a friend and they join. Did you want to know more?',
  '["classRosterBookingStatus.updated"]',
  '[]',
  'immediate',
  NULL,
  '{"signedInStatus":"SignedIn","visitCountMode":"signed_in"}',
  '{"skipIfAlreadySent":true,"exactVisits":7}',
  0,
  NULL,
  'Off LoyalSnap text after the 7th signed-in visit.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  33,
  'member-referral-every-35',
  'Referral every 35 visits',
  'email',
  NULL,
  NULL,
  '["classRosterBookingStatus.updated"]',
  '[]',
  'immediate',
  NULL,
  '{"packageNameIncludes":[],"signedInStatus":"SignedIn","visitCountMode":"signed_in"}',
  '{"skipIfAlreadySent":true,"everyNthVisit":35,"dedupeScope":"visit_milestone"}',
  0,
  NULL,
  'Subject: Bring a friend for free! LoyalSnap limited this to 74 packages. Those names were not in the export, so packageNameIncludes is empty and the row matches nothing until they are saved. Dedupe is per visit milestone (35, 70, …), not once per client.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  34,
  'member-absent-7-text',
  '7 days since last class (text)',
  'sms',
  NULL,
  'Hi [First name]! We haven''t seen you at [Studio] in about a week.  When will we see you back in the studio?',
  '["cron"]',
  '["classRosterBookingStatus.updated"]',
  'days_since_last_visit',
  7,
  '{"visitCountMode":"signed_in","clientActivity":"active"}',
  '{"skipIfAlreadySent":true}',
  0,
  NULL,
  'Off LoyalSnap text for an active client. Active means a contract on file or a current service that has not expired. A newer visit reschedules the job.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  35,
  'anniversary-99',
  '99th class',
  'email',
  NULL,
  NULL,
  '["classRosterBookingStatus.updated"]',
  '[]',
  'immediate',
  NULL,
  '{"signedInStatus":"SignedIn","visitCountMode":"signed_in"}',
  '{"skipIfAlreadySent":true,"exactVisits":99}',
  0,
  NULL,
  'Subject: Congrats on completing your 99th class! listmonk /api/tx cannot CC bondi@balancemoves.com.au. extra_recipient stays empty. A short visit count stays pending for the morning cron.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  36,
  'anniversary-100-text',
  '100th class (text)',
  'sms',
  NULL,
  '[First name], you just took your 100th class with us [Studio] Congratulations! Keep up the hard work! When are you free to pick up your 100 CLUB VEST?',
  '["classRosterBookingStatus.updated"]',
  '[]',
  'immediate',
  NULL,
  '{"signedInStatus":"SignedIn","visitCountMode":"signed_in"}',
  '{"skipIfAlreadySent":true,"exactVisits":100}',
  0,
  NULL,
  'LoyalSnap text. Targeting CC''d bondi@; this row does not. listmonk /api/tx cannot CC bondi@balancemoves.com.au. extra_recipient stays empty. A short visit count stays pending for the morning cron.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  37,
  'anniversary-249',
  '249th class',
  'email',
  NULL,
  NULL,
  '["classRosterBookingStatus.updated"]',
  '[]',
  'immediate',
  NULL,
  '{"signedInStatus":"SignedIn","visitCountMode":"signed_in"}',
  '{"skipIfAlreadySent":true,"exactVisits":249}',
  0,
  NULL,
  'Subject: Congrats on completing your 249th class! listmonk /api/tx cannot CC bondi@balancemoves.com.au. extra_recipient stays empty. A short visit count stays pending for the morning cron.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  38,
  'anniversary-250-text',
  '250th class (text)',
  'sms',
  NULL,
  'CONGRATS [First name], You just took your 250th class with us at [Studio]!! when can you come in to pick up your 250 CLUB VEST and set up your introduction to the ''WALL OF FAME"?',
  '["classRosterBookingStatus.updated"]',
  '[]',
  'immediate',
  NULL,
  '{"signedInStatus":"SignedIn","visitCountMode":"signed_in"}',
  '{"skipIfAlreadySent":true,"exactVisits":250}',
  0,
  NULL,
  'LoyalSnap text. listmonk /api/tx cannot CC bondi@balancemoves.com.au. extra_recipient stays empty. A short visit count stays pending for the morning cron.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  39,
  'anniversary-499',
  '499th class',
  'email',
  NULL,
  NULL,
  '["classRosterBookingStatus.updated"]',
  '[]',
  'immediate',
  NULL,
  '{"signedInStatus":"SignedIn","visitCountMode":"signed_in"}',
  '{"skipIfAlreadySent":true,"exactVisits":499}',
  0,
  NULL,
  'Subject: Congrats on completing your 499th class! listmonk /api/tx cannot CC bondi@balancemoves.com.au. extra_recipient stays empty. A short visit count stays pending for the morning cron.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  40,
  'anniversary-500-text',
  '500th class (text)',
  'sms',
  NULL,
  'WELL DONE [First name], you just took your 500th class with us at [Studio]. There is no stopping you now! When are you free to collect your 500 CLUB VEST and introduction to the 500 CLUB PLAQUE?',
  '["classRosterBookingStatus.updated"]',
  '[]',
  'immediate',
  NULL,
  '{"signedInStatus":"SignedIn","visitCountMode":"signed_in"}',
  '{"skipIfAlreadySent":true,"exactVisits":500}',
  0,
  NULL,
  'LoyalSnap text. listmonk /api/tx cannot CC bondi@balancemoves.com.au. extra_recipient stays empty. A short visit count stays pending for the morning cron.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  41,
  'trial-expired-3-days',
  'Trial expired 3 days',
  'email',
  NULL,
  NULL,
  '["cron"]',
  '["clientSale.created"]',
  'days_after_expiry',
  3,
  '{"packageNameIncludes":["2 week","2-week","7 day","7-day","intro pass"]}',
  '{"skipIfAlreadySent":true}',
  0,
  NULL,
  'Off LoyalSnap email. Subject: have you seen your options for membership? LoyalSnap template path trial-expiring-3days-oxigen is not a listmonk id. Template stays empty.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  42,
  'trial-expired-5-days-text',
  'Trial expired 5 days (text)',
  'sms',
  NULL,
  'Hi [First name], It''sThiago & Yvette at [Studio]. Your Intro Offer with us ran out a few days ago. Can I give you a call to chat about next steps for your fitness journey?',
  '["cron"]',
  '["clientSale.created"]',
  'days_after_expiry',
  5,
  '{"packageNameIncludes":["2 week","2-week","7 day","7-day","intro pass"]}',
  '{"skipIfAlreadySent":true}',
  0,
  NULL,
  'Off LoyalSnap text, 5 days after the intro pass expires.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  43,
  'lapsed-30-days',
  'Lapsed 30 days',
  'email',
  NULL,
  NULL,
  '["cron"]',
  '["classRosterBookingStatus.updated"]',
  'days_since_last_visit',
  30,
  '{"visitCountMode":"signed_in","clientActivity":"inactive"}',
  '{"skipIfAlreadySent":true}',
  0,
  NULL,
  'Subject: get your limited time promo offer! A new signed-in visit moves the pending job to last visit + 30 days. Inactive means no contract and no current unexpired service. Email template is unset.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  44,
  'lapsed-60-days',
  'Lapsed 60 days',
  'email',
  NULL,
  NULL,
  '["cron"]',
  '["classRosterBookingStatus.updated"]',
  'days_since_last_visit',
  60,
  '{"visitCountMode":"signed_in","clientActivity":"inactive"}',
  '{"skipIfAlreadySent":true}',
  0,
  NULL,
  'Subject: here''s an exclusive offer for you. A new signed-in visit moves the pending job to last visit + 60 days. Inactive means no contract and no current unexpired service. Email template is unset.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  45,
  'lapsed-90-days',
  'Lapsed 90 days',
  'email',
  NULL,
  NULL,
  '["cron"]',
  '["classRosterBookingStatus.updated"]',
  'days_since_last_visit',
  90,
  '{"visitCountMode":"signed_in","clientActivity":"inactive"}',
  '{"skipIfAlreadySent":true}',
  0,
  NULL,
  'Subject: get your exclusive offer. A new signed-in visit moves the pending job to last visit + 90 days. Inactive means no contract and no current unexpired service. Email template is unset.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  46,
  'lapsed-180-days',
  'Lapsed 180 days',
  'email',
  NULL,
  NULL,
  '["cron"]',
  '["classRosterBookingStatus.updated"]',
  'days_since_last_visit',
  180,
  '{"visitCountMode":"signed_in","clientActivity":"inactive"}',
  '{"skipIfAlreadySent":true}',
  0,
  NULL,
  'Subject: our best offer ever. LoyalSnap template 180-days-ormore-absent-oxigen. A new signed-in visit moves the pending job to last visit + 180 days. Inactive means no contract and no current unexpired service. Email template is unset.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  47,
  'lapsed-210-days',
  'Lapsed 210 days',
  'email',
  NULL,
  NULL,
  '["cron"]',
  '["classRosterBookingStatus.updated"]',
  'days_since_last_visit',
  210,
  '{"visitCountMode":"signed_in","clientActivity":"inactive"}',
  '{"skipIfAlreadySent":true}',
  0,
  NULL,
  'Same LoyalSnap title as the 180-day row. Description is 210 days. No template was captured. A new signed-in visit moves the pending job to last visit + 210 days. Inactive means no contract and no current unexpired service. Email template is unset.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  48,
  'lapsed-240-days',
  'Lapsed 240 days',
  'email',
  NULL,
  NULL,
  '["cron"]',
  '["classRosterBookingStatus.updated"]',
  'days_since_last_visit',
  240,
  '{"visitCountMode":"signed_in","clientActivity":"inactive"}',
  '{"skipIfAlreadySent":true}',
  0,
  NULL,
  'Description is 240 days since the last visit. No template was captured. A new signed-in visit moves the pending job to last visit + 240 days. Inactive means no contract and no current unexpired service. Email template is unset.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  49,
  'lapsed-270-days',
  'Lapsed 270 days',
  'email',
  NULL,
  NULL,
  '["cron"]',
  '["classRosterBookingStatus.updated"]',
  'days_since_last_visit',
  270,
  '{"visitCountMode":"signed_in","clientActivity":"inactive"}',
  '{"skipIfAlreadySent":true}',
  0,
  NULL,
  'Description is 270 days since the last visit. No template was captured. A new signed-in visit moves the pending job to last visit + 270 days. Inactive means no contract and no current unexpired service. Email template is unset.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  50,
  'lapsed-300-days',
  'Lapsed 300 days',
  'email',
  NULL,
  NULL,
  '["cron"]',
  '["classRosterBookingStatus.updated"]',
  'days_since_last_visit',
  300,
  '{"visitCountMode":"signed_in","clientActivity":"inactive"}',
  '{"skipIfAlreadySent":true}',
  0,
  NULL,
  'Description is 300 days since the last visit. No template was captured. A new signed-in visit moves the pending job to last visit + 300 days. Inactive means no contract and no current unexpired service. Email template is unset.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  51,
  'lapsed-330-days',
  'Lapsed 330 days',
  'email',
  NULL,
  NULL,
  '["cron"]',
  '["classRosterBookingStatus.updated"]',
  'days_since_last_visit',
  330,
  '{"visitCountMode":"signed_in","clientActivity":"inactive"}',
  '{"skipIfAlreadySent":true}',
  0,
  NULL,
  'Description is 330 days since the last visit. No template was captured. A new signed-in visit moves the pending job to last visit + 330 days. Inactive means no contract and no current unexpired service. Email template is unset.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  52,
  'lapsed-360-days',
  'Lapsed 360 days',
  'email',
  NULL,
  NULL,
  '["cron"]',
  '["classRosterBookingStatus.updated"]',
  'days_since_last_visit',
  360,
  '{"visitCountMode":"signed_in","clientActivity":"inactive"}',
  '{"skipIfAlreadySent":true}',
  0,
  NULL,
  'Description is 360 days since the last visit. No template was captured. A new signed-in visit moves the pending job to last visit + 360 days. Inactive means no contract and no current unexpired service. Email template is unset.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  53,
  'unused-lead-immediate-text',
  'Lead welcome (text)',
  'sms',
  NULL,
  'Hi [First name], it''s Thiago & Yvette at [Studio]! We''re looking forward to seeing you in the studio. Do you have any questions about getting started?',
  '["client.created"]',
  '[]',
  'immediate',
  NULL,
  '{}',
  '{"skipIfAlreadySent":true}',
  0,
  NULL,
  'Unused funnel. Off. Same moment as the lead welcome email, as a text.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  54,
  'unused-trial-purchased-text',
  'Trial welcome (text)',
  'sms',
  NULL,
  'Hi [First name], it''s Thiago & Yvette at [Studio] here. We''re so excited to see you in the studio. Have you booked your first class yet?',
  '["clientSale.created"]',
  '[]',
  'immediate',
  NULL,
  '{"packageNameIncludes":["2 week","2-week","7 day","7-day","intro pass"]}',
  '{"skipIfAlreadySent":true}',
  0,
  NULL,
  'Unused funnel. Off text after an intro purchase.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  55,
  'unused-first-class-text',
  'First class (text)',
  'sms',
  NULL,
  'Hey [First name], it''s Thiago & Yvette. Congrats on taking your first class with us at [Studio]! How do you feel?',
  '["classRosterBookingStatus.updated"]',
  '[]',
  'immediate',
  NULL,
  '{"signedInStatus":"SignedIn","visitCountMode":"signed_in"}',
  '{"skipIfAlreadySent":true,"exactVisits":1}',
  0,
  NULL,
  'Unused funnel. Off text after the first signed-in visit.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  56,
  'unused-trial-just-expired',
  'Trial just expired',
  'email',
  NULL,
  NULL,
  '["cron"]',
  '["clientSale.created"]',
  'days_after_expiry',
  0,
  '{"packageNameIncludes":["2 week","2-week","7 day","7-day","intro pass"],"visitCountMode":"signed_in","includeClassPassVisits":false,"classPassNameIncludes":["classpass","class pass"]}',
  '{"skipIfAlreadySent":true,"minVisits":1,"visitCountScope":"intro_pass"}',
  0,
  NULL,
  'Unused funnel. Subject: your Intro Pass has ended. Sends on the Sydney expiry day when the intro visit count is at least 1. Template id is unset.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  57,
  'pack-welcome',
  'Class pack welcome',
  'email',
  NULL,
  NULL,
  '["clientSale.created"]',
  '[]',
  'immediate',
  NULL,
  '{"packageNameIncludes":[]}',
  '{"skipIfAlreadySent":true}',
  0,
  NULL,
  'Off. Subject: Thanks for purchasing your Class Package. LoyalSnap named 6 packages; the names were not in the export. Empty packageNameIncludes matches nothing until they are saved.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  58,
  'pack-expiring-3-days',
  'Class pack expiring in 3 days',
  'email',
  NULL,
  NULL,
  '["cron"]',
  '["clientSale.created"]',
  'days_before_expiry',
  3,
  '{"packageNameIncludes":[],"visitCountMode":"signed_in"}',
  '{"skipIfAlreadySent":true,"minVisits":1}',
  0,
  NULL,
  'Off. Subject: Your pack is about to expire. Package names unset, so it matches nothing yet. At least 1 visit.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  59,
  'pack-two-remaining',
  'Pack with 2 classes remaining',
  'email',
  NULL,
  NULL,
  '["classRosterBookingStatus.updated"]',
  '[]',
  'immediate',
  NULL,
  '{"packageNameIncludes":[],"signedInStatus":"SignedIn","exactRemaining":2,"visitCountMode":"signed_in"}',
  '{"skipIfAlreadySent":true,"minVisits":1}',
  0,
  NULL,
  'Off. Subject: your pack is almost out. Sends when Mindbody Remaining on the matching current service is 2. Package names unset.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  60,
  'pack-none-remaining',
  'Pack with no classes remaining',
  'email',
  NULL,
  NULL,
  '["classRosterBookingStatus.updated"]',
  '[]',
  'immediate',
  NULL,
  '{"packageNameIncludes":[],"exactRemaining":0}',
  '{"skipIfAlreadySent":true}',
  0,
  NULL,
  'Off. Subject: your Pass is empty. exactRemaining 0. Package names unset.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  61,
  'pack-none-remaining-text',
  'Pack empty (text)',
  'sms',
  NULL,
  'Hi [First name], it looks like you Class Pack just expired at [Studio] - We can''t have you running on empty! Would you like me to set up your account with the same as last time?',
  '["classRosterBookingStatus.updated"]',
  '[]',
  'immediate',
  NULL,
  '{"packageNameIncludes":[],"exactRemaining":0}',
  '{"skipIfAlreadySent":true}',
  0,
  NULL,
  'Off LoyalSnap text when no visits remain. Package names unset, so it matches nothing until they are saved. The LoyalSnap sentence ''you Class Pack'' is stored as written.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  62,
  'pack-expired-5-days',
  'Pack expired 5 days',
  'email',
  NULL,
  NULL,
  '["cron"]',
  '["clientSale.created"]',
  'days_after_expiry',
  5,
  '{"packageNameIncludes":[]}',
  '{"skipIfAlreadySent":true}',
  0,
  NULL,
  'Off. Subject: Your class pack expired 5 days ago. Package names unset.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  63,
  'pack-expired-30-days',
  'Pack expired 1 month',
  'email',
  NULL,
  NULL,
  '["cron"]',
  '["clientSale.created"]',
  'days_after_expiry',
  30,
  '{"packageNameIncludes":[]}',
  '{"skipIfAlreadySent":true}',
  0,
  NULL,
  'Off. LoyalSnap says one month after expiration. This row uses 30 days. Package names unset. Subject: How was it?',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  64,
  'classpass-first-class',
  'ClassPass after first class',
  'email',
  NULL,
  NULL,
  '["classRosterBookingStatus.updated"]',
  '[]',
  'immediate',
  NULL,
  '{"packageNameIncludes":["classpass","class pass"],"signedInStatus":"SignedIn","visitCountMode":"signed_in"}',
  '{"skipIfAlreadySent":true,"exactVisits":1,"visitCountScope":"matching_package"}',
  0,
  NULL,
  'LoyalSnap id 570473, off. Subject: How do you feel after your first class? Template id is unset.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  65,
  'classpass-5-classes',
  'ClassPass 5 classes',
  'email',
  NULL,
  NULL,
  '["classRosterBookingStatus.updated"]',
  '[]',
  'immediate',
  NULL,
  '{"packageNameIncludes":["classpass","class pass"],"signedInStatus":"SignedIn","visitCountMode":"signed_in"}',
  '{"skipIfAlreadySent":true,"exactVisits":5,"visitCountScope":"matching_package"}',
  0,
  NULL,
  'LoyalSnap id 570474, off. Subject: We love having you at Balance Moves!',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  66,
  'classpass-two-in-two-weeks',
  'ClassPass 2+ classes in 2 weeks',
  'email',
  NULL,
  NULL,
  '["classRosterBookingStatus.updated"]',
  '[]',
  'immediate',
  NULL,
  '{"packageNameIncludes":["classpass","class pass"],"signedInStatus":"SignedIn","visitCountMode":"signed_in"}',
  '{"skipIfAlreadySent":true,"visitWindowDays":14,"minVisitsInWindow":2,"maxVisitsInWindow":999,"visitCountScope":"matching_package"}',
  0,
  NULL,
  'LoyalSnap id 570476, off. Subject: Would you like a friend on the reformer next to you? Counts ClassPass visits whose start date is within the last 14 days.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  67,
  'classpass-10-classes',
  'ClassPass 10 classes',
  'email',
  NULL,
  NULL,
  '["classRosterBookingStatus.updated"]',
  '[]',
  'immediate',
  NULL,
  '{"packageNameIncludes":["classpass","class pass"],"signedInStatus":"SignedIn","visitCountMode":"signed_in"}',
  '{"skipIfAlreadySent":true,"exactVisits":10,"visitCountScope":"matching_package"}',
  0,
  NULL,
  'LoyalSnap id 570475, off. Referral after the 10th ClassPass visit. Subject: Who do you want to see on the reformer next to you?',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  68,
  'birthday-month-text',
  'Birthday month (text)',
  'sms',
  NULL,
  'Hey [First name]! Your birthday will be here before you know it. We''d love to celebrate with you in person if you''ll be around. Let us know so we can get you booked 🎁!',
  '["cron"]',
  '["client.created","clientSale.created","clientContract.created","classRosterBooking.created","classRosterBookingStatus.updated","lead.created"]',
  'birthday_month_start',
  0,
  '{}',
  '{"skipIfAlreadySent":true,"dedupeScope":"calendar_year","repeat":"yearly"}',
  0,
  NULL,
  'Off. The LoyalSnap description says ''on their birthday'' but the template is text-1st-day-birthday-month and the copy talks about the birthday still coming. This row sends on the 1st of the birth month. Mindbody BirthDate is stored from the client profile. The job is created the next time we see the client, then repeats each year.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  69,
  'birthday-month-email',
  'Birthday month (email)',
  'email',
  NULL,
  NULL,
  '["cron"]',
  '["client.created","clientSale.created","clientContract.created","classRosterBooking.created","classRosterBookingStatus.updated","lead.created"]',
  'birthday_month_start',
  0,
  '{}',
  '{"skipIfAlreadySent":true,"dedupeScope":"calendar_year","repeat":"yearly"}',
  0,
  NULL,
  'Off. Subject: Happy Birthday! LoyalSnap had no template body (it showed Loading email). Template id stays empty. Sends on the 1st of the birth month.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  70,
  'birthday-day-text',
  'Birthday (text)',
  'sms',
  NULL,
  'Hey [First name]! Word on the street is it''s your birthday 👀. Happy birthday from everyone at [Studio]. Hope you have an amazing day!',
  '["cron"]',
  '["client.created","clientSale.created","clientContract.created","classRosterBooking.created","classRosterBookingStatus.updated","lead.created"]',
  'birthday_day',
  0,
  '{}',
  '{"skipIfAlreadySent":true,"dedupeScope":"calendar_year","repeat":"yearly"}',
  0,
  NULL,
  'Off LoyalSnap text on the birth date. 29 February uses 28 February in a non-leap year.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);

INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (
  71,
  'birthday-day-email',
  'Birthday (email)',
  'email',
  NULL,
  NULL,
  '["cron"]',
  '["client.created","clientSale.created","clientContract.created","classRosterBooking.created","classRosterBookingStatus.updated","lead.created"]',
  'birthday_day',
  0,
  '{}',
  '{"skipIfAlreadySent":true,"dedupeScope":"calendar_year","repeat":"yearly"}',
  0,
  NULL,
  'Off. Subject: Happy Birthday, first name. Template id is unset. Same birthday_day timing as the text.',
  '2026-10-11T00:00:00.000Z',
  '2026-10-11T00:00:00.000Z'
);
