-- Webhook event log. Rows store ids and outcomes only: no raw body, email, phone, or message text.

CREATE TABLE IF NOT EXISTS event_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id TEXT NOT NULL UNIQUE,
  event_id TEXT NOT NULL,
  client_id TEXT,
  site_id TEXT,
  occurred_at TEXT,
  received_at TEXT NOT NULL,
  ignored_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_event_log_received_at ON event_log (received_at);

CREATE TABLE IF NOT EXISTS event_log_matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_log_id INTEGER NOT NULL REFERENCES event_log (id) ON DELETE CASCADE,
  automation_id INTEGER NOT NULL,
  automation_key TEXT NOT NULL,
  phase TEXT NOT NULL,
  outcome TEXT NOT NULL,
  reason TEXT,
  would_send INTEGER NOT NULL CHECK (would_send IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_event_log_matches_event_log_id ON event_log_matches (event_log_id);
