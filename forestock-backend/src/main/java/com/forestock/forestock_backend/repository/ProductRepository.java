package com.forestock.forestock_backend.repository;

import com.forestock.forestock_backend.domain.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ProductRepository extends JpaRepository<Product, UUID> {

    Optional<Product> findByStoreIdAndSku(UUID storeId, String sku);

    List<Product> findByStoreIdAndActiveTrue(UUID storeId);

    List<Product> findByStoreIdAndCategoryAndActiveTrue(UUID storeId, String category);

    boolean existsByStoreIdAndSku(UUID storeId, String sku);

    /** Returns all products for a store, including inactive ones. */
    List<Product> findByStoreId(UUID storeId);

    // Legacy methods without storeId — kept for backward compatibility with existing services
    Optional<Product> findBySku(String sku);

    List<Product> findByActiveTrue();

    boolean existsBySku(String sku);
}
