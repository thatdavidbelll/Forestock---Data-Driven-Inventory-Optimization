ALTER TABLE order_suggestions
    ADD COLUMN acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN acknowledged_at TIMESTAMP;

CREATE INDEX idx_order_suggestions_acknowledged
    ON order_suggestions (store_id, acknowledged);
