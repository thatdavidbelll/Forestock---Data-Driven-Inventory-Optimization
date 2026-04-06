package com.forestock.forestock_backend.scheduler;

import com.forestock.forestock_backend.domain.Store;
import com.forestock.forestock_backend.repository.StoreRepository;
import com.forestock.forestock_backend.service.ForecastAccuracyService;
import com.forestock.forestock_backend.service.ForecastOrchestrator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

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
        log.info("DailyForecastJob started by scheduler");
        List<Store> activeStores = storeRepository.findAll()
                .stream()
                .filter(store -> Boolean.TRUE.equals(store.getActive()))
                .toList();
        log.info("DailyForecastJob processing {} active stores", activeStores.size());
        forecastOrchestrator.runForAllStores("SCHEDULER");
        for (Store store : activeStores) {
            forecastAccuracyService.evaluateCompletedForecasts(store.getId());
        }
        log.info("DailyForecastJob completed for {} active stores", activeStores.size());
    }
}
