package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.domain.ForecastAccuracyResult;
import com.forestock.forestock_backend.domain.ForecastRun;
import com.forestock.forestock_backend.domain.OrderSuggestion;
import com.forestock.forestock_backend.domain.Store;
import com.forestock.forestock_backend.domain.enums.ForecastStatus;
import com.forestock.forestock_backend.repository.ForecastAccuracyResultRepository;
import com.forestock.forestock_backend.repository.ForecastRunRepository;
import com.forestock.forestock_backend.repository.OrderSuggestionRepository;
import com.forestock.forestock_backend.repository.SalesTransactionRepository;
import com.forestock.forestock_backend.repository.StoreRepository;
import lombok.Builder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ForecastAccuracyService {

    private final ForecastRunRepository forecastRunRepository;
    private final ForecastAccuracyResultRepository forecastAccuracyResultRepository;
    private final OrderSuggestionRepository orderSuggestionRepository;
    private final SalesTransactionRepository salesTransactionRepository;
    private final StoreRepository storeRepository;

    @Transactional
    public void evaluateCompletedForecasts(UUID storeId) {
        Store store = storeRepository.findById(storeId).orElse(null);
        if (store == null || !Boolean.TRUE.equals(store.getActive())) {
            return;
        }

        List<ForecastRun> runs = forecastRunRepository.findEvaluableRunsByStore(
                storeId,
                ForecastStatus.COMPLETED,
                LocalDateTime.now().minusDays(1)
        );

        for (ForecastRun run : runs) {
            LocalDate periodStart = run.getFinishedAt() != null
                    ? run.getFinishedAt().toLocalDate()
                    : LocalDate.now().minusDays(run.getHorizonDays());
            LocalDate periodEnd = periodStart.plusDays(run.getHorizonDays() - 1L);

            if (periodEnd.isAfter(LocalDate.now())) {
                continue;
            }
            if (forecastAccuracyResultRepository.existsByForecastRunId(run.getId())) {
                continue;
            }

            List<OrderSuggestion> suggestions = orderSuggestionRepository
                    .findByForecastRunIdOrderByUrgencyAscDaysOfStockAsc(run.getId());

            List<ForecastAccuracyResult> results = new ArrayList<>();
            Map<String, List<BigDecimal>> mapeByModel = new HashMap<>();
            for (OrderSuggestion suggestion : suggestions) {
                BigDecimal predicted = suggestion.getForecastP50();
                if (predicted == null) {
                    continue;
                }

                BigDecimal actual = salesTransactionRepository
                        .findByProductIdAndSaleDateBetweenOrderBySaleDateAsc(
                                suggestion.getProduct().getId(),
                                periodStart,
                                periodEnd
                        )
                        .stream()
                        .map(tx -> tx.getQuantitySold())
                        .reduce(BigDecimal.ZERO, BigDecimal::add)
                        .setScale(2, RoundingMode.HALF_UP);

                BigDecimal mape = null;
                if (actual.compareTo(BigDecimal.ZERO) > 0) {
                    mape = predicted.subtract(actual)
                            .abs()
                            .divide(actual, 4, RoundingMode.HALF_UP)
                            .multiply(BigDecimal.valueOf(100))
                            .setScale(2, RoundingMode.HALF_UP);
                    String forecastModel = suggestion.getForecastModel() != null
                            ? suggestion.getForecastModel()
                            : "UNKNOWN";
                    mapeByModel.computeIfAbsent(forecastModel, ignored -> new ArrayList<>()).add(mape);
                }

                results.add(ForecastAccuracyResult.builder()
                        .store(store)
                        .forecastRun(run)
                        .product(suggestion.getProduct())
                        .evaluationDate(LocalDate.now())
                        .forecastPeriodStart(periodStart)
                        .forecastPeriodEnd(periodEnd)
                        .predictedTotal(predicted.setScale(2, RoundingMode.HALF_UP))
                        .actualTotal(actual)
                        .mape(mape)
                        .evaluatedAt(LocalDateTime.now())
                        .build());
            }

            if (!results.isEmpty()) {
                forecastAccuracyResultRepository.saveAll(results);
                computeStoreLevelMape(run);
                log.info("Evaluated forecast accuracy for run {} with {} product results", run.getId(), results.size());
                if (!mapeByModel.isEmpty()) {
                    log.info("Forecast accuracy by model for run {} — {}", run.getId(), summariseMapeByModel(mapeByModel));
                }
            }
        }
    }

    @Transactional
    public void computeStoreLevelMape(ForecastRun run) {
        List<ForecastAccuracyResult> results = forecastAccuracyResultRepository.findEvaluatedByForecastRunId(run.getId());
        List<BigDecimal> mapes = results.stream()
                .map(ForecastAccuracyResult::getMape)
                .filter(value -> value != null)
                .toList();

        if (mapes.isEmpty()) {
            return;
        }

        BigDecimal totalMape = mapes.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal averageMape = totalMape
                .divide(BigDecimal.valueOf(mapes.size()), 2, RoundingMode.HALF_UP);

        BigDecimal squaredErrorMean = results.stream()
                .filter(result -> result.getActualTotal() != null)
                .map(result -> result.getPredictedTotal().subtract(result.getActualTotal()))
                .map(diff -> diff.multiply(diff))
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(BigDecimal.valueOf(results.size()), 4, RoundingMode.HALF_UP);

        run.setMape(averageMape);
        run.setRmse(BigDecimal.valueOf(Math.sqrt(squaredErrorMean.doubleValue())).setScale(4, RoundingMode.HALF_UP));
        forecastRunRepository.save(run);
    }

    @Transactional(readOnly = true)
    public ModelPerformance getModelPerformance(UUID forecastRunId) {
        List<OrderSuggestion> suggestions = orderSuggestionRepository
                .findByForecastRunIdOrderByUrgencyAscDaysOfStockAsc(forecastRunId);
        Map<UUID, String> modelByProductId = suggestions.stream()
                .filter(suggestion -> suggestion.getProduct() != null)
                .collect(Collectors.toMap(
                        suggestion -> suggestion.getProduct().getId(),
                        suggestion -> suggestion.getForecastModel() != null ? suggestion.getForecastModel() : "UNKNOWN",
                        (left, right) -> left
                ));

        Map<String, Long> modelUsage = suggestions.stream()
                .collect(Collectors.groupingBy(
                        suggestion -> suggestion.getForecastModel() != null ? suggestion.getForecastModel() : "UNKNOWN",
                        Collectors.counting()
                ));

        List<ForecastAccuracyResult> results = forecastAccuracyResultRepository.findEvaluatedByForecastRunId(forecastRunId);
        Map<String, List<BigDecimal>> mapeByModel = new HashMap<>();
        for (ForecastAccuracyResult result : results) {
            if (result.getMape() == null || result.getProduct() == null) {
                continue;
            }
            String forecastModel = modelByProductId.getOrDefault(result.getProduct().getId(), "UNKNOWN");
            mapeByModel.computeIfAbsent(forecastModel, ignored -> new ArrayList<>()).add(result.getMape());
        }

        return new ModelPerformance(modelUsage, summariseMapeByModel(mapeByModel));
    }

    @Transactional(readOnly = true)
    public AccuracyScore getDashboardAccuracy(UUID storeId) {
        List<ForecastAccuracyResult> recent = forecastAccuracyResultRepository.findRecentEvaluatedByStore(
                storeId,
                LocalDate.now().minusDays(30)
        );

        if (recent.isEmpty()) {
            return AccuracyScore.builder()
                    .lastRunMape(null)
                    .trend("pending")
                    .evaluatedForecasts(0)
                    .build();
        }

        List<ForecastRun> recentRuns = forecastRunRepository.findByStoreIdOrderByStartedAtDesc(storeId).stream()
                .filter(run -> run.getMape() != null)
                .limit(5)
                .toList();

        BigDecimal lastRunMape = recentRuns.isEmpty() ? null : recentRuns.getFirst().getMape();
        String trend = "stable";
        if (recentRuns.size() >= 2) {
            BigDecimal newest = recentRuns.get(0).getMape();
            BigDecimal oldest = recentRuns.get(recentRuns.size() - 1).getMape();
            int comparison = newest.compareTo(oldest);
            trend = comparison < 0 ? "improving" : comparison > 0 ? "declining" : "stable";
        }

        return AccuracyScore.builder()
                .lastRunMape(lastRunMape)
                .trend(trend)
                .evaluatedForecasts(recentRuns.size())
                .build();
    }

    private Map<String, BigDecimal> summariseMapeByModel(Map<String, List<BigDecimal>> mapeByModel) {
        Map<String, BigDecimal> summary = new HashMap<>();
        for (Map.Entry<String, List<BigDecimal>> entry : mapeByModel.entrySet()) {
            BigDecimal total = entry.getValue().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
            summary.put(
                    entry.getKey(),
                    total.divide(BigDecimal.valueOf(entry.getValue().size()), 2, RoundingMode.HALF_UP)
            );
        }
        return summary;
    }

    public record ModelPerformance(Map<String, Long> modelUsage, Map<String, BigDecimal> modelMape) {}

    @Builder
    public record AccuracyScore(BigDecimal lastRunMape, String trend, int evaluatedForecasts) {}
}
