-- V3__forecast_run_cleanup.sql
-- Adapts forecast_runs for Holt-Winters (removes AWS Forecast ARN columns, adds products_processed).

ALTER TABLE forecast_runs DROP COLUMN IF EXISTS predictor_arn;
ALTER TABLE forecast_runs DROP COLUMN IF EXISTS forecast_arn;

ALTER TABLE forecast_runs ADD COLUMN IF NOT EXISTS products_processed INTEGER DEFAULT 0;
