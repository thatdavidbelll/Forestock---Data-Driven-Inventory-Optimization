ALTER TABLE order_suggestions
    ADD COLUMN acknowledged_reason VARCHAR(255),
    ADD COLUMN quantity_ordered    NUMERIC(12, 2),
    ADD COLUMN expected_delivery   DATE,
    ADD COLUMN order_reference     VARCHAR(100);
