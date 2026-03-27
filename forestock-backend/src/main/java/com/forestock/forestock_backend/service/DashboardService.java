package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.domain.ForecastRun;
import com.forestock.forestock_backend.domain.OrderSuggestion;
import com.forestock.forestock_backend.domain.Product;
import com.forestock.forestock_backend.domain.enums.ForecastStatus;
import com.forestock.forestock_backend.domain.enums.Urgency;
import com.forestock.forestock_backend.dto.response.DashboardDto;
import com.forestock.forestock_backend.dto.response.InventoryDto;
import com.forestock.forestock_backend.repository.ForecastRunRepository;
import com.forestock.forestock_backend.repository.OrderSuggestionRepository;
import com.forestock.forestock_backend.repository.ProductRepository;
import com.forestock.forestock_backend.security.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final ProductRepository productRepository;
    private final ForecastRunRepository forecastRunRepository;
    private final OrderSuggestionRepository suggestionRepository;
    private final InventoryService inventoryService;

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
}
