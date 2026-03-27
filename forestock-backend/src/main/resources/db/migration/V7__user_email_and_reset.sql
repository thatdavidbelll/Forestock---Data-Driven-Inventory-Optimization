-- V7: Add email, password-reset columns to users
-- Email is optional (nullable) so existing accounts are not affected

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS email                    VARCHAR(255),
    ADD COLUMN IF NOT EXISTS password_reset_token     VARCHAR(255),
    ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_users_email
    ON users (email)
    WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_password_reset_token
    ON users (password_reset_token)
    WHERE password_reset_token IS NOT NULL;
