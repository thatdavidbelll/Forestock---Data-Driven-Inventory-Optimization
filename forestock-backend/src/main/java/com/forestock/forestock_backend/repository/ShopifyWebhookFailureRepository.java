package com.forestock.forestock_backend.repository;

import com.forestock.forestock_backend.domain.ShopifyWebhookFailure;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ShopifyWebhookFailureRepository extends JpaRepository<ShopifyWebhookFailure, UUID> {
    List<ShopifyWebhookFailure> findByResolvedFalseOrderByCreatedAtDesc();
    List<ShopifyWebhookFailure> findByStoreIdAndResolvedFalse(UUID storeId);
}

