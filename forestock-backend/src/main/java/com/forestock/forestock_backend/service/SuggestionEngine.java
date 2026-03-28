package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.domain.ForecastRun;
import com.forestock.forestock_backend.domain.OrderSuggestion;
import com.forestock.forestock_backend.domain.Product;
import com.forestock.forestock_backend.domain.StoreConfiguration;
import com.forestock.forestock_backend.domain.Store;
import com.forestock.forestock_backend.domain.enums.Urgency;
import com.forestock.forestock_backend.repository.OrderSuggestionRepository;
import com.forestock.forestock_backend.service.ForecastingEngine.ForecastResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Calculates restocking suggestions from forecast results.
 *
 * Quantity formula:  suggestedQty = max(0, p90 + leadTimeBuffer - currentStock)
 *                    rounded up to MOQ multiple when set, otherwise to integer
 * Urgency formula:   adjustedDaysOfStock = daysOfStock - leadTimeDays
 *   < 2  days → CRITICAL
 *   2–5  days → HIGH
 *   5–10 days → MEDIUM
 *   > 10 days → LOW
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SuggestionEngine {

    private final OrderSuggestionRepository suggestionRepository;

    @Transactional
    public List<OrderSuggestion> generate(
            List<Product> products,
            Map<UUID, BigDecimal> currentStockMap,
            Map<UUID, ForecastResult> forecastMap,
            ForecastRun forecastRun,
            int horizonDays,
            StoreConfiguration configuration) {

        List<OrderSuggestion> suggestions = new ArrayList<>();
        BigDecimal safetyStockMultiplier = configuration.getSafetyStockMultiplier();

        for (Product product : products) {
            ForecastResult forecast = forecastMap.get(product.getId());
            if (forecast == null) {
                log.debug("No forecast for product {}, skipping", product.getSku());
                continue;
            }

            BigDecimal currentStock = currentStockMap.getOrDefault(product.getId(), BigDecimal.ZERO);
            BigDecimal p50 = BigDecimal.valueOf(forecast.p50Total());
            BigDecimal p90 = p50.multiply(safetyStockMultiplier).setScale(2, RoundingMode.HALF_UP);
            int leadTimeDays = product.getLeadTimeDays() != null ? product.getLeadTimeDays() : 0;

            BigDecimal dailyDemand = p50.divide(BigDecimal.valueOf(horizonDays), 4, RoundingMode.HALF_UP);
            BigDecimal leadTimeBuffer = dailyDemand.multiply(BigDecimal.valueOf(leadTimeDays));
            BigDecimal effectiveTarget = p90.add(leadTimeBuffer);
            BigDecimal rawSuggested = effectiveTarget.subtract(currentStock);
            if (rawSuggested.compareTo(BigDecimal.ZERO) < 0) rawSuggested = BigDecimal.ZERO;

            BigDecimal moqApplied = null;
            BigDecimal suggested;
            if (product.getMinimumOrderQty() != null
                    && product.getMinimumOrderQty().compareTo(BigDecimal.ZERO) > 0
                    && rawSuggested.compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal moq = product.getMinimumOrderQty();
                BigDecimal multiplier = rawSuggested.divide(moq, 0, RoundingMode.CEILING);
                suggested = moq.multiply(multiplier).setScale(2, RoundingMode.HALF_UP);
                if (suggested.compareTo(rawSuggested.setScale(2, RoundingMode.HALF_UP)) > 0) {
                    moqApplied = moq.setScale(2, RoundingMode.HALF_UP);
                }
            } else {
                suggested = rawSuggested.setScale(0, RoundingMode.CEILING).setScale(2, RoundingMode.HALF_UP);
            }

            // daysOfStock = currentStock / dailyDemand
            BigDecimal daysOfStock;
            if (dailyDemand.compareTo(BigDecimal.ZERO) == 0) {
                daysOfStock = BigDecimal.valueOf(999);
            } else {
                daysOfStock = currentStock.divide(dailyDemand, 2, RoundingMode.HALF_UP);
            }

            BigDecimal adjustedDaysOfStock = daysOfStock.subtract(BigDecimal.valueOf(leadTimeDays));
            Urgency urgency = computeUrgency(adjustedDaysOfStock, configuration);
            BigDecimal estimatedOrderValue = product.getUnitCost() != null
                    ? suggested.multiply(product.getUnitCost()).setScale(2, RoundingMode.HALF_UP)
                    : null;

            OrderSuggestion suggestion = OrderSuggestion.builder()
                    .store(forecastRun.getStore())
                    .product(product)
                    .forecastRun(forecastRun)
                    .suggestedQty(suggested)
                    .forecastP50(p50.setScale(2, RoundingMode.HALF_UP))
                    .forecastP90(p90.setScale(2, RoundingMode.HALF_UP))
                    .currentStock(currentStock)
                    .daysOfStock(daysOfStock)
                    .leadTimeDaysAtGeneration(leadTimeDays)
                    .moqApplied(moqApplied)
                    .estimatedOrderValue(estimatedOrderValue)
                    .urgency(urgency)
                    .build();

            suggestions.add(suggestion);
        }

        // Sort: CRITICAL first, then by daysOfStock ASC
        suggestions.sort(Comparator
                .comparingInt((OrderSuggestion s) -> s.getUrgency().getPriority())
                .thenComparing(s -> s.getDaysOfStock()));

        suggestionRepository.saveAll(suggestions);
        log.info("Generated and saved {} suggestions (run {})", suggestions.size(), forecastRun.getId());
        return suggestions;
    }

    @Transactional
    public List<OrderSuggestion> generate(
            List<Product> products,
            Map<UUID, BigDecimal> currentStockMap,
            Map<UUID, ForecastResult> forecastMap,
            ForecastRun forecastRun,
            int horizonDays) {
        StoreConfiguration fallbackConfiguration = StoreConfiguration.builder()
                .store(forecastRun.getStore() != null ? forecastRun.getStore() : Store.builder().build())
                .build();
        return generate(products, currentStockMap, forecastMap, forecastRun, horizonDays, fallbackConfiguration);
    }

    private Urgency computeUrgency(BigDecimal daysOfStock, StoreConfiguration configuration) {
        double days = daysOfStock.doubleValue();
        if (days < configuration.getUrgencyCriticalDays()) return Urgency.CRITICAL;
        if (days < configuration.getUrgencyHighDays()) return Urgency.HIGH;
        if (days < configuration.getUrgencyMediumDays()) return Urgency.MEDIUM;
        return Urgency.LOW;
    }
}
