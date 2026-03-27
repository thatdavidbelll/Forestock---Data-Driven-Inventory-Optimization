package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.domain.ForecastRun;
import com.forestock.forestock_backend.domain.OrderSuggestion;
import com.forestock.forestock_backend.domain.Product;
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
 * Quantity formula:  suggestedQty = max(0, p90 × 1.20 − currentStock), rounded up
 * Urgency formula:   daysOfStock  = currentStock / (p50 / horizonDays)
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
            int horizonDays) {

        List<OrderSuggestion> suggestions = new ArrayList<>();

        for (Product product : products) {
            ForecastResult forecast = forecastMap.get(product.getId());
            if (forecast == null) {
                log.debug("No forecast for product {}, skipping", product.getSku());
                continue;
            }

            BigDecimal currentStock = currentStockMap.getOrDefault(product.getId(), BigDecimal.ZERO);
            BigDecimal p50 = BigDecimal.valueOf(forecast.p50Total());
            BigDecimal p90 = BigDecimal.valueOf(forecast.p90Total());

            // suggestedQty = max(0, p90 - currentStock), rounded up to integer
            BigDecimal suggested = p90.subtract(currentStock);
            if (suggested.compareTo(BigDecimal.ZERO) < 0) suggested = BigDecimal.ZERO;
            suggested = suggested.setScale(0, RoundingMode.CEILING);

            // daysOfStock = currentStock / dailyDemand
            BigDecimal dailyDemand = p50.divide(BigDecimal.valueOf(horizonDays), 4, RoundingMode.HALF_UP);
            BigDecimal daysOfStock;
            if (dailyDemand.compareTo(BigDecimal.ZERO) == 0) {
                daysOfStock = BigDecimal.valueOf(999);
            } else {
                daysOfStock = currentStock.divide(dailyDemand, 2, RoundingMode.HALF_UP);
            }

            Urgency urgency = computeUrgency(daysOfStock);

            OrderSuggestion suggestion = OrderSuggestion.builder()
                    .store(forecastRun.getStore())
                    .product(product)
                    .forecastRun(forecastRun)
                    .suggestedQty(suggested)
                    .forecastP50(p50.setScale(2, RoundingMode.HALF_UP))
                    .forecastP90(p90.setScale(2, RoundingMode.HALF_UP))
                    .currentStock(currentStock)
                    .daysOfStock(daysOfStock)
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

    private Urgency computeUrgency(BigDecimal daysOfStock) {
        double days = daysOfStock.doubleValue();
        if (days < 2)  return Urgency.CRITICAL;
        if (days < 5)  return Urgency.HIGH;
        if (days < 10) return Urgency.MEDIUM;
        return Urgency.LOW;
    }
}
