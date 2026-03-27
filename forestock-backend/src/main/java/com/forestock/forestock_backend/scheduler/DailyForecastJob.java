package com.forestock.forestock_backend.scheduler;

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

    @Scheduled(cron = "${forestock.scheduler.cron}")
    public void runNightlyForecast() {
        log.info("DailyForecastJob triggered by scheduler");
        forecastOrchestrator.runForAllStores("SCHEDULER");
    }
}
