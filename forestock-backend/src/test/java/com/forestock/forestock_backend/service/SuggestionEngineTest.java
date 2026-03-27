package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.domain.ForecastRun;
import com.forestock.forestock_backend.domain.OrderSuggestion;
import com.forestock.forestock_backend.domain.Product;
import com.forestock.forestock_backend.domain.enums.ForecastStatus;
import com.forestock.forestock_backend.domain.enums.Urgency;
import com.forestock.forestock_backend.repository.OrderSuggestionRepository;
import com.forestock.forestock_backend.service.ForecastingEngine.ForecastResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SuggestionEngineTest {

    @Mock
    private OrderSuggestionRepository suggestionRepository;

    @InjectMocks
    private SuggestionEngine suggestionEngine;

    private ForecastRun forecastRun;
    private Product product;

    @BeforeEach
    void setUp() {
        forecastRun = ForecastRun.builder()
                .id(UUID.randomUUID())
                .status(ForecastStatus.RUNNING)
                .startedAt(LocalDateTime.now())
                .build();

        product = Product.builder()
                .id(UUID.randomUUID())
                .sku("TEST-001")
                .name("Test Product")
                .unit("buc")
                .active(true)
                .build();

        when(suggestionRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));
    }

    // ─── Urgency tests ──────────────────────────────────────────────────────

    @Test
    void urgency_CRITICAL_when_daysOfStock_below_2() {
        // stock=5, p50=140/14d → dailyDemand=10 → daysOfStock=0.5 → CRITICAL
        Map<UUID, BigDecimal> stock = Map.of(product.getId(), BigDecimal.valueOf(5));
        Map<UUID, ForecastResult> forecast = Map.of(
                product.getId(), new ForecastResult(140, 168, List.of()));

        List<OrderSuggestion> result = suggestionEngine.generate(
                List.of(product), stock, forecast, forecastRun, 14);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getUrgency()).isEqualTo(Urgency.CRITICAL);
    }

    @Test
    void urgency_HIGH_when_daysOfStock_between_2_and_5() {
        // stock=30, p50=140 → dailyDemand=10 → daysOfStock=3 → HIGH
        Map<UUID, BigDecimal> stock = Map.of(product.getId(), BigDecimal.valueOf(30));
        Map<UUID, ForecastResult> forecast = Map.of(
                product.getId(), new ForecastResult(140, 168, List.of()));

        List<OrderSuggestion> result = suggestionEngine.generate(
                List.of(product), stock, forecast, forecastRun, 14);

        assertThat(result.get(0).getUrgency()).isEqualTo(Urgency.HIGH);
    }

    @Test
    void urgency_MEDIUM_when_daysOfStock_between_5_and_10() {
        // stock=70, p50=140 → dailyDemand=10 → daysOfStock=7 → MEDIUM
        Map<UUID, BigDecimal> stock = Map.of(product.getId(), BigDecimal.valueOf(70));
        Map<UUID, ForecastResult> forecast = Map.of(
                product.getId(), new ForecastResult(140, 168, List.of()));

        List<OrderSuggestion> result = suggestionEngine.generate(
                List.of(product), stock, forecast, forecastRun, 14);

        assertThat(result.get(0).getUrgency()).isEqualTo(Urgency.MEDIUM);
    }

    @Test
    void urgency_LOW_when_daysOfStock_above_10() {
        // stock=200, p50=140 → dailyDemand=10 → daysOfStock=20 → LOW
        Map<UUID, BigDecimal> stock = Map.of(product.getId(), BigDecimal.valueOf(200));
        Map<UUID, ForecastResult> forecast = Map.of(
                product.getId(), new ForecastResult(140, 168, List.of()));

        List<OrderSuggestion> result = suggestionEngine.generate(
                List.of(product), stock, forecast, forecastRun, 14);

        assertThat(result.get(0).getUrgency()).isEqualTo(Urgency.LOW);
    }

    // ─── Quantity tests ──────────────────────────────────────────────────────

    @Test
    void suggestedQty_is_p90_minus_stock_rounded_up() {
        // p90=168, stock=30 → suggested=138
        Map<UUID, BigDecimal> stock = Map.of(product.getId(), BigDecimal.valueOf(30));
        Map<UUID, ForecastResult> forecast = Map.of(
                product.getId(), new ForecastResult(140, 168, List.of()));

        List<OrderSuggestion> result = suggestionEngine.generate(
                List.of(product), stock, forecast, forecastRun, 14);

        assertThat(result.get(0).getSuggestedQty()).isEqualByComparingTo(BigDecimal.valueOf(138));
    }

    @Test
    void suggestedQty_is_zero_when_stock_exceeds_p90() {
        // p90=168, stock=300 → suggested=0 (no order needed)
        Map<UUID, BigDecimal> stock = Map.of(product.getId(), BigDecimal.valueOf(300));
        Map<UUID, ForecastResult> forecast = Map.of(
                product.getId(), new ForecastResult(140, 168, List.of()));

        List<OrderSuggestion> result = suggestionEngine.generate(
                List.of(product), stock, forecast, forecastRun, 14);

        assertThat(result.get(0).getSuggestedQty()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void daysOfStock_is_999_when_daily_demand_is_zero() {
        // p50=0 → no demand → daysOfStock=999 → LOW urgency
        Map<UUID, BigDecimal> stock = Map.of(product.getId(), BigDecimal.valueOf(50));
        Map<UUID, ForecastResult> forecast = Map.of(
                product.getId(), new ForecastResult(0, 0, List.of()));

        List<OrderSuggestion> result = suggestionEngine.generate(
                List.of(product), stock, forecast, forecastRun, 14);

        assertThat(result.get(0).getDaysOfStock()).isEqualByComparingTo(BigDecimal.valueOf(999));
        assertThat(result.get(0).getUrgency()).isEqualTo(Urgency.LOW);
    }

    // ─── Sorting test ────────────────────────────────────────────────────────

    @Test
    void suggestions_sorted_CRITICAL_first_then_by_daysOfStock() {
        Product p2 = Product.builder()
                .id(UUID.randomUUID()).sku("P2").name("P2").unit("buc").active(true).build();
        Product p3 = Product.builder()
                .id(UUID.randomUUID()).sku("P3").name("P3").unit("buc").active(true).build();

        // p1: stock=5,  p50=140 → CRITICAL (0.5d)
        // p2: stock=200, p50=140 → LOW (20d)
        // p3: stock=30, p50=140 → HIGH (3d)
        Map<UUID, BigDecimal> stock = Map.of(
                product.getId(), BigDecimal.valueOf(5),
                p2.getId(),      BigDecimal.valueOf(200),
                p3.getId(),      BigDecimal.valueOf(30));
        ForecastResult fr = new ForecastResult(140, 168, List.of());
        Map<UUID, ForecastResult> forecast = Map.of(
                product.getId(), fr, p2.getId(), fr, p3.getId(), fr);

        List<OrderSuggestion> result = suggestionEngine.generate(
                List.of(product, p2, p3), stock, forecast, forecastRun, 14);

        assertThat(result.get(0).getUrgency()).isEqualTo(Urgency.CRITICAL);
        assertThat(result.get(1).getUrgency()).isEqualTo(Urgency.HIGH);
        assertThat(result.get(2).getUrgency()).isEqualTo(Urgency.LOW);
    }
}
