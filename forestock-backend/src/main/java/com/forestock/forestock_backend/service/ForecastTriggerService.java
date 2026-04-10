package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.repository.StoreConfigurationRepository;
import com.forestock.forestock_backend.security.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ForecastTriggerService {

    private final ForecastOrchestrator forecastOrchestrator;
    private final StoreConfigurationRepository storeConfigurationRepository;

    public void triggerForCurrentStore(String triggeredBy) {
        triggerForStore(TenantContext.getStoreId(), triggeredBy);
    }

    public void triggerForStore(UUID storeId, String triggeredBy) {
        if (storeId == null) {
            return;
        }

        try {
            boolean autoForecastEnabled = storeConfigurationRepository.findByStoreId(storeId)
                    .map(configuration -> Boolean.TRUE.equals(configuration.getAutoForecastOnImport()))
                    .orElse(true);
            if (!autoForecastEnabled) {
                log.info("Auto forecast disabled for store {}, skipping trigger {}", storeId, triggeredBy);
                return;
            }

            forecastOrchestrator.runForecast(storeId, triggeredBy);
            log.info("Forecast trigger accepted for store {} ({})", storeId, triggeredBy);
        } catch (Exception e) {
            log.warn("Failed to trigger forecast for store {} ({}): {}", storeId, triggeredBy, e.getMessage());
        }
    }
}
