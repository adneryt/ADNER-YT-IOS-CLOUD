-- ADNER YT IOS V3
-- Solo almacena claves cifradas.
-- No modifica licencias existentes.

CREATE TABLE IF NOT EXISTS license_key_vault (
    license_id TEXT PRIMARY KEY NOT NULL,
    ciphertext BLOB NOT NULL,
    nonce BLOB NOT NULL,
    key_version INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (license_id)
        REFERENCES licenses(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_license_key_vault_created
ON license_key_vault(created_at);