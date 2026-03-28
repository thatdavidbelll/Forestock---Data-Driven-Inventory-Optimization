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

    public record ForecastResult(double p50Total, double p90Total, List<Double> dailyValues) {}

    /**
     * Forecast for a single product.
     *
     * @param history     daily sales values in chronological order (oldest first)
     * @param horizonDays number of days to forecast
     */
    public ForecastResult forecast(List<Double> history, int horizonDays, StoreConfiguration configuration) {
        if (history == null || history.isEmpty()) {
            return zeroResult(horizonDays);
        }

        double[] data = history.stream().mapToDouble(Double::doubleValue).toArray();
        int minHistoryDays = configuration.getMinHistoryDays();
        int seasonalityPeriod = configuration.getSeasonalityPeriod();

        if (data.length < minHistoryDays) {
            log.debug("Insufficient history ({} days), falling back to SMA", data.length);
            return simpleMovingAverage(data, horizonDays);
        }

        return holtsWinters(data, horizonDays, seasonalityPeriod);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Holt-Winters Additive
    // ──────────────────────────────────────────────────────────────────────────

    private ForecastResult holtsWinters(double[] data, int horizon, int seasonalityPeriod) {
        int m = seasonalityPeriod;

        // Grid search for best alpha/beta/gamma
        double bestAlpha = 0.3, bestBeta = 0.1, bestGamma = 0.2;
        double bestSse = Double.MAX_VALUE;

        double[] alphas = {0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9};
        double[] betas  = {0.05, 0.1, 0.2, 0.3, 0.4, 0.5};
        double[] gammas = {0.05, 0.1, 0.2, 0.3, 0.4, 0.5};

        for (double alpha : alphas) {
            for (double beta : betas) {
                for (double gamma : gammas) {
                    double sse = computeSse(data, alpha, beta, gamma, m);
                    if (sse < bestSse) {
                        bestSse = sse;
                        bestAlpha = alpha;
                        bestBeta = beta;
                        bestGamma = gamma;
                    }
                }
            }
        }

        log.debug("Holt-Winters params: α={} β={} γ={} SSE={}", bestAlpha, bestBeta, bestGamma, bestSse);
        return computeForecast(data, bestAlpha, bestBeta, bestGamma, m, horizon);
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

    private ForecastResult simpleMovingAverage(double[] data, int horizon) {
        int window = Math.min(data.length, 14);
        double sum = 0;
        for (int i = data.length - window; i < data.length; i++) sum += data[i];
        double dailyAvg = sum / window;

        List<Double> daily = new ArrayList<>(horizon);
        for (int i = 0; i < horizon; i++) daily.add(dailyAvg);

        double p50Total = dailyAvg * horizon;
        double p90Total = p50Total * 1.20;
        return new ForecastResult(p50Total, p90Total, daily);
    }

    private ForecastResult zeroResult(int horizon) {
        List<Double> daily = new ArrayList<>(horizon);
        for (int i = 0; i < horizon; i++) daily.add(0.0);
        return new ForecastResult(0, 0, daily);
    }
}
