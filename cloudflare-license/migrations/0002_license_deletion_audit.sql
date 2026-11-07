-- Audit retained separately from the deleted license and its dependent rows.
CREATE TABLE IF NOT EXISTS license_deletion_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  license_id TEXT NOT NULL,
  label TEXT NOT NULL,
  status TEXT NOT NULL,
  deleted_at INTEGER NOT NULL,
  actor TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_license_deletion_audit_date
ON license_deletion_audit(deleted_at);
