CREATE TABLE IF NOT EXISTS client_resource_cache (
  client_id TEXT NOT NULL,
  resource TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  PRIMARY KEY (client_id, resource)
);

CREATE TABLE IF NOT EXISTS mindbody_call_counts (
  caller TEXT NOT NULL,
  month TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  alerted INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (caller, month)
);

CREATE TABLE IF NOT EXISTS mindbody_staff_token (
  caller TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
