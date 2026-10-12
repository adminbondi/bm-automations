-- LoyalSnap funnel lanes for the admin Automations screen.
-- Assigns funnel, position, and the timing label shown on each step.
-- Does not change the on/off flag.

ALTER TABLE automations ADD COLUMN funnel TEXT;
ALTER TABLE automations ADD COLUMN position INTEGER;
ALTER TABLE automations ADD COLUMN timing_label TEXT;

CREATE TABLE IF NOT EXISTS funnels (
  name TEXT PRIMARY KEY,
  position INTEGER NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  expanded INTEGER NOT NULL DEFAULT 0
);

INSERT INTO funnels (name, position, description, expanded) VALUES ('LEAD FUNNEL', 1, 'Automations for Leads who haven''t yet booked or taken a class', 1);

INSERT INTO funnels (name, position, description, expanded) VALUES ('TRIAL FUNNEL', 2, 'Rules related to clients on a trial / intro offer', 1);

INSERT INTO funnels (name, position, description, expanded) VALUES ('External Leads / Facebook Leads', 3, 'Convert leads into paying clients.', 1);

INSERT INTO funnels (name, position, description, expanded) VALUES ('MEMBER FUNNEL', 4, 'ENGAGEMENT WITH YOUR MEMBERS', 1);

INSERT INTO funnels (name, position, description, expanded) VALUES ('LAPSED CLIENT FUNNEL', 5, 'Follow up with lapsed clients, and bring them back.', 0);

INSERT INTO funnels (name, position, description, expanded) VALUES ('UNUSED FUNNELS', 6, '', 0);

INSERT INTO funnels (name, position, description, expanded) VALUES ('CLASS PACKS FUNNEL', 7, 'Notify valued clients that their packages are running out.', 0);

INSERT INTO funnels (name, position, description, expanded) VALUES ('CLASSPASS', 8, 'Follow-up with clients using ClassPass packages.', 1);

INSERT INTO funnels (name, position, description, expanded) VALUES ('BIRTHDAY', 9, 'Message clients for their birthdays.', 0);

INSERT INTO funnels (name, position, description, expanded) VALUES ('Other', 10, 'Automations that are not in a LoyalSnap funnel.', 1);

