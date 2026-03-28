package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.domain.ForecastRun;
import com.forestock.forestock_backend.domain.OrderSuggestion;
import com.forestock.forestock_backend.domain.Product;
import com.forestock.forestock_backend.domain.SalesTransaction;
import com.forestock.forestock_backend.domain.enums.ForecastStatus;
import com.forestock.forestock_backend.domain.enums.Urgency;
import com.forestock.forestock_backend.dto.response.DashboardDto;
import com.forestock.forestock_backend.dto.response.InventoryDto;
import com.forestock.forestock_backend.repository.ForecastRunRepository;
import com.forestock.forestock_backend.repository.OrderSuggestionRepository;
import com.forestock.forestock_backend.repository.ProductRepository;
import com.forestock.forestock_backend.repository.SalesTransactionRepository;
import com.forestock.forestock_backend.security.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final ProductRepository productRepository;
    private final ForecastRunRepository forecastRunRepository;
    private final OrderSuggestionRepository suggestionRepository;
    private final SalesTransactionRepository salesTransactionRepository;
    private final InventoryService inventoryService;
    private final ForecastAccuracyService forecastAccuracyService;

    @Transactional(readOnly = true)
    public DashboardDto getDashboard() {
        UUID storeId = TenantContext.getStoreId();

        List<Product> activeProducts = storeId != null
                ? productRepository.findByStoreIdAndActiveTrue(storeId)
                : productRepository.findByActiveTrue();

        long totalActive = activeProducts.size();
        long alertsCount = inventoryService.getAlerts().size();

        Optional<ForecastRun> latestRun = storeId != null
                ? forecastRunRepository.findTopByStoreIdAndStatusOrderByFinishedAtDesc(storeId, ForecastStatus.COMPLETED)
                : forecastRunRepository.findTopByStatusOrderByFinishedAtDesc(ForecastStatus.COMPLETED);

        long criticalCount = 0;
        long highCount = 0;

        if (latestRun.isPresent()) {
            List<OrderSuggestion> suggestions = suggestionRepository
                    .findByForecastRunIdOrderByUrgencyAscDaysOfStockAsc(latestRun.get().getId());
            criticalCount = suggestions.stream().filter(s -> s.getUrgency() == Urgency.CRITICAL).count();
            highCount = suggestions.stream().filter(s -> s.getUrgency() == Urgency.HIGH).count();
        }

        return DashboardDto.builder()
                .totalActiveProducts(totalActive)
                .alertsCount(alertsCount)
                .criticalCount(criticalCount)
                .highCount(highCount)
                .lastRunStatus(latestRun.map(ForecastRun::getStatus).orElse(null))
                .lastRunAt(latestRun.map(ForecastRun::getFinishedAt).orElse(null))
                .accuracyScore(storeId != null ? toAccuracyScore(forecastAccuracyService.getDashboardAccuracy(storeId)) : null)
                .alertTrend(storeId != null ? getAlertTrend(storeId) : List.of())
                .topCritical(latestRun.map(run -> getTopCritical(run.getId())).orElse(List.of()))
                .salesVelocityTrend(storeId != null ? getSalesVelocityTrend(storeId) : List.of())
                .dataQualityWarnings(storeId != null ? getDataQualityWarnings(storeId) : List.of())
                .build();
    }

    @Transactional(readOnly = true)
    public List<DashboardDto.CategorySummary> getCategorySummaries() {
        UUID storeId = TenantContext.getStoreId();

        List<Product> activeProducts = storeId != null
                ? productRepository.findByStoreIdAndActiveTrue(storeId)
                : productRepository.findByActiveTrue();

        List<InventoryDto> alerts = inventoryService.getAlerts();

        Set<UUID> alertProductIds = alerts.stream()
                .map(InventoryDto::getProductId)
                .collect(Collectors.toSet());

        Map<String, long[]> categoryStats = new LinkedHashMap<>();
        for (Product p : activeProducts) {
            String cat = p.getCategory() != null ? p.getCategory() : "Uncategorized";
            categoryStats.computeIfAbsent(cat, k -> new long[]{0, 0});
            categoryStats.get(cat)[0]++;
            if (alertProductIds.contains(p.getId())) {
                categoryStats.get(cat)[1]++;
            }
        }

        return categoryStats.entrySet()
                .stream()
                .sorted(Map.Entry.comparingByKey())
                .map(e -> DashboardDto.CategorySummary.builder()
                        .category(e.getKey())
                        .productCount(e.getValue()[0])
                        .alertCount(e.getValue()[1])
                        .build())
                .toList();
    }

    private DashboardDto.AccuracyScore toAccuracyScore(ForecastAccuracyService.AccuracyScore score) {
        return DashboardDto.AccuracyScore.builder()
                .lastRunMape(score.lastRunMape())
                .trend(score.trend())
                .evaluatedForecasts(score.evaluatedForecasts())
                .build();
    }

    @Transactional(readOnly = true)
    public List<DashboardDto.AlertTrendPoint> getAlertTrend(UUID storeId) {
        return forecastRunRepository.findByStoreIdOrderByStartedAtDesc(storeId).stream()
                .filter(run -> run.getStatus() == ForecastStatus.COMPLETED)
                .limit(10)
                .sorted(Comparator.comparing(ForecastRun::getFinishedAt))
                .map(run -> {
                    List<OrderSuggestion> suggestions = suggestionRepository.findByForecastRunIdOrderByUrgencyAscDaysOfStockAsc(run.getId());
                    long critical = suggestions.stream().filter(s -> s.getUrgency() == Urgency.CRITICAL).count();
                    long high = suggestions.stream().filter(s -> s.getUrgency() == Urgency.HIGH).count();
                    return DashboardDto.AlertTrendPoint.builder()
                            .date(String.valueOf(run.getFinishedAt() != null ? run.getFinishedAt().toLocalDate() : LocalDate.now()))
                            .critical(critical)
                            .high(high)
                            .build();
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public List<DashboardDto.CriticalSuggestion> getTopCritical(UUID forecastRunId) {
        return suggestionRepository.findByForecastRunIdOrderByUrgencyAscDaysOfStockAsc(forecastRunId).stream()
                .filter(suggestion -> suggestion.getUrgency() == Urgency.CRITICAL)
                .limit(5)
                .map(suggestion -> DashboardDto.CriticalSuggestion.builder()
                        .productName(suggestion.getProduct().getName())
                        .sku(suggestion.getProduct().getSku())
                        .daysOfStock(suggestion.getDaysOfStock())
                        .suggestedQty(suggestion.getSuggestedQty())
                        .estimatedOrderValue(suggestion.getEstimatedOrderValue())
                        .build())
                .toList();
    }

    @Transactional(readOnly = true)
    public List<DashboardDto.SalesVelocityPoint> getSalesVelocityTrend(UUID storeId) {
        LocalDate from = LocalDate.now().minusDays(29);
        Map<LocalDate, BigDecimal> totalsByDate = salesTransactionRepository.findBySaleDateBetweenAndStoreId(
                        from,
                        LocalDate.now(),
                        storeId
                ).stream()
                .collect(Collectors.groupingBy(
                        SalesTransaction::getSaleDate,
                        TreeMap::new,
                        Collectors.reducing(BigDecimal.ZERO, SalesTransaction::getQuantitySold, BigDecimal::add)
                ));

        List<DashboardDto.SalesVelocityPoint> points = new ArrayList<>();
        for (LocalDate date = from; !date.isAfter(LocalDate.now()); date = date.plusDays(1)) {
            points.add(DashboardDto.SalesVelocityPoint.builder()
                    .date(date.toString())
                    .totalUnitsSold(totalsByDate.getOrDefault(date, BigDecimal.ZERO))
                    .build());
        }
        return points;
    }

    @Transactional(readOnly = true)
    public List<String> getDataQualityWarnings(UUID storeId) {
        List<Product> products = productRepository.findByStoreIdAndActiveTrue(storeId);
        Set<UUID> productsWithRecentSales = salesTransactionRepository.findBySaleDateBetweenAndStoreId(
                        LocalDate.now().minusDays(30),
                        LocalDate.now(),
                        storeId
                ).stream()
                .map(transaction -> transaction.getProduct().getId())
                .collect(Collectors.toSet());

        List<String> warnings = new ArrayList<>();
        long noRecentSales = products.stream()
                .filter(product -> !productsWithRecentSales.contains(product.getId()))
                .count();
        long missingReorderPoint = products.stream()
                .filter(product -> product.getReorderPoint() == null)
                .count();

        if (noRecentSales > 0) {
            warnings.add(noRecentSales + " active products have no sales data in the last 30 days.");
        }
        if (missingReorderPoint > 0) {
            warnings.add(missingReorderPoint + " active products have no reorder point configured.");
        }
        return warnings;
    }
}
