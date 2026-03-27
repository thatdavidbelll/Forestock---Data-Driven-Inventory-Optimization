package com.forestock.forestock_backend.repository;

import com.forestock.forestock_backend.domain.OrderSuggestion;
import com.forestock.forestock_backend.domain.enums.Urgency;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface OrderSuggestionRepository extends JpaRepository<OrderSuggestion, UUID> {

    // All suggestions for a given forecast run
    @Query("SELECT s FROM OrderSuggestion s JOIN FETCH s.product WHERE s.forecastRun.id = :runId ORDER BY s.urgency ASC, s.daysOfStock ASC")
    List<OrderSuggestion> findByForecastRunIdOrderByUrgencyAscDaysOfStockAsc(@Param("runId") UUID forecastRunId);

    // Filtered by urgency
    @Query("SELECT s FROM OrderSuggestion s JOIN FETCH s.product WHERE s.forecastRun.id = :runId AND s.urgency = :urgency ORDER BY s.daysOfStock ASC")
    List<OrderSuggestion> findByForecastRunIdAndUrgencyOrderByDaysOfStockAsc(@Param("runId") UUID forecastRunId, @Param("urgency") Urgency urgency);

    // Filtered by product category
    @Query("SELECT s FROM OrderSuggestion s JOIN FETCH s.product WHERE s.forecastRun.id = :runId AND s.product.category = :category ORDER BY s.urgency ASC, s.daysOfStock ASC")
    List<OrderSuggestion> findByForecastRunIdAndProductCategoryOrderByUrgencyAscDaysOfStockAsc(
            @Param("runId") UUID forecastRunId, @Param("category") String category);

    /** Deletes all suggestions for a product (used before hard-deleting a product). */
    @Modifying
    @Query("DELETE FROM OrderSuggestion s WHERE s.product.id = :productId")
    int deleteByProductId(@Param("productId") UUID productId);
}
