ALTER TABLE order_suggestions
    ADD COLUMN low_confidence BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE order_suggestions
    ADD COLUMN history_days_at_generation INTEGER;
