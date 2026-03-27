package com.forestock.forestock_backend.repository;

import com.forestock.forestock_backend.domain.Inventory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface InventoryRepository extends JpaRepository<Inventory, UUID> {

    // Most recent snapshot for a product (equivalent to current_inventory view)
    @Query("SELECT i FROM Inventory i WHERE i.product.id = :productId ORDER BY i.recordedAt DESC LIMIT 1")
    Optional<Inventory> findLatestByProductId(@Param("productId") UUID productId);

    // Snapshot history for a product
    List<Inventory> findByProductIdOrderByRecordedAtDesc(UUID productId);

    // All products with their most recent snapshot (for dashboard) — scoped to store
    @Query("""
           SELECT i FROM Inventory i
           JOIN FETCH i.product p
           WHERE i.recordedAt = (
               SELECT MAX(i2.recordedAt) FROM Inventory i2 WHERE i2.product = i.product
           )
           AND p.store.id = :storeId
           """)
    List<Inventory> findLatestForAllProductsByStore(@Param("storeId") UUID storeId);

    // All products with their most recent snapshot — unscoped (used internally)
    @Query("""
           SELECT i FROM Inventory i
           JOIN FETCH i.product
           WHERE i.recordedAt = (
               SELECT MAX(i2.recordedAt) FROM Inventory i2 WHERE i2.product = i.product
           )
           """)
    List<Inventory> findLatestForAllProducts();

    /** Deletes all inventory snapshots for a product (used before hard-deleting a product). */
    @Modifying
    @Query("DELETE FROM Inventory i WHERE i.product.id = :productId")
    int deleteByProductId(@Param("productId") UUID productId);
}
