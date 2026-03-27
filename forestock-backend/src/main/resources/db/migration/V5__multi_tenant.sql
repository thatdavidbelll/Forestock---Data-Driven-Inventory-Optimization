-- V5__multi_tenant.sql
-- Adds multi-tenancy: stores table + store_id FK on all existing tables.

-- ─── stores ──────────────────────────────────────────────────────────────────
CREATE TABLE stores (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(255) NOT NULL,
    slug       VARCHAR(100) UNIQUE NOT NULL,
    active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stores_slug ON stores(slug);

-- ─── Add store_id to all tenant-scoped tables ─────────────────────────────────

ALTER TABLE users
    ADD COLUMN store_id UUID REFERENCES stores(id);

ALTER TABLE products
    ADD COLUMN store_id UUID REFERENCES stores(id);

ALTER TABLE inventory
    ADD COLUMN store_id UUID REFERENCES stores(id);

ALTER TABLE sales_transactions
    ADD COLUMN store_id UUID REFERENCES stores(id);

ALTER TABLE forecast_runs
    ADD COLUMN store_id UUID REFERENCES stores(id);

ALTER TABLE order_suggestions
    ADD COLUMN store_id UUID REFERENCES stores(id);

-- Indexes for the most common tenant-scoped queries
CREATE INDEX idx_products_store        ON products(store_id);
CREATE INDEX idx_inventory_store       ON inventory(store_id);
CREATE INDEX idx_sales_store           ON sales_transactions(store_id);
CREATE INDEX idx_forecast_runs_store   ON forecast_runs(store_id);
CREATE INDEX idx_suggestions_store     ON order_suggestions(store_id);
CREATE INDEX idx_users_store           ON users(store_id);

-- SKU is now unique per store, not globally
ALTER TABLE products DROP CONSTRAINT products_sku_key;
ALTER TABLE products ADD CONSTRAINT uq_products_store_sku UNIQUE (store_id, sku);
