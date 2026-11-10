-- Sub-day Delay amounts: milliseconds / seconds / minutes (days stay the default).
ALTER TABLE automations ADD COLUMN timing_offset_unit TEXT NOT NULL DEFAULT 'days';
