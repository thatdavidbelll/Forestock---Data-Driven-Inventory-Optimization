-- V1__init_schema.sql
-- Creates all base tables for the Forestock application.

-- ─── products ────────────────────────────────────────────────────────────────
CREATE TABLE products (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku            VARCHAR(50)   UNIQUE NOT NULL,
    name           VARCHAR(255)  NOT NULL,
    category       VARCHAR(100),
    unit           VARCHAR(20)   NOT NULL,        -- 'unit', 'kg', 'L'
    reorder_point  DECIMAL(10,2),                 -- threshold below which an alert fires
    max_stock      DECIMAL(10,2),                 -- maximum warehouse capacity
    active         BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMP     NOT NULL DEFAULT NOW()
);

-- ─── inventory ───────────────────────────────────────────────────────────────
-- Each row is a point-in-time stock snapshot.
-- Rows are never updated — current stock is derived from the most recent snapshot.
CREATE TABLE inventory (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id  UUID          NOT NULL REFERENCES products(id),
    quantity    DECIMAL(10,2) NOT NULL,
    recorded_at TIMESTAMP     NOT NULL DEFAULT NOW()
);

-- ─── sales_transactions ──────────────────────────────────────────────────────
-- One row per product per day (daily aggregated sales from POS).
CREATE TABLE sales_transactions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id    UUID          NOT NULL REFERENCES products(id),
    quantity_sold DECIMAL(10,2) NOT NULL,
    sale_date     DATE          NOT NULL,
    CONSTRAINT uq_sales_product_date UNIQUE (product_id, sale_date)
);

-- ─── forecast_runs ───────────────────────────────────────────────────────────
CREATE TABLE forecast_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status          VARCHAR(50)  NOT NULL,         -- RUNNING / COMPLETED / FAILED
    started_at      TIMESTAMP,
    finished_at     TIMESTAMP,
    horizon_days    INTEGER      NOT NULL DEFAULT 14,
    predictor_arn   VARCHAR(512),
    forecast_arn    VARCHAR(512),
    error_message   TEXT,
    triggered_by    VARCHAR(50)  NOT NULL DEFAULT 'SCHEDULER'  -- or 'MANUAL'
);

-- ─── order_suggestions ───────────────────────────────────────────────────────
CREATE TABLE order_suggestions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id       UUID          NOT NULL REFERENCES products(id),
    forecast_run_id  UUID          REFERENCES forecast_runs(id),
    suggested_qty    DECIMAL(10,2) NOT NULL,
    forecast_p50     DECIMAL(10,2),               -- median demand over 14 days
    forecast_p90     DECIMAL(10,2),               -- optimistic demand over 14 days
    current_stock    DECIMAL(10,2),               -- stock at time of generation
    days_of_stock    DECIMAL(6,2),                -- estimated days of stock remaining
    urgency          VARCHAR(20),                  -- CRITICAL / HIGH / MEDIUM / LOW
    generated_at     TIMESTAMP     NOT NULL DEFAULT NOW()
);
