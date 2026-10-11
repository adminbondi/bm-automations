CREATE TABLE IF NOT EXISTS automations (
  id INTEGER PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'sms')),
  template_id INTEGER,
  message_text TEXT,
  trigger_events_json TEXT NOT NULL,
  schedule_on_events_json TEXT NOT NULL,
  timing_kind TEXT NOT NULL,
  timing_offset_days INTEGER,
  filters_json TEXT NOT NULL,
  skip_rules_json TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  extra_recipient TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clients_seen (
  client_id TEXT PRIMARY KEY,
  email TEXT,
  phone TEXT,
  first_name TEXT,
  last_name TEXT,
  created_at TEXT NOT NULL,
  first_seen_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scheduled_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  automation_id INTEGER NOT NULL,
  client_id TEXT NOT NULL,
  template_id INTEGER,
  due_on TEXT NOT NULL,
  status TEXT NOT NULL,
  reason TEXT,
  payload_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (automation_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_due ON scheduled_jobs (status, due_on);

CREATE TABLE IF NOT EXISTS send_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dedupe_key TEXT NOT NULL,
  automation_id INTEGER NOT NULL,
  client_id TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email',
  template_id INTEGER,
  email TEXT,
  phone TEXT,
  status TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_send_log_sent_dedupe ON send_log (dedupe_key) WHERE status = 'sent';

CREATE TABLE IF NOT EXISTS suppressed (
  email TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS webhook_events (
  message_id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  received_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  secret INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
