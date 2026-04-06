-- Performance indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_sales_store_date
    ON sales_transactions (store_id, sale_date);

CREATE INDEX IF NOT EXISTS idx_suggestions_urgency_date
    ON order_suggestions (generated_at DESC, urgency);

CREATE INDEX IF NOT EXISTS idx_forecast_runs_store_status
    ON forecast_runs (store_id, status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_store_timestamp
    ON audit_logs (store_id, occurred_at DESC);
