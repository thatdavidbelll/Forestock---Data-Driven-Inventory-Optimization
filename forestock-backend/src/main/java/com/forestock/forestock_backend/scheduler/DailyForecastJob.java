package com.forestock.forestock_backend.scheduler;

import com.forestock.forestock_backend.domain.Store;
import com.forestock.forestock_backend.repository.StoreRepository;
import com.forestock.forestock_backend.service.ForecastAccuracyService;
import com.forestock.forestock_backend.service.ForecastOrchestrator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Nightly scheduled job — triggers the full forecast cycle at 02:00.
 * Guard against parallel runs is handled inside ForecastOrchestrator.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DailyForecastJob {

    private final ForecastOrchestrator forecastOrchestrator;
    private final ForecastAccuracyService forecastAccuracyService;
    private final StoreRepository storeRepository;

    @Scheduled(cron = "${forestock.scheduler.cron}")
    public void runNightlyForecast() {
        log.info("DailyForecastJob triggered by scheduler");
        forecastOrchestrator.runForAllStores("SCHEDULER");
        for (Store store : storeRepository.findAll()) {
            if (Boolean.TRUE.equals(store.getActive())) {
                forecastAccuracyService.evaluateCompletedForecasts(store.getId());
            }
        }
    }
}
