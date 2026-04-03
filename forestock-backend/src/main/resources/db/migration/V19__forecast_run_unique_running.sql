-- Prevent two concurrent forecast runs for the same store.
-- The partial index only covers RUNNING rows, so completed/failed runs are unaffected.
CREATE UNIQUE INDEX uq_forecast_run_running_per_store
    ON forecast_runs (store_id)
    WHERE status = 'RUNNING';
