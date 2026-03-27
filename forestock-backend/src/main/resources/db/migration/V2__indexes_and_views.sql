-- V2__indexes_and_views.sql
-- Adds performance indexes and the current_inventory view.

-- ─── Indexes ──────────────────────────────────────────────────────────────────

-- Most frequent query: current stock per product
CREATE INDEX idx_inventory_product_recorded
    ON inventory(product_id, recorded_at DESC);

-- Sales history queries and export
CREATE INDEX idx_sales_product_date
    ON sales_transactions(product_id, sale_date);

-- Filter suggestions by forecast run and urgency
CREATE INDEX idx_suggestions_run_urgency
    ON order_suggestions(forecast_run_id, urgency);

-- Active products (most queries exclude inactive ones)
CREATE INDEX idx_products_active
    ON products(active) WHERE active = TRUE;

-- Fast SKU lookup (supplementary to the UNIQUE constraint)
CREATE INDEX idx_products_sku
    ON products(sku);

-- Latest forecast run (used by dashboard)
CREATE INDEX idx_forecast_runs_status_finished
    ON forecast_runs(status, finished_at DESC);


-- ─── View: current_inventory ─────────────────────────────────────────────────
-- Always returns the most recent stock snapshot per product.
-- IMPORTANT: Always use this view for current stock levels —
--            never query the inventory table directly.
CREATE VIEW current_inventory AS
    SELECT DISTINCT ON (product_id)
           id,
           product_id,
           quantity,
           recorded_at
    FROM   inventory
    ORDER  BY product_id, recorded_at DESC;
