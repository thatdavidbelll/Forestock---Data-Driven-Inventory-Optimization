package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.domain.StoreConfiguration;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class ForecastingEngineTest {

    private final ForecastingEngine forecastingEngine = new ForecastingEngine();

    @Test
    void forecast_uses_holt_winters_for_dense_stable_history() {
        StoreConfiguration configuration = StoreConfiguration.builder()
                .minHistoryDays(30)
                .seasonalityPeriod(7)
                .safetyStockMultiplier(BigDecimal.valueOf(1.20))
                .build();

        List<Double> history = new ArrayList<>();
        for (int i = 0; i < 84; i++) {
            history.add(10.0);
        }

        ForecastingEngine.ForecastResult result = forecastingEngine.forecast(history, 14, configuration);

        assertThat(result.dailyValues()).hasSize(14);
        assertThat(result.p50Total()).isBetween(120.0, 160.0);
        assertThat(result.p90Total()).isGreaterThanOrEqualTo(result.p50Total());
    }

    @Test
    void forecast_uses_conservative_fallback_for_sparse_intermittent_history() {
        StoreConfiguration configuration = StoreConfiguration.builder()
                .minHistoryDays(30)
                .seasonalityPeriod(7)
                .safetyStockMultiplier(BigDecimal.valueOf(1.20))
                .build();

        List<Double> history = new ArrayList<>();
        for (int i = 0; i < 365; i++) {
            history.add(i >= 351 && (i - 351) % 7 == 0 ? 1.0 : 0.0);
        }

        ForecastingEngine.ForecastResult result = forecastingEngine.forecast(history, 14, configuration);

        assertThat(result.dailyValues()).hasSize(14);
        assertThat(result.p50Total()).isLessThan(3.0);
        assertThat(result.p90Total()).isLessThan(5.0);
    }

    @Test
    void forecast_uses_fallback_when_history_does_not_cover_three_full_seasons() {
        StoreConfiguration configuration = StoreConfiguration.builder()
                .minHistoryDays(14)
                .seasonalityPeriod(7)
                .safetyStockMultiplier(BigDecimal.valueOf(1.20))
                .build();

        List<Double> history = new ArrayList<>();
        for (int i = 0; i < 20; i++) {
            history.add(10.0);
        }

        ForecastingEngine.ForecastResult result = forecastingEngine.forecast(history, 14, configuration);

        assertThat(result.dailyValues()).hasSize(14);
        assertThat(result.p50Total()).isEqualTo(140.0);
        assertThat(result.p90Total()).isEqualTo(160.0);
    }

    @Test
    void forecast_prefers_fallback_when_holdout_is_better_than_holt_winters() {
        StoreConfiguration configuration = StoreConfiguration.builder()
                .minHistoryDays(14)
                .seasonalityPeriod(7)
                .safetyStockMultiplier(BigDecimal.valueOf(1.20))
                .build();

        List<Double> history = new ArrayList<>();
        for (int i = 0; i < 70; i++) {
            history.add(i < 56 ? 10.0 : 0.0);
        }

        ForecastingEngine.ForecastResult result = forecastingEngine.forecast(history, 14, configuration);

        assertThat(result.dailyValues()).hasSize(14);
        assertThat(result.p50Total()).isCloseTo(99.4, within(0.0001));
        assertThat(result.p90Total()).isCloseTo(114.31, within(0.0001));
    }

    @Test
    void forecast_with_model_exposes_selected_model() {
        StoreConfiguration configuration = StoreConfiguration.builder()
                .minHistoryDays(30)
                .seasonalityPeriod(7)
                .safetyStockMultiplier(BigDecimal.valueOf(1.20))
                .build();

        List<Double> history = new ArrayList<>();
        for (int i = 0; i < 84; i++) {
            history.add(10.0);
        }

        ForecastingEngine.ForecastComputation computation =
                forecastingEngine.forecastWithModel(history, 14, configuration);

        assertThat(computation.model()).isEqualTo(ForecastingEngine.ForecastModel.INTERMITTENT_FALLBACK);
        assertThat(computation.result().dailyValues()).hasSize(14);
    }
}
