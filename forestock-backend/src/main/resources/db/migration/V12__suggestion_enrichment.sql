ALTER TABLE order_suggestions
    ADD COLUMN lead_time_days_at_generation INTEGER,
    ADD COLUMN moq_applied                  NUMERIC(12, 2),
    ADD COLUMN estimated_order_value        NUMERIC(14, 2);
