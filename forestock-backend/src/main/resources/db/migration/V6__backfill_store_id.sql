-- V6__backfill_store_id.sql
-- Assigns existing rows with store_id = NULL to the default store.
-- Needed for data created before ProductController was made tenant-aware.

DO $$
DECLARE
    default_store_id UUID;
BEGIN
    SELECT id INTO default_store_id FROM stores WHERE slug = 'default' LIMIT 1;

    IF default_store_id IS NOT NULL THEN
        UPDATE users              SET store_id = default_store_id WHERE store_id IS NULL;
        UPDATE products           SET store_id = default_store_id WHERE store_id IS NULL;
        UPDATE inventory          SET store_id = default_store_id WHERE store_id IS NULL;
        UPDATE sales_transactions SET store_id = default_store_id WHERE store_id IS NULL;
        UPDATE forecast_runs      SET store_id = default_store_id WHERE store_id IS NULL;
        UPDATE order_suggestions  SET store_id = default_store_id WHERE store_id IS NULL;
    END IF;
END $$;
