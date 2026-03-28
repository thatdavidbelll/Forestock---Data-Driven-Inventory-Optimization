CREATE TABLE user_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    invite_token VARCHAR(255) NOT NULL,
    invited_by VARCHAR(100),
    expires_at TIMESTAMP NOT NULL,
    accepted_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_user_invites_token ON user_invites(invite_token);
CREATE INDEX idx_user_invites_store_created ON user_invites(store_id, created_at DESC);
