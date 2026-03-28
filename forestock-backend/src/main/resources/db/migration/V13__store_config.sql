CREATE TABLE store_configurations (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id                    UUID NOT NULL UNIQUE REFERENCES stores(id) ON DELETE CASCADE,
    timezone                    VARCHAR(50) NOT NULL DEFAULT 'UTC',
    currency_symbol             VARCHAR(5) NOT NULL DEFAULT '£',
    forecast_horizon_days       INTEGER NOT NULL DEFAULT 14,
    lookback_days               INTEGER NOT NULL DEFAULT 365,
    min_history_days            INTEGER NOT NULL DEFAULT 30,
    seasonality_period          INTEGER NOT NULL DEFAULT 7,
    safety_stock_multiplier     NUMERIC(4, 2) NOT NULL DEFAULT 1.20,
    urgency_critical_days       INTEGER NOT NULL DEFAULT 2,
    urgency_high_days           INTEGER NOT NULL DEFAULT 5,
    urgency_medium_days         INTEGER NOT NULL DEFAULT 10,
    auto_forecast_on_import     BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at                  TIMESTAMP NOT NULL DEFAULT now()
);

INSERT INTO store_configurations (store_id)
SELECT id FROM stores
ON CONFLICT (store_id) DO NOTHING;
