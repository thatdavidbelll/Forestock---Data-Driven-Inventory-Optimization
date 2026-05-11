ALTER TABLE shopify_connections
    ADD COLUMN plan_choice_confirmed BOOLEAN;

UPDATE shopify_connections
SET plan_choice_confirmed = TRUE
WHERE plan_choice_confirmed IS NULL;

ALTER TABLE shopify_connections
    ALTER COLUMN plan_choice_confirmed SET NOT NULL;

ALTER TABLE shopify_connections
    ALTER COLUMN plan_choice_confirmed SET DEFAULT FALSE;
