-- Short names shown in the admin list. Keys stay stable.
UPDATE automations SET name = 'Lead welcome' WHERE key = 'lead-immediate';
UPDATE automations SET name = 'Lead day 60' WHERE key = 'lead-day-60';
UPDATE automations SET name = 'Trial welcome' WHERE key = 'trial-purchased';
UPDATE automations SET name = 'Trial 3rd class' WHERE key = 'trial-third-class';
UPDATE automations SET name = 'Trial expiring 3 days' WHERE key = 'trial-expiring-3-days';
UPDATE automations SET name = 'Trial expiring 1 day (1 visit)' WHERE key = 'trial-expiring-1-day-one-visit';
UPDATE automations SET name = 'Membership welcome' WHERE key = 'membership-purchase';
UPDATE automations SET name = 'Google review (email)' WHERE key = 'member-google-review';
UPDATE automations SET name = 'ClassPass welcome' WHERE key = 'classpass-welcome';
UPDATE automations SET name = 'Trial day 7 – no class booked' WHERE key = 'trial-day-7-no-booking';
UPDATE automations SET name = 'Google review (text)' WHERE key = 'trial-google-review-text';
UPDATE automations SET name = 'Trial expiring 1 day (text)' WHERE key = 'trial-expiring-1-day-text';
UPDATE automations SET name = 'Trial 10-day follow-up (text)' WHERE key = 'trial-followup-10-day';
