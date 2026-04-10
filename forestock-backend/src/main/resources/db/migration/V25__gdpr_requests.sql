CREATE TABLE gdpr_requests (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_domain    VARCHAR(255) NOT NULL,
    webhook_topic  VARCHAR(100) NOT NULL,
    shopify_customer_id BIGINT,
    customer_email VARCHAR(255),
    received_at    TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_gdpr_requests_shop_domain ON gdpr_requests (shop_domain);
CREATE INDEX idx_gdpr_requests_received_at ON gdpr_requests (received_at);
