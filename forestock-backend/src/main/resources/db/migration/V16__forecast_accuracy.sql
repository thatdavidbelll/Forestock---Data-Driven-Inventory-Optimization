ALTER TABLE forecast_runs
    ADD COLUMN products_with_insufficient_data INTEGER,
    ADD COLUMN duration_seconds                INTEGER,
    ADD COLUMN mape                            NUMERIC(6, 2),
    ADD COLUMN rmse                            NUMERIC(10, 4);

CREATE TABLE forecast_accuracy_results (
    id                    BIGSERIAL PRIMARY KEY,
    store_id              UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    forecast_run_id       UUID NOT NULL REFERENCES forecast_runs(id) ON DELETE CASCADE,
    product_id            UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    evaluation_date       DATE NOT NULL,
    forecast_period_start DATE NOT NULL,
    forecast_period_end   DATE NOT NULL,
    predicted_total       NUMERIC(10, 2) NOT NULL,
    actual_total          NUMERIC(10, 2),
    mape                  NUMERIC(6, 2),
    evaluated_at          TIMESTAMP
);

CREATE INDEX idx_accuracy_store_run ON forecast_accuracy_results(store_id, forecast_run_id);
CREATE INDEX idx_accuracy_product ON forecast_accuracy_results(store_id, product_id);
