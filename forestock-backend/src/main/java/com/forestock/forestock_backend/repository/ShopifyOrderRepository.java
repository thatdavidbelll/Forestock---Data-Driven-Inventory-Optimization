package com.forestock.forestock_backend.repository;

import com.forestock.forestock_backend.domain.ShopifyOrder;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ShopifyOrderRepository extends JpaRepository<ShopifyOrder, UUID> {
    boolean existsByStoreIdAndShopifyOrderId(UUID storeId, Long shopifyOrderId);
    Optional<ShopifyOrder> findByStoreIdAndShopifyOrderId(UUID storeId, Long shopifyOrderId);
}

