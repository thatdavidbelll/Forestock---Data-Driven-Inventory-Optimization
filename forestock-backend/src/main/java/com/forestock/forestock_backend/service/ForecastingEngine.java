package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.domain.StoreConfiguration;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Holt-Winters Triple Exponential Smoothing (additive variant).
 *
 * Equations:
 *   Level:      L[t] = α*(y[t] - S[t-m]) + (1-α)*(L[t-1] + T[t-1])
 *   Trend:      T[t] = β*(L[t] - L[t-1])  + (1-β)*T[t-1]
 *   Seasonal:   S[t] = γ*(y[t] - L[t])    + (1-γ)*S[t-m]
 *   Forecast:   F[t+h] = L[t] + h*T[t] + S[t + h - m*⌈h/m⌉]
 *
 * Falls back to Simple Moving Average when history < minHistoryDays.
 */
@Slf4j
@Service
public class ForecastingEngine {

    private static final double MIN_HOLT_WINTERS_DEMAND_DENSITY = 0.35;
    private static final int MIN_HOLT_WINTERS_SEASONS = 3;

    enum ForecastModel {
        ZERO,
        INTERMITTENT_FALLBACK,
        HOLT_WINTERS
    }

    private record HoltWintersParams(double alpha, double beta, double gamma, double holdoutRmse, double sse) {}
    record ForecastComputation(ForecastResult result, ForecastModel model) {}

    public record ForecastResult(double p50Total, double p90Total, List<Double> dailyValues) {}

    /**
     * Forecast for a single product.
     *
     * @param history     daily sales values in chronological order (oldest first)
     * @param horizonDays number of days to forecast
     */
    public ForecastResult forecast(List<Double> history, int horizonDays, StoreConfiguration configuration) {
        return forecastWithModel(history, horizonDays, configuration).result();
    }

