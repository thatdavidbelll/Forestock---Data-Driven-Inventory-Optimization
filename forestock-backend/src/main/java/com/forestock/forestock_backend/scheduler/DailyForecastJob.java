package com.forestock.forestock_backend.scheduler;

import com.forestock.forestock_backend.domain.enums.ForecastStatus;
import com.forestock.forestock_backend.domain.Store;
import com.forestock.forestock_backend.repository.ForecastRunRepository;
import com.forestock.forestock_backend.repository.StoreRepository;
import com.forestock.forestock_backend.service.ForecastOrchestrator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Nightly scheduled job — triggers the full forecast cycle at 02:00.
 * Guard against parallel runs is handled inside ForecastOrchestrator.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DailyForecastJob {

    private final ForecastOrchestrator forecastOrchestrator;
    private final StoreRepository storeRepository;
    private final ForecastRunRepository forecastRunRepository;

    @Scheduled(cron = "0 0 2 * * *", zone = "UTC")
    public void runNightlyForecast() {
        log.info("[Scheduler] Starting nightly forecast cycle");
        storeRepository.findAll().stream()
                .filter(store -> Boolean.TRUE.equals(store.getActive()))
                .forEach(store -> {
                    UUID storeId = store.getId();
                    if (forecastRunRepository.existsByStoreIdAndStatus(storeId, ForecastStatus.RUNNING)) {
                        log.info("[Scheduler] Skipping store {} — forecast already running", storeId);
                        return;
                    }
                    try {
                        forecastOrchestrator.runForecast(storeId, "SCHEDULED");
                        log.info("[Scheduler] Triggered forecast for store {}", storeId);
                    } catch (Exception e) {
                        log.error("[Scheduler] Failed to trigger forecast for store {}: {}", storeId, e.getMessage());
                    }
                });
    }
}
