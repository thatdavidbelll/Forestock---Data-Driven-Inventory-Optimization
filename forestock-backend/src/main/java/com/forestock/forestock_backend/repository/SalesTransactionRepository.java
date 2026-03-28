package com.forestock.forestock_backend.repository;

import com.forestock.forestock_backend.domain.SalesTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SalesTransactionRepository extends JpaRepository<SalesTransaction, UUID> {

    List<SalesTransaction> findByProductIdOrderBySaleDateAsc(UUID productId);

    List<SalesTransaction> findByProductIdAndSaleDateBetweenOrderBySaleDateAsc(
            UUID productId, LocalDate from, LocalDate to);

    List<SalesTransaction> findBySaleDateBetween(LocalDate from, LocalDate to);

    Optional<SalesTransaction> findByProductIdAndSaleDate(UUID productId, LocalDate saleDate);

    @Query("""
           SELECT s FROM SalesTransaction s
           JOIN FETCH s.product p
           WHERE s.saleDate >= :fromDate
           AND p.store.id = :storeId
           ORDER BY p.id ASC, s.saleDate ASC
           """)
    List<SalesTransaction> findAllFromDateByStore(@Param("fromDate") LocalDate fromDate, @Param("storeId") UUID storeId);

    @Query("""
           SELECT s FROM SalesTransaction s
           JOIN FETCH s.product
           WHERE s.saleDate >= :fromDate
           ORDER BY s.product.id ASC, s.saleDate ASC
           """)
    List<SalesTransaction> findAllFromDate(@Param("fromDate") LocalDate fromDate);

    @Query("SELECT COUNT(s) FROM SalesTransaction s WHERE s.saleDate BETWEEN :from AND :to")
    long countByDateRange(@Param("from") LocalDate from, @Param("to") LocalDate to);

    /** Store-scoped version of findBySaleDateBetween — used by getSummary(). */
    @Query("""
           SELECT s FROM SalesTransaction s
           JOIN FETCH s.product p
           WHERE s.saleDate BETWEEN :from AND :to
           AND p.store.id = :storeId
           """)
    List<SalesTransaction> findBySaleDateBetweenAndStoreId(
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("storeId") UUID storeId);

    @Query("""
           SELECT s FROM SalesTransaction s
           JOIN FETCH s.product p
           WHERE p.store.id = :storeId
           ORDER BY s.saleDate ASC, p.sku ASC
           """)
    List<SalesTransaction> findAllByStoreIdOrderBySaleDateAsc(@Param("storeId") UUID storeId);

    // ── Paginated list (store-scoped, filterable) ────────────────────────────
    @Query(value = """
            SELECT s FROM SalesTransaction s
            JOIN FETCH s.product p
            WHERE p.store.id = :storeId
            AND (:productId IS NULL OR p.id = :productId)
            AND (:from     IS NULL OR s.saleDate >= :from)
            AND (:to       IS NULL OR s.saleDate <= :to)
            ORDER BY s.saleDate DESC, p.sku ASC
            """,
           countQuery = """
            SELECT COUNT(s) FROM SalesTransaction s
            JOIN s.product p
            WHERE p.store.id = :storeId
            AND (:productId IS NULL OR p.id = :productId)
            AND (:from     IS NULL OR s.saleDate >= :from)
            AND (:to       IS NULL OR s.saleDate <= :to)
            """)
    Page<SalesTransaction> findByStoreFiltered(
            @Param("storeId")   UUID storeId,
            @Param("productId") UUID productId,
            @Param("from")      LocalDate from,
            @Param("to")        LocalDate to,
            Pageable pageable);

    // ── Delete methods ────────────────────────────────────────────────────────

    /** Deletes all transactions for a specific product. */
    @Modifying
    @Query("DELETE FROM SalesTransaction s WHERE s.product.id = :productId")
    int deleteByProductId(@Param("productId") UUID productId);

    /** Deletes transactions for a product within a date range. */
    @Modifying
    @Query("DELETE FROM SalesTransaction s WHERE s.product.id = :productId AND s.saleDate BETWEEN :from AND :to")
    int deleteByProductIdAndDateRange(
            @Param("productId") UUID productId,
            @Param("from")      LocalDate from,
            @Param("to")        LocalDate to);

    /** Deletes all transactions for a store within a date range. */
    @Modifying
    @Query("DELETE FROM SalesTransaction s WHERE s.product.store.id = :storeId AND s.saleDate BETWEEN :from AND :to")
    int deleteByStoreAndDateRange(
            @Param("storeId") UUID storeId,
            @Param("from")    LocalDate from,
            @Param("to")      LocalDate to);

    /** Deletes ALL transactions for a store (nuclear reset). */
    @Modifying
    @Query("DELETE FROM SalesTransaction s WHERE s.product.store.id = :storeId")
    int deleteAllByStore(@Param("storeId") UUID storeId);
}
