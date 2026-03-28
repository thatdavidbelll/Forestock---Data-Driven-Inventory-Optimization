ALTER TABLE products
    ADD COLUMN lead_time_days       INTEGER,
    ADD COLUMN minimum_order_qty    NUMERIC(12, 2),
    ADD COLUMN unit_cost            NUMERIC(12, 4),
    ADD COLUMN supplier_name        VARCHAR(255),
    ADD COLUMN supplier_contact     VARCHAR(255),
    ADD COLUMN barcode              VARCHAR(100),
    ADD COLUMN storage_location     VARCHAR(100),
    ADD COLUMN notes                TEXT;