UPDATE automations SET funnel = 'LEAD FUNNEL', position = 1, timing_label = 'Day 0' WHERE key = 'lead-immediate';
UPDATE automations SET funnel = 'LEAD FUNNEL', position = 2, timing_label = '+2 days' WHERE key = 'lead-day-2-text';
UPDATE automations SET funnel = 'LEAD FUNNEL', position = 3, timing_label = '+7 days' WHERE key = 'lead-day-7-text';
UPDATE automations SET funnel = 'LEAD FUNNEL', position = 4, timing_label = '+14 days' WHERE key = 'lead-day-14';
UPDATE automations SET funnel = 'LEAD FUNNEL', position = 5, timing_label = '+60 days' WHERE key = 'lead-day-60';
UPDATE automations SET funnel = 'LEAD FUNNEL', position = 6, timing_label = '+90 days' WHERE key = 'lead-day-90';
UPDATE automations SET funnel = 'LEAD FUNNEL', position = 7, timing_label = '+120 days' WHERE key = 'lead-day-120';
UPDATE automations SET funnel = 'LEAD FUNNEL', position = 8, timing_label = '+150 days' WHERE key = 'lead-day-150';
UPDATE automations SET funnel = 'TRIAL FUNNEL', position = 1, timing_label = 'Day 0' WHERE key = 'trial-purchased';
UPDATE automations SET funnel = 'TRIAL FUNNEL', position = 2, timing_label = '+2 days' WHERE key = 'trial-day-2-no-booking';
UPDATE automations SET funnel = 'TRIAL FUNNEL', position = 3, timing_label = '+7 days' WHERE key = 'trial-day-7-no-booking';
UPDATE automations SET funnel = 'TRIAL FUNNEL', position = 4, timing_label = 'Visit 3' WHERE key = 'trial-google-review-text';
UPDATE automations SET funnel = 'TRIAL FUNNEL', position = 5, timing_label = 'Visit 3' WHERE key = 'trial-third-class';
UPDATE automations SET funnel = 'TRIAL FUNNEL', position = 6, timing_label = 'Visit 3' WHERE key = 'trial-third-visit-text';
UPDATE automations SET funnel = 'TRIAL FUNNEL', position = 7, timing_label = 'Expiry −3d' WHERE key = 'trial-expiring-3-days';
UPDATE automations SET funnel = 'TRIAL FUNNEL', position = 8, timing_label = 'Expiry −1d' WHERE key = 'trial-expiring-1-day-one-visit';
UPDATE automations SET funnel = 'TRIAL FUNNEL', position = 9, timing_label = 'Expiry −1d' WHERE key = 'trial-expiring-1-day-text';
UPDATE automations SET funnel = 'TRIAL FUNNEL', position = 10, timing_label = 'Expiry +10d' WHERE key = 'trial-followup-10-day';
UPDATE automations SET funnel = 'External Leads / Facebook Leads', position = 1, timing_label = 'Day 0' WHERE key = 'external-immediate';
UPDATE automations SET funnel = 'External Leads / Facebook Leads', position = 2, timing_label = 'Day 0' WHERE key = 'external-immediate-text';
UPDATE automations SET funnel = 'External Leads / Facebook Leads', position = 3, timing_label = '+2 days' WHERE key = 'external-day-2';
UPDATE automations SET funnel = 'External Leads / Facebook Leads', position = 4, timing_label = '+5 days' WHERE key = 'external-day-5-text';
UPDATE automations SET funnel = 'External Leads / Facebook Leads', position = 5, timing_label = '+7 days' WHERE key = 'external-day-7-text';
UPDATE automations SET funnel = 'External Leads / Facebook Leads', position = 6, timing_label = '+10 days' WHERE key = 'external-day-10';
UPDATE automations SET funnel = 'External Leads / Facebook Leads', position = 7, timing_label = '+10 days' WHERE key = 'external-day-10-text';
UPDATE automations SET funnel = 'External Leads / Facebook Leads', position = 8, timing_label = '+14 days' WHERE key = 'external-day-14';
UPDATE automations SET funnel = 'External Leads / Facebook Leads', position = 9, timing_label = '+30 days' WHERE key = 'external-day-30-text';
UPDATE automations SET funnel = 'External Leads / Facebook Leads', position = 10, timing_label = '+60 days' WHERE key = 'external-day-60';
UPDATE automations SET funnel = 'MEMBER FUNNEL', position = 1, timing_label = 'Day 0' WHERE key = 'membership-purchase';
UPDATE automations SET funnel = 'MEMBER FUNNEL', position = 2, timing_label = 'Visit 3' WHERE key = 'member-google-review';
UPDATE automations SET funnel = 'MEMBER FUNNEL', position = 3, timing_label = 'Visit 7' WHERE key = 'member-referral-7th-text';
UPDATE automations SET funnel = 'MEMBER FUNNEL', position = 4, timing_label = 'Every 35 visits' WHERE key = 'member-referral-every-35';
UPDATE automations SET funnel = 'MEMBER FUNNEL', position = 5, timing_label = '+7d since last visit' WHERE key = 'member-absent-7-text';
UPDATE automations SET funnel = 'MEMBER FUNNEL', position = 6, timing_label = 'Visit 99' WHERE key = 'anniversary-99';
UPDATE automations SET funnel = 'MEMBER FUNNEL', position = 7, timing_label = 'Visit 100' WHERE key = 'anniversary-100-text';
UPDATE automations SET funnel = 'MEMBER FUNNEL', position = 8, timing_label = 'Visit 249' WHERE key = 'anniversary-249';
UPDATE automations SET funnel = 'MEMBER FUNNEL', position = 9, timing_label = 'Visit 250' WHERE key = 'anniversary-250-text';
UPDATE automations SET funnel = 'MEMBER FUNNEL', position = 10, timing_label = 'Visit 499' WHERE key = 'anniversary-499';
UPDATE automations SET funnel = 'MEMBER FUNNEL', position = 11, timing_label = 'Visit 500' WHERE key = 'anniversary-500-text';
UPDATE automations SET funnel = 'LAPSED CLIENT FUNNEL', position = 1, timing_label = 'Expiry +3d' WHERE key = 'trial-expired-3-days';
UPDATE automations SET funnel = 'LAPSED CLIENT FUNNEL', position = 2, timing_label = 'Expiry +5d' WHERE key = 'trial-expired-5-days-text';
UPDATE automations SET funnel = 'LAPSED CLIENT FUNNEL', position = 3, timing_label = '+30d since last visit' WHERE key = 'lapsed-30-days';
UPDATE automations SET funnel = 'LAPSED CLIENT FUNNEL', position = 4, timing_label = '+60d since last visit' WHERE key = 'lapsed-60-days';
UPDATE automations SET funnel = 'LAPSED CLIENT FUNNEL', position = 5, timing_label = '+90d since last visit' WHERE key = 'lapsed-90-days';
UPDATE automations SET funnel = 'LAPSED CLIENT FUNNEL', position = 6, timing_label = '+180d since last visit' WHERE key = 'lapsed-180-days';
UPDATE automations SET funnel = 'LAPSED CLIENT FUNNEL', position = 7, timing_label = '+210d since last visit' WHERE key = 'lapsed-210-days';
UPDATE automations SET funnel = 'LAPSED CLIENT FUNNEL', position = 8, timing_label = '+240d since last visit' WHERE key = 'lapsed-240-days';
UPDATE automations SET funnel = 'LAPSED CLIENT FUNNEL', position = 9, timing_label = '+270d since last visit' WHERE key = 'lapsed-270-days';
UPDATE automations SET funnel = 'LAPSED CLIENT FUNNEL', position = 10, timing_label = '+300d since last visit' WHERE key = 'lapsed-300-days';
UPDATE automations SET funnel = 'LAPSED CLIENT FUNNEL', position = 11, timing_label = '+330d since last visit' WHERE key = 'lapsed-330-days';
UPDATE automations SET funnel = 'LAPSED CLIENT FUNNEL', position = 12, timing_label = '+360d since last visit' WHERE key = 'lapsed-360-days';
UPDATE automations SET funnel = 'UNUSED FUNNELS', position = 1, timing_label = 'Day 0' WHERE key = 'unused-lead-immediate-text';
UPDATE automations SET funnel = 'UNUSED FUNNELS', position = 2, timing_label = 'Day 0' WHERE key = 'unused-trial-purchased-text';
UPDATE automations SET funnel = 'UNUSED FUNNELS', position = 3, timing_label = 'Visit 1' WHERE key = 'unused-first-class-text';
UPDATE automations SET funnel = 'UNUSED FUNNELS', position = 4, timing_label = 'Expiry day' WHERE key = 'unused-trial-just-expired';
UPDATE automations SET funnel = 'CLASS PACKS FUNNEL', position = 1, timing_label = 'Day 0' WHERE key = 'pack-welcome';
UPDATE automations SET funnel = 'CLASS PACKS FUNNEL', position = 2, timing_label = 'Expiry −3d' WHERE key = 'pack-expiring-3-days';
UPDATE automations SET funnel = 'CLASS PACKS FUNNEL', position = 3, timing_label = '2 classes left' WHERE key = 'pack-two-remaining';
UPDATE automations SET funnel = 'CLASS PACKS FUNNEL', position = 4, timing_label = '0 classes left' WHERE key = 'pack-none-remaining';
UPDATE automations SET funnel = 'CLASS PACKS FUNNEL', position = 5, timing_label = '0 classes left' WHERE key = 'pack-none-remaining-text';
UPDATE automations SET funnel = 'CLASS PACKS FUNNEL', position = 6, timing_label = 'Expiry +5d' WHERE key = 'pack-expired-5-days';
UPDATE automations SET funnel = 'CLASS PACKS FUNNEL', position = 7, timing_label = 'Expiry +1 month' WHERE key = 'pack-expired-30-days';
UPDATE automations SET funnel = 'CLASS PACKS FUNNEL', position = 8, timing_label = 'Under 3 credits' WHERE key = 'red-flag-under-3-credits';
UPDATE automations SET funnel = 'CLASSPASS', position = 1, timing_label = 'Day 0' WHERE key = 'classpass-welcome';
UPDATE automations SET funnel = 'CLASSPASS', position = 2, timing_label = 'Visit 1' WHERE key = 'classpass-first-class';
UPDATE automations SET funnel = 'CLASSPASS', position = 3, timing_label = 'Visit 5' WHERE key = 'classpass-5-classes';
UPDATE automations SET funnel = 'CLASSPASS', position = 4, timing_label = '2+ visits / 14d' WHERE key = 'classpass-two-in-two-weeks';
UPDATE automations SET funnel = 'CLASSPASS', position = 5, timing_label = 'Visit 10' WHERE key = 'classpass-10-classes';
UPDATE automations SET funnel = 'BIRTHDAY', position = 1, timing_label = 'Birthday' WHERE key = 'birthday-month-text';
UPDATE automations SET funnel = 'BIRTHDAY', position = 2, timing_label = 'Day 0' WHERE key = 'birthday-month-email';
UPDATE automations SET funnel = 'BIRTHDAY', position = 3, timing_label = 'Birthday' WHERE key = 'birthday-day-text';
UPDATE automations SET funnel = 'BIRTHDAY', position = 4, timing_label = 'Birthday' WHERE key = 'birthday-day-email';
