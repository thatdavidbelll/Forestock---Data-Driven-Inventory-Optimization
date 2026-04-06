package com.forestock.forestock_backend.repository;

import com.forestock.forestock_backend.domain.ShopifyConnection;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ShopifyConnectionRepository extends JpaRepository<ShopifyConnection, UUID> {
    Optional<ShopifyConnection> findByShopDomainAndActiveTrue(String shopDomain);
    Optional<ShopifyConnection> findByStoreId(UUID storeId);
    boolean existsByStoreId(UUID storeId);
    boolean existsByShopDomain(String shopDomain);
}

