ALTER TABLE shopify_connections
    ADD COLUMN plan_tier VARCHAR(16) NOT NULL DEFAULT 'FREE',
    ADD COLUMN product_limit INTEGER;

UPDATE shopify_connections
SET product_limit = 15
WHERE plan_tier = 'FREE'
  AND product_limit IS NULL;
