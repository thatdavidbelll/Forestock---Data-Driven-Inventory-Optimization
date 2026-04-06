package com.forestock.forestock_backend.repository;

import com.forestock.forestock_backend.domain.ShopifyOrderLineItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ShopifyOrderLineItemRepository extends JpaRepository<ShopifyOrderLineItem, UUID> {
    List<ShopifyOrderLineItem> findByShopifyOrderId(UUID shopifyOrderId);
}

