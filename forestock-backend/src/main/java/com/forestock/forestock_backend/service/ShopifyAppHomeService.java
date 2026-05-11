package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.dto.response.SuggestionDto;
import com.forestock.forestock_backend.domain.ForecastRun;
import com.forestock.forestock_backend.domain.OrderSuggestion;
import com.forestock.forestock_backend.domain.ShopifyConnection;
import com.forestock.forestock_backend.domain.enums.StorePlanTier;
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

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
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
    private final StorePlanService storePlanService;

    @Transactional(readOnly = true)
    public AppHomeOverview getOverview(String shopDomain) {
        ShopifyConnection connection = shopifyConnectionRepository.findByShopDomain(shopDomain).orElse(null);
        if (connection == null) {
            return AppHomeOverview.builder()
                    .shopDomain(shopDomain)
                    .storeName(null)
                    .shopifyConnectionActive(false)
                    .planTier(null)
                    .productLimit(null)
                    .remainingProductSlots(null)
                    .overProductLimit(false)
                    .planMessage(null)
                    .planChoiceConfirmed(false)
                    .activeProductCount(0)
                    .totalProductCount(0)
                    .hasSalesHistory(false)
                    .salesTransactionCount(0)
                    .latestSaleDate(null)
                    .forecastStatus(null)
                    .forecastCompletedAt(null)
                    .lastForecastStartedAt(null)
                    .forecastProof(null)
                    .recommendationReadinessReasons(List.of(
                            "The Shopify store is not linked to a Forestock workspace yet.",
                            "No catalog or order history has been imported yet.",
                            "No forecast run exists for this store."
                    ))
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

        long totalProductCount = productRepository.countByStoreId(storeId);
        long activeProductCount = productRepository.countByStoreIdAndActiveTrue(storeId);
        boolean hasSalesHistory = salesTransactionRepository.existsByStoreId(storeId);
        long salesTransactionCount = salesTransactionRepository.countByStoreId(storeId);
        LocalDate latestSaleDate = salesTransactionRepository.findLatestSaleDateForStore(storeId);

        ForecastRun latestRun = forecastRunRepository
                .findTopByStoreIdOrderByStartedAtDesc(storeId)
                .orElse(null);
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
        StorePlanService.PlanSnapshot planSnapshot = storePlanService.getPlanForStore(storeId);

        List<String> readinessReasons = buildRecommendationReadinessReasons(
                connection.isActive(),
                (int) activeProductCount,
                hasSalesHistory,
                latestRun,
                latestCompletedRun,
                activeSuggestions.size(),
                planSnapshot
        );

        return AppHomeOverview.builder()
                .shopDomain(connection.getShopDomain())
                .storeName(connection.getStore().getName())
                .shopifyConnectionActive(connection.isActive())
                .planTier(planSnapshot.planTier().name())
                .productLimit(planSnapshot.productLimit())
                .remainingProductSlots(planSnapshot.remainingProductSlots())
                .overProductLimit(planSnapshot.overProductLimit())
                .planMessage(planSnapshot.statusMessage())
                .planChoiceConfirmed(planSnapshot.planChoiceConfirmed())
                .activeProductCount((int) activeProductCount)
                .totalProductCount((int) totalProductCount)
                .hasSalesHistory(hasSalesHistory)
                .salesTransactionCount((int) salesTransactionCount)
                .latestSaleDate(latestSaleDate)
                .forecastStatus(latestRun != null ? latestRun.getStatus().name() : null)
                .forecastCompletedAt(toUtcOffset(latestCompletedRun != null ? latestCompletedRun.getFinishedAt() : null))
                .lastForecastStartedAt(toUtcOffset(latestRun != null ? latestRun.getStartedAt() : null))
                .forecastProof(toForecastProof(latestRun, activeSuggestions.isEmpty() ? latestCompletedRun != null && readinessReasons.isEmpty() : readinessReasons.isEmpty()))
                .recommendationReadinessReasons(readinessReasons)
                .criticalSuggestions(criticalSuggestions)
                .highSuggestions(highSuggestions)
                .totalActiveSuggestions(activeSuggestions.size())
                .topRecommendation(activeSuggestions.isEmpty() ? null : toRecommendation(activeSuggestions.get(0)))
                .dataQualityWarnings(dashboardService.getDataQualityWarnings(storeId))
                .nextActions(buildNextActions((int) activeProductCount, hasSalesHistory, latestCompletedRun, activeSuggestions))
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

        List<SuggestionDto> recommendations = orderSuggestionRepository
                .findByForecastRunIdAndAcknowledgedOrderByUrgencyAscDaysOfStockAsc(latestCompletedRun.getId(), false)
                .stream()
                .limit(20)
                .map(this::toRecommendation)
                .toList();

        return RecommendationsPayload.builder()
                .shopDomain(connection.getShopDomain())
                .forecastStatus(latestCompletedRun.getStatus().name())
                .forecastCompletedAt(toUtcOffset(latestCompletedRun.getFinishedAt()))
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

    private List<String> buildRecommendationReadinessReasons(boolean connectionActive,
                                                             int activeProductCount,
                                                             boolean hasSalesHistory,
                                                             ForecastRun latestRun,
                                                             ForecastRun latestCompletedRun,
                                                             int activeSuggestionCount,
                                                             StorePlanService.PlanSnapshot planSnapshot) {
        List<String> reasons = new ArrayList<>();

        if (!connectionActive) {
            reasons.add("The Shopify connection is inactive.");
        }
        if (planSnapshot.statusMessage() != null) {
            reasons.add(planSnapshot.statusMessage());
        }
        if (activeProductCount == 0) {
            reasons.add("No active products are available in Forestock yet.");
        }
        if (!hasSalesHistory) {
            reasons.add("Sales history is missing, so demand signals are weak or absent.");
        }
        if (latestRun == null) {
            reasons.add("No forecast run has started for this store yet.");
            return reasons;
        }
        if (latestRun.getStatus() == ForecastStatus.RUNNING) {
            reasons.add("A forecast is currently running; recommendations may not be ready yet.");
        }
        if (latestRun.getStatus() == ForecastStatus.FAILED) {
            reasons.add("The latest forecast run failed and should be inspected before trusting recommendations.");
        }
        if (latestCompletedRun == null) {
            reasons.add("No completed forecast exists yet.");
        }
        if (latestCompletedRun != null && activeSuggestionCount == 0) {
            reasons.add("A forecast completed, but it did not produce active reorder suggestions.");
        }

        return reasons;
    }

    private ForecastProof toForecastProof(ForecastRun run, boolean readyForRecommendations) {
        if (run == null) {
            return null;
        }

        return ForecastProof.builder()
                .status(run.getStatus() != null ? run.getStatus().name() : null)
                .startedAt(toUtcOffset(run.getStartedAt()))
                .finishedAt(toUtcOffset(run.getFinishedAt()))
                .durationSeconds(run.getDurationSeconds())
                .productsProcessed(run.getProductsProcessed())
                .productsWithInsufficientData(run.getProductsWithInsufficientData())
                .horizonDays(run.getHorizonDays())
                .triggeredBy(run.getTriggeredBy())
                .errorMessage(run.getErrorMessage())
                .readyForRecommendations(readyForRecommendations)
                .build();
    }

    private SuggestionDto toRecommendation(OrderSuggestion suggestion) {
        return SuggestionDto.builder()
                .id(suggestion.getId())
                .productId(suggestion.getProduct().getId())
                .productName(suggestion.getProduct().getName())
                .productSku(suggestion.getProduct().getSku())
                .productImageUrl(suggestion.getProduct().getProductImageUrl())
                .productCategory(suggestion.getProduct().getCategory())
                .unit(suggestion.getProduct().getUnit())
                .urgency(suggestion.getUrgency())
                .daysOfStock(suggestion.getDaysOfStock())
                .suggestedQty(suggestion.getSuggestedQty())
                .forecastP50(suggestion.getForecastP50())
                .forecastP90(suggestion.getForecastP90())
                .currentStock(suggestion.getCurrentStock())
                .leadTimeDaysAtGeneration(suggestion.getLeadTimeDaysAtGeneration())
                .moqApplied(suggestion.getMoqApplied())
                .estimatedOrderValue(suggestion.getEstimatedOrderValue())
                .supplierName(suggestion.getProduct().getSupplierName())
                .lowConfidence(Boolean.TRUE.equals(suggestion.getLowConfidence()))
                .forecastModel(suggestion.getForecastModel())
                .historyDaysAtGeneration(suggestion.getHistoryDaysAtGeneration())
                .acknowledged(Boolean.TRUE.equals(suggestion.getAcknowledged()))
                .acknowledgedAt(toUtcOffset(suggestion.getAcknowledgedAt()))
                .acknowledgedReason(suggestion.getAcknowledgedReason())
                .quantityOrdered(suggestion.getQuantityOrdered())
                .expectedDelivery(suggestion.getExpectedDelivery())
                .orderReference(suggestion.getOrderReference())
                .generatedAt(toUtcOffset(suggestion.getGeneratedAt()))
                .build();
    }

    private OffsetDateTime toUtcOffset(LocalDateTime value) {
        return value != null ? value.atOffset(ZoneOffset.UTC) : null;
    }

    @Builder
    public record AppHomeOverview(
            String shopDomain,
            String storeName,
            boolean shopifyConnectionActive,
            String planTier,
            Integer productLimit,
            Integer remainingProductSlots,
            boolean overProductLimit,
            String planMessage,
            boolean planChoiceConfirmed,
            int activeProductCount,
            int totalProductCount,
            boolean hasSalesHistory,
            int salesTransactionCount,
            LocalDate latestSaleDate,
            String forecastStatus,
            OffsetDateTime forecastCompletedAt,
            OffsetDateTime lastForecastStartedAt,
            ForecastProof forecastProof,
            List<String> recommendationReadinessReasons,
            long criticalSuggestions,
            long highSuggestions,
            int totalActiveSuggestions,
            SuggestionDto topRecommendation,
            List<String> dataQualityWarnings,
            List<String> nextActions
    ) {
    }

    @Builder
    public record ForecastProof(
            String status,
            OffsetDateTime startedAt,
            OffsetDateTime finishedAt,
            Integer durationSeconds,
            Integer productsProcessed,
            Integer productsWithInsufficientData,
            Integer horizonDays,
            String triggeredBy,
            String errorMessage,
            boolean readyForRecommendations
    ) {
    }

    @Builder
    public record RecommendationsPayload(
            String shopDomain,
            String forecastStatus,
            OffsetDateTime forecastCompletedAt,
            List<SuggestionDto> recommendations
    ) {
    }
}
