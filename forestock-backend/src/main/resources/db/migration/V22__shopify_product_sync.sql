ALTER TABLE products
    ADD COLUMN shopify_product_gid VARCHAR(255),
    ADD COLUMN shopify_variant_gid VARCHAR(255),
    ADD COLUMN shopify_inventory_item_gid VARCHAR(255);

CREATE UNIQUE INDEX ux_products_store_shopify_variant_gid
    ON products(store_id, shopify_variant_gid)
    WHERE shopify_variant_gid IS NOT NULL;
