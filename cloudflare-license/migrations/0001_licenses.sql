CREATE TABLE IF NOT EXISTS licenses (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  duration_seconds INTEGER NOT NULL,
  start_mode TEXT NOT NULL
    CHECK (start_mode IN ('creation','activation')),
  activated_at INTEGER,
  expires_at INTEGER,
  max_devices INTEGER NOT NULL DEFAULT 1
    CHECK (max_devices >= 0),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','paused','revoked')),
  paused_at INTEGER
);

CREATE TABLE IF NOT EXISTS license_devices (
  license_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  public_key TEXT NOT NULL,
  activated_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  PRIMARY KEY (license_id, device_id),
  FOREIGN KEY (license_id) REFERENCES licenses(id)
);

CREATE TABLE IF NOT EXISTS license_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  license_id TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  details TEXT,
  FOREIGN KEY (license_id) REFERENCES licenses(id)
);

CREATE INDEX IF NOT EXISTS idx_license_expiry
ON licenses(expires_at);

CREATE INDEX IF NOT EXISTS idx_history_license
ON license_history(license_id, created_at);