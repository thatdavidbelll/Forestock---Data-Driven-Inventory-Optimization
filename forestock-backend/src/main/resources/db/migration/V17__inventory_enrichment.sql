ALTER TABLE inventory
    ADD COLUMN adjustment_reason VARCHAR(50),
    ADD COLUMN adjustment_note   VARCHAR(255),
    ADD COLUMN adjusted_by       VARCHAR(100);