    ForecastComputation forecastWithModel(List<Double> history, int horizonDays, StoreConfiguration configuration) {
        if (history == null || history.isEmpty()) {
            return new ForecastComputation(zeroResult(horizonDays), ForecastModel.ZERO);
        }

        double[] data = history.stream().mapToDouble(Double::doubleValue).toArray();
        int minHistoryDays = configuration.getMinHistoryDays();
        int seasonalityPeriod = configuration.getSeasonalityPeriod();
        long observedSalesDays = history.stream().filter(value -> value != null && value > 0).count();
        double demandDensity = data.length == 0 ? 0 : observedSalesDays / (double) data.length;

        if (observedSalesDays < minHistoryDays
                || data.length < MIN_HOLT_WINTERS_SEASONS * seasonalityPeriod
                || demandDensity < MIN_HOLT_WINTERS_DEMAND_DENSITY) {
            log.debug(
                    "History not suitable for Holt-Winters (observedSalesDays={}, density={}), falling back to intermittent demand heuristic",
                    observedSalesDays,
                    demandDensity);
            return new ForecastComputation(intermittentDemandFallback(data, horizonDays), ForecastModel.INTERMITTENT_FALLBACK);
        }

        return selectBestForecast(data, horizonDays, seasonalityPeriod);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Holt-Winters Additive
    // ──────────────────────────────────────────────────────────────────────────

    private ForecastComputation selectBestForecast(double[] data, int horizon, int seasonalityPeriod) {
        int m = seasonalityPeriod;
        int validationWindow = Math.max(m, Math.min(horizon, m * 2));
        HoltWintersParams bestParams = findBestHoltWintersParams(data, m, validationWindow);
        ForecastResult fallbackForecast = intermittentDemandFallback(data, horizon);
        double fallbackHoldoutRmse = computeFallbackHoldoutRmse(data, validationWindow);

        if (fallbackHoldoutRmse <= bestParams.holdoutRmse()) {
            log.debug("Fallback outperformed Holt-Winters on holdout (fallbackRmse={}, hwRmse={})",
                    fallbackHoldoutRmse,
                    bestParams.holdoutRmse());
            return new ForecastComputation(fallbackForecast, ForecastModel.INTERMITTENT_FALLBACK);
        }

        log.debug("Selected Holt-Winters params: α={} β={} γ={} holdoutRmse={} SSE={}",
                bestParams.alpha(),
                bestParams.beta(),
                bestParams.gamma(),
                bestParams.holdoutRmse(),
                bestParams.sse());
        return new ForecastComputation(
                computeForecast(data, bestParams.alpha(), bestParams.beta(), bestParams.gamma(), m, horizon),
                ForecastModel.HOLT_WINTERS);
    }

    private HoltWintersParams findBestHoltWintersParams(double[] data, int m, int validationWindow) {
        double bestAlpha = 0.3;
        double bestBeta = 0.1;
        double bestGamma = 0.2;
        double bestScore = Double.MAX_VALUE;
        double bestSse = Double.MAX_VALUE;

        double[] alphas = {0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9};
        double[] betas  = {0.05, 0.1, 0.2, 0.3, 0.4, 0.5};
        double[] gammas = {0.05, 0.1, 0.2, 0.3, 0.4, 0.5};

        for (double alpha : alphas) {
            for (double beta : betas) {
                for (double gamma : gammas) {
                    double holdoutRmse = computeHoldoutRmse(data, alpha, beta, gamma, m, validationWindow);
                    double sse = computeSse(data, alpha, beta, gamma, m);
                    if (holdoutRmse < bestScore || (holdoutRmse == bestScore && sse < bestSse)) {
                        bestScore = holdoutRmse;
                        bestSse = sse;
                        bestAlpha = alpha;
                        bestBeta = beta;
                        bestGamma = gamma;
                    }
                }
            }
        }

        return new HoltWintersParams(bestAlpha, bestBeta, bestGamma, bestScore, bestSse);
    }

    private double computeHoldoutRmse(double[] data,
                                      double alpha,
                                      double beta,
                                      double gamma,
                                      int m,
                                      int validationWindow) {
        int n = data.length;
        int trainingLength = n - validationWindow;
        if (trainingLength < 2 * m || validationWindow <= 0) {
            return Double.MAX_VALUE;
        }

        double[] training = Arrays.copyOfRange(data, 0, trainingLength);
        double[] actual = Arrays.copyOfRange(data, trainingLength, n);
        ForecastResult validationForecast = computeForecast(training, alpha, beta, gamma, m, validationWindow);

        double squaredError = 0;
        for (int i = 0; i < validationWindow; i++) {
            double diff = validationForecast.dailyValues().get(i) - actual[i];
            squaredError += diff * diff;
        }
        return Math.sqrt(squaredError / validationWindow);
    }

    private double computeFallbackHoldoutRmse(double[] data, int validationWindow) {
        int n = data.length;
        int trainingLength = n - validationWindow;
        if (trainingLength <= 0 || validationWindow <= 0) {
            return Double.MAX_VALUE;
        }

        double[] training = Arrays.copyOfRange(data, 0, trainingLength);
        double[] actual = Arrays.copyOfRange(data, trainingLength, n);
        ForecastResult validationForecast = intermittentDemandFallback(training, validationWindow);

        double squaredError = 0;
        for (int i = 0; i < validationWindow; i++) {
            double diff = validationForecast.dailyValues().get(i) - actual[i];
            squaredError += diff * diff;
        }
        return Math.sqrt(squaredError / validationWindow);
    }

    private double computeSse(double[] data, double alpha, double beta, double gamma, int m) {
        int n = data.length;
        if (n < 2 * m) return Double.MAX_VALUE;

        double[] L = new double[n];
        double[] T = new double[n];
        double[] S = new double[n + m];

        // Initialization
        double sumFirst = 0;
        for (int i = 0; i < m; i++) sumFirst += data[i];
        L[0] = sumFirst / m;

        double sumTrend = 0;
        int periods = Math.min(3, n / m);
        for (int i = 0; i < m; i++) {
            double sumP = 0;
            for (int p = 0; p < periods && (p + 1) * m + i < n; p++) {
                sumP += (data[(p + 1) * m + i] - data[p * m + i]) / m;
            }
            sumTrend += (periods > 0 ? sumP / periods : 0);
        }
        T[0] = sumTrend / m;

        double avgAll = 0;
        for (double v : data) avgAll += v;
        avgAll /= n;
        if (avgAll == 0) avgAll = 1;

        for (int i = 0; i < m; i++) {
            S[i] = data[i] - avgAll;
        }

        // Smooth
        double sse = 0;
        for (int t = 1; t < n; t++) {
            double prev_L = L[t - 1];
            double prev_T = T[t - 1];
            double prev_S = S[t < m ? 0 : t - m];

            L[t] = alpha * (data[t] - prev_S) + (1 - alpha) * (prev_L + prev_T);
            T[t] = beta  * (L[t] - prev_L)    + (1 - beta)  * prev_T;
            S[t + m] = gamma * (data[t] - L[t]) + (1 - gamma) * prev_S;

            double fitted = prev_L + prev_T + prev_S;
            double error  = data[t] - fitted;
            sse += error * error;
        }
        return sse;
    }

    private ForecastResult computeForecast(double[] data, double alpha, double beta, double gamma, int m, int horizon) {
        int n = data.length;
        double[] L = new double[n];
        double[] T = new double[n];
        double[] S = new double[n + m + horizon];

        // Initialization (same as SSE)
        double sumFirst = 0;
        for (int i = 0; i < m; i++) sumFirst += data[i];
        L[0] = sumFirst / m;

        double sumTrend = 0;
        int periods = Math.min(3, n / m);
        for (int i = 0; i < m; i++) {
            double sumP = 0;
            for (int p = 0; p < periods && (p + 1) * m + i < n; p++) {
                sumP += (data[(p + 1) * m + i] - data[p * m + i]) / m;
            }
            sumTrend += (periods > 0 ? sumP / periods : 0);
        }
        T[0] = sumTrend / m;

        double avgAll = 0;
        for (double v : data) avgAll += v;
        avgAll /= n;

        for (int i = 0; i < m; i++) {
            S[i] = data[i] - avgAll;
        }

        // Smooth through history
        for (int t = 1; t < n; t++) {
            double prev_S = S[t < m ? 0 : t - m];
            L[t] = alpha * (data[t] - prev_S)  + (1 - alpha) * (L[t-1] + T[t-1]);
            T[t] = beta  * (L[t] - L[t-1])     + (1 - beta)  * T[t-1];
            S[t + m] = gamma * (data[t] - L[t]) + (1 - gamma) * prev_S;
        }

        double lastL = L[n - 1];
        double lastT = T[n - 1];

        // Generate horizon forecasts
        List<Double> daily = new ArrayList<>(horizon);
        for (int h = 1; h <= horizon; h++) {
            int seasonIdx = n - m + ((h - 1) % m);
            double seasonal = S[seasonIdx];
            double value = Math.max(0, lastL + h * lastT + seasonal);
            daily.add(value);
        }

        double p50Total = daily.stream().mapToDouble(Double::doubleValue).sum();
        double p90Total = p50Total * 1.20;

        return new ForecastResult(p50Total, p90Total, daily);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Simple Moving Average fallback
    // ──────────────────────────────────────────────────────────────────────────

    private ForecastResult intermittentDemandFallback(double[] data, int horizon) {
        int recentWindow = Math.min(data.length, 28);
        int baselineWindow = Math.min(data.length, 84);
        double recentDailyAvg = averageDailyDemand(data, recentWindow);
        double baselineDailyAvg = averageDailyDemand(data, baselineWindow);
        double dailyAvg = (baselineDailyAvg * 0.7) + (recentDailyAvg * 0.3);
        double peakRecentDemand = maxDailyDemand(data, recentWindow);
        double p50Total = dailyAvg * horizon;
        double p90Total = Math.max(p50Total, p50Total + Math.min(peakRecentDemand * 2, p50Total * 0.15));

        List<Double> daily = new ArrayList<>(horizon);
        for (int i = 0; i < horizon; i++) daily.add(dailyAvg);

        return new ForecastResult(p50Total, p90Total, daily);
    }

    private double averageDailyDemand(double[] data, int window) {
        if (data.length == 0 || window <= 0) {
            return 0;
        }

        double sum = 0;
        for (int i = data.length - window; i < data.length; i++) {
            sum += data[i];
        }
        return sum / window;
    }

    private double maxDailyDemand(double[] data, int window) {
        if (data.length == 0 || window <= 0) {
            return 0;
        }

        double max = 0;
        for (int i = data.length - window; i < data.length; i++) {
            max = Math.max(max, data[i]);
        }
        return max;
    }

    private ForecastResult zeroResult(int horizon) {
        List<Double> daily = new ArrayList<>(horizon);
        for (int i = 0; i < horizon; i++) daily.add(0.0);
        return new ForecastResult(0, 0, daily);
    }
}
