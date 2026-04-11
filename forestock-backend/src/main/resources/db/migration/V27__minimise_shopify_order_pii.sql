UPDATE shopify_orders
SET customer_email = NULL,
    customer_first_name = NULL,
    customer_last_name = NULL,
    raw_payload = raw_payload
        - 'customer'
        - 'billing_address'
        - 'shipping_address'
        - 'customer_locale'
        - 'email'
        - 'contact_email'
        - 'phone'
WHERE customer_email IS NOT NULL
   OR customer_first_name IS NOT NULL
   OR customer_last_name IS NOT NULL
   OR raw_payload ? 'customer'
   OR raw_payload ? 'billing_address'
   OR raw_payload ? 'shipping_address'
   OR raw_payload ? 'customer_locale'
   OR raw_payload ? 'email'
   OR raw_payload ? 'contact_email'
   OR raw_payload ? 'phone';
