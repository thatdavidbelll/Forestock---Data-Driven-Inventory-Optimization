package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.domain.ForecastRun;
import com.forestock.forestock_backend.domain.OrderSuggestion;
import com.forestock.forestock_backend.domain.Product;
import com.forestock.forestock_backend.domain.ShopifyConnection;
import com.forestock.forestock_backend.domain.enums.ForecastStatus;
import com.forestock.forestock_backend.domain.enums.Urgency;
import com.forestock.forestock_backend.repository.ForecastRunRepository;
import com.forestock.forestock_backend.repository.OrderSuggestionRepository;
import com.forestock.forestock_backend.repository.ProductRepository;
import com.forestock.forestock_backend.repository.SalesTransactionRepository;
import com.forestock.forestock_backend.repository.ShopifyConnectionRepository;
import lombok.Builder;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ShopifyAppHomeService {

    private final ShopifyConnectionRepository shopifyConnectionRepository;
    private final ProductRepository productRepository;
    private final SalesTransactionRepository salesTransactionRepository;
    private final ForecastRunRepository forecastRunRepository;
    private final OrderSuggestionRepository orderSuggestionRepository;
    private final DashboardService dashboardService;

    @Transactional(readOnly = true)
    public AppHomeOverview getOverview(String shopDomain) {
        ShopifyConnection connection = shopifyConnectionRepository.findByShopDomain(shopDomain).orElse(null);
        if (connection == null) {
            return AppHomeOverview.builder()
                    .shopDomain(shopDomain)
                    .storeName(null)
                    .shopifyConnectionActive(false)
                    .activeProductCount(0)
                    .hasSalesHistory(false)
                    .forecastStatus(null)
                    .forecastCompletedAt(null)
                    .criticalSuggestions(0)
                    .highSuggestions(0)
                    .totalActiveSuggestions(0)
                    .topRecommendation(null)
                    .dataQualityWarnings(List.of())
                    .nextActions(List.of(
                            "Run setup to link this Shopify store to a Forestock workspace.",
                            "Import catalog and order history after the workspace is linked."
                    ))
                    .build();
        }
        UUID storeId = connection.getStore().getId();

        List<Product> activeProducts = productRepository.findByStoreIdAndActiveTrue(storeId);
        boolean hasSalesHistory = salesTransactionRepository.existsByStoreId(storeId);
        ForecastRun latestCompletedRun = forecastRunRepository
                .findTopByStoreIdAndStatusOrderByFinishedAtDesc(storeId, ForecastStatus.COMPLETED)
                .orElse(null);

        List<OrderSuggestion> activeSuggestions = latestCompletedRun != null
                ? orderSuggestionRepository.findByForecastRunIdAndAcknowledgedOrderByUrgencyAscDaysOfStockAsc(
                        latestCompletedRun.getId(), false)
                : List.of();

        long criticalSuggestions = activeSuggestions.stream()
                .filter(suggestion -> suggestion.getUrgency() == Urgency.CRITICAL)
                .count();
        long highSuggestions = activeSuggestions.stream()
                .filter(suggestion -> suggestion.getUrgency() == Urgency.HIGH)
                .count();

        return AppHomeOverview.builder()
                .shopDomain(connection.getShopDomain())
                .storeName(connection.getStore().getName())
                .shopifyConnectionActive(connection.isActive())
                .activeProductCount(activeProducts.size())
                .hasSalesHistory(hasSalesHistory)
                .forecastStatus(latestCompletedRun != null ? latestCompletedRun.getStatus().name() : null)
                .forecastCompletedAt(latestCompletedRun != null ? latestCompletedRun.getFinishedAt() : null)
                .criticalSuggestions(criticalSuggestions)
                .highSuggestions(highSuggestions)
                .totalActiveSuggestions(activeSuggestions.size())
                .topRecommendation(activeSuggestions.isEmpty() ? null : toRecommendation(activeSuggestions.get(0)))
                .dataQualityWarnings(dashboardService.getDataQualityWarnings(storeId))
                .nextActions(buildNextActions(activeProducts.size(), hasSalesHistory, latestCompletedRun, activeSuggestions))
                .build();
    }

    @Transactional(readOnly = true)
    public RecommendationsPayload getRecommendations(String shopDomain) {
        ShopifyConnection connection = shopifyConnectionRepository.findByShopDomain(shopDomain).orElse(null);
        if (connection == null) {
            return RecommendationsPayload.builder()
                    .shopDomain(shopDomain)
                    .forecastStatus(null)
                    .forecastCompletedAt(null)
                    .recommendations(List.of())
                    .build();
        }
        UUID storeId = connection.getStore().getId();

        ForecastRun latestCompletedRun = forecastRunRepository
                .findTopByStoreIdAndStatusOrderByFinishedAtDesc(storeId, ForecastStatus.COMPLETED)
                .orElse(null);

        if (latestCompletedRun == null) {
            return RecommendationsPayload.builder()
                    .shopDomain(connection.getShopDomain())
                    .forecastStatus(null)
                    .forecastCompletedAt(null)
                    .recommendations(List.of())
                    .build();
        }

        List<RecommendationCard> recommendations = orderSuggestionRepository
                .findByForecastRunIdAndAcknowledgedOrderByUrgencyAscDaysOfStockAsc(latestCompletedRun.getId(), false)
                .stream()
                .limit(20)
                .map(this::toRecommendation)
                .toList();

        return RecommendationsPayload.builder()
                .shopDomain(connection.getShopDomain())
                .forecastStatus(latestCompletedRun.getStatus().name())
                .forecastCompletedAt(latestCompletedRun.getFinishedAt())
                .recommendations(recommendations)
                .build();
    }

    private List<String> buildNextActions(int activeProductCount,
                                          boolean hasSalesHistory,
                                          ForecastRun latestCompletedRun,
                                          List<OrderSuggestion> activeSuggestions) {
        List<String> nextActions = new ArrayList<>();
        if (activeProductCount == 0) {
            nextActions.add("Import or sync products so Forestock has items to forecast.");
        }
        if (!hasSalesHistory) {
            nextActions.add("Bring in sales history before trusting reorder recommendations.");
        }
        if (latestCompletedRun == null) {
            nextActions.add("Run the first completed forecast to unlock reorder guidance.");
        } else if (!activeSuggestions.isEmpty()) {
            nextActions.add("Review the top restocking recommendations and act on urgent items first.");
        } else {
            nextActions.add("No active recommendations right now. Re-check after the next sync or forecast.");
        }
        return nextActions;
    }

    private RecommendationCard toRecommendation(OrderSuggestion suggestion) {
        return RecommendationCard.builder()
                .id(suggestion.getId())
                .productName(suggestion.getProduct().getName())
                .productSku(suggestion.getProduct().getSku())
                .urgency(suggestion.getUrgency().name())
                .daysOfStock(suggestion.getDaysOfStock())
                .suggestedQty(suggestion.getSuggestedQty())
                .estimatedOrderValue(suggestion.getEstimatedOrderValue())
                .supplierName(suggestion.getProduct().getSupplierName())
                .generatedAt(suggestion.getGeneratedAt())
                .build();
    }

    @Builder
    public record AppHomeOverview(
            String shopDomain,
            String storeName,
            boolean shopifyConnectionActive,
            int activeProductCount,
            boolean hasSalesHistory,
            String forecastStatus,
            LocalDateTime forecastCompletedAt,
            long criticalSuggestions,
            long highSuggestions,
            int totalActiveSuggestions,
            RecommendationCard topRecommendation,
            List<String> dataQualityWarnings,
            List<String> nextActions
    ) {
    }

    @Builder
    public record RecommendationsPayload(
            String shopDomain,
            String forecastStatus,
            LocalDateTime forecastCompletedAt,
            List<RecommendationCard> recommendations
    ) {
    }

    @Builder
    public record RecommendationCard(
            UUID id,
            String productName,
            String productSku,
            String urgency,
            BigDecimal daysOfStock,
            BigDecimal suggestedQty,
            BigDecimal estimatedOrderValue,
            String supplierName,
            LocalDateTime generatedAt
    ) {
    }
}
