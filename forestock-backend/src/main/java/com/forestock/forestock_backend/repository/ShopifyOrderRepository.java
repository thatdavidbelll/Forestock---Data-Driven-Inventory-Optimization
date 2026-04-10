package com.forestock.forestock_backend.repository;

import com.forestock.forestock_backend.domain.ShopifyOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ShopifyOrderRepository extends JpaRepository<ShopifyOrder, UUID> {
    boolean existsByStoreIdAndShopifyOrderId(UUID storeId, Long shopifyOrderId);
    Optional<ShopifyOrder> findByStoreIdAndShopifyOrderId(UUID storeId, Long shopifyOrderId);
    List<ShopifyOrder> findByStoreIdAndShopifyOrderIdIn(UUID storeId, List<Long> shopifyOrderIds);

    @Modifying
    @Query(value = """
        UPDATE shopify_orders
        SET customer_email = NULL,
            customer_first_name = NULL,
            customer_last_name = NULL
        WHERE store_id = :storeId
        """, nativeQuery = true)
    void anonymiseCustomerPiiByStore(@Param("storeId") UUID storeId);

    @Modifying
    @Query(value = """
        UPDATE shopify_orders
        SET raw_payload = raw_payload
            - 'customer'
            - 'billing_address'
            - 'shipping_address'
            - 'customer_locale'
        WHERE store_id = :storeId
          AND shopify_order_id = ANY(:orderIds)
        """, nativeQuery = true)
    void redactRawPayloadForOrders(@Param("storeId") UUID storeId,
                                   @Param("orderIds") long[] orderIds);

    @Modifying
    @Query(value = """
        UPDATE shopify_orders
        SET raw_payload = raw_payload
            - 'customer'
            - 'billing_address'
            - 'shipping_address'
            - 'customer_locale'
        WHERE store_id = :storeId
        """, nativeQuery = true)
    void redactRawPayloadForStore(@Param("storeId") UUID storeId);
}
