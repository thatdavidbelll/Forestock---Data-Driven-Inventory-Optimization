-- ============================================================
-- V21: Shopify Integration Tables
-- ============================================================

CREATE TABLE shopify_connections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id        UUID NOT NULL UNIQUE REFERENCES stores(id) ON DELETE CASCADE,
    shop_domain     VARCHAR(255) NOT NULL UNIQUE,
    webhook_secret  VARCHAR(255),
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shopify_connections_domain ON shopify_connections(shop_domain);
CREATE INDEX idx_shopify_connections_store ON shopify_connections(store_id);

CREATE TABLE shopify_orders (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id             UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    shopify_order_id     BIGINT NOT NULL,
    shopify_order_number VARCHAR(50),
    shopify_order_name   VARCHAR(100),
    financial_status     VARCHAR(50),
    fulfillment_status   VARCHAR(50),
    customer_email       VARCHAR(255),
    customer_first_name  VARCHAR(100),
    customer_last_name   VARCHAR(100),
    total_price          NUMERIC(12,2),
    subtotal_price       NUMERIC(12,2),
    currency             VARCHAR(10),
    order_created_at     TIMESTAMP NOT NULL,
    order_updated_at     TIMESTAMP,
    raw_payload          JSONB,
    processed            BOOLEAN NOT NULL DEFAULT FALSE,
    processed_at         TIMESTAMP,
    error_message        TEXT,
    received_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_shopify_order_per_store UNIQUE(store_id, shopify_order_id)
);

CREATE INDEX idx_shopify_orders_store ON shopify_orders(store_id);
CREATE INDEX idx_shopify_orders_shopify_id ON shopify_orders(shopify_order_id);
CREATE INDEX idx_shopify_orders_processed ON shopify_orders(store_id, processed);
CREATE INDEX idx_shopify_orders_created ON shopify_orders(order_created_at);

CREATE TABLE shopify_order_line_items (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id             UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    shopify_order_id     UUID NOT NULL REFERENCES shopify_orders(id) ON DELETE CASCADE,
    shopify_line_item_id BIGINT NOT NULL,
    product_id           UUID REFERENCES products(id) ON DELETE SET NULL,
    sku                  VARCHAR(255),
    title                VARCHAR(500),
    variant_title        VARCHAR(500),
    quantity             INTEGER NOT NULL,
    price                NUMERIC(12,2),
    matched              BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT uq_shopify_line_item UNIQUE(shopify_order_id, shopify_line_item_id)
);

CREATE INDEX idx_shopify_line_items_order ON shopify_order_line_items(shopify_order_id);
CREATE INDEX idx_shopify_line_items_product ON shopify_order_line_items(product_id);
CREATE INDEX idx_shopify_line_items_sku ON shopify_order_line_items(sku);

CREATE TABLE shopify_webhook_failures (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id         UUID REFERENCES stores(id) ON DELETE CASCADE,
    shop_domain      VARCHAR(255),
    topic            VARCHAR(100),
    shopify_order_id BIGINT,
    raw_payload      JSONB NOT NULL,
    error_message    TEXT NOT NULL,
    retry_count      INTEGER NOT NULL DEFAULT 0,
    resolved         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhook_failures_unresolved ON shopify_webhook_failures(resolved, created_at DESC);
CREATE INDEX idx_webhook_failures_store ON shopify_webhook_failures(store_id) WHERE store_id IS NOT NULL;
