ALTER TABLE users
    ADD COLUMN provisioning_source VARCHAR(32) NOT NULL DEFAULT 'DIRECT',
    ADD COLUMN standalone_access_enabled BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN standalone_access_activated_at TIMESTAMP NULL,
    ADD COLUMN standalone_activation_token VARCHAR(255) NULL,
    ADD COLUMN standalone_activation_sent_at TIMESTAMP NULL;

UPDATE users
SET standalone_access_activated_at = COALESCE(standalone_access_activated_at, created_at)
WHERE standalone_access_enabled = true
  AND standalone_access_activated_at IS NULL;

CREATE UNIQUE INDEX idx_users_standalone_activation_token
    ON users (standalone_activation_token)
    WHERE standalone_activation_token IS NOT NULL;
