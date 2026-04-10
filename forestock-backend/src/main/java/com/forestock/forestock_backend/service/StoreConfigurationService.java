package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.domain.Store;
import com.forestock.forestock_backend.domain.StoreConfiguration;
import com.forestock.forestock_backend.dto.request.UpdateStoreConfigRequest;
import com.forestock.forestock_backend.dto.response.StoreConfigurationDto;
import com.forestock.forestock_backend.repository.StoreConfigurationRepository;
import com.forestock.forestock_backend.repository.StoreRepository;
import com.forestock.forestock_backend.security.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.NoSuchElementException;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class StoreConfigurationService {

    private final StoreConfigurationRepository storeConfigurationRepository;
    private final StoreRepository storeRepository;
    private final AuditLogService auditLogService;

    @Transactional(readOnly = true)
    public StoreConfigurationDto getCurrentConfig() {
        UUID storeId = TenantContext.getStoreId();
        if (storeId == null) {
            throw new IllegalStateException("No store context");
        }
        return getConfigDtoForStore(storeId);
    }

    @Transactional(readOnly = true)
    public StoreConfigurationDto getConfigDtoForStore(UUID storeId) {
        if (storeId == null) {
            throw new IllegalStateException("No store context");
        }
        return toDto(getConfigForStore(storeId));
    }

    @Transactional
    public StoreConfigurationDto updateCurrentConfig(UpdateStoreConfigRequest request) {
        UUID storeId = TenantContext.getStoreId();
        if (storeId == null) {
            throw new IllegalStateException("No store context");
        }

        return updateConfigForStore(storeId, request);
    }

    @Transactional
    public StoreConfigurationDto updateConfigForStore(UUID storeId, UpdateStoreConfigRequest request) {
        if (storeId == null) {
            throw new IllegalStateException("No store context");
        }

        StoreConfiguration configuration = getConfigForStore(storeId);

        if (request.getTimezone() != null) configuration.setTimezone(request.getTimezone().trim());
        if (request.getCurrencySymbol() != null) configuration.setCurrencySymbol(request.getCurrencySymbol().trim());
        if (request.getForecastHorizonDays() != null) configuration.setForecastHorizonDays(request.getForecastHorizonDays());
        if (request.getLookbackDays() != null) configuration.setLookbackDays(request.getLookbackDays());
        if (request.getMinHistoryDays() != null) configuration.setMinHistoryDays(request.getMinHistoryDays());
        if (request.getSeasonalityPeriod() != null) configuration.setSeasonalityPeriod(request.getSeasonalityPeriod());
        if (request.getSafetyStockMultiplier() != null) configuration.setSafetyStockMultiplier(request.getSafetyStockMultiplier());
        if (request.getUrgencyCriticalDays() != null) configuration.setUrgencyCriticalDays(request.getUrgencyCriticalDays());
        if (request.getUrgencyHighDays() != null) configuration.setUrgencyHighDays(request.getUrgencyHighDays());
        if (request.getUrgencyMediumDays() != null) configuration.setUrgencyMediumDays(request.getUrgencyMediumDays());
        if (request.getAutoForecastOnImport() != null) configuration.setAutoForecastOnImport(request.getAutoForecastOnImport());

        validate(configuration);

        StoreConfiguration saved = storeConfigurationRepository.save(configuration);
        auditLogService.log(
                "STORE_CONFIG_UPDATED",
                "StoreConfiguration",
                saved.getId().toString(),
                "Updated forecast/restocking configuration for store " + saved.getStore().getSlug()
        );
        log.info("Updated store configuration for store {}", saved.getStore().getId());
        return toDto(saved);
    }

    @Transactional
    public StoreConfiguration getConfigForStore(UUID storeId) {
        return storeConfigurationRepository.findByStoreId(storeId)
                .orElseGet(() -> {
                    Store store = storeRepository.findById(storeId)
                            .orElseThrow(() -> new NoSuchElementException("Store not found"));
                    StoreConfiguration saved = storeConfigurationRepository.save(StoreConfiguration.builder()
                            .store(store)
                            .build());
                    auditLogService.log(
                            "STORE_CONFIG_INITIALIZED",
                            "StoreConfiguration",
                            saved.getId().toString(),
                            "Initialized default configuration for store " + store.getSlug()
                    );
                    return saved;
                });
    }

    private void validate(StoreConfiguration configuration) {
        if (configuration.getTimezone() == null || configuration.getTimezone().isBlank()) {
            throw new IllegalArgumentException("timezone is required");
        }
        if (configuration.getCurrencySymbol() == null || configuration.getCurrencySymbol().isBlank()) {
            throw new IllegalArgumentException("currencySymbol is required");
        }
        if (configuration.getUrgencyCriticalDays() >= configuration.getUrgencyHighDays()
                || configuration.getUrgencyHighDays() >= configuration.getUrgencyMediumDays()) {
            throw new IllegalArgumentException("urgency thresholds must be ascending");
        }
    }

    private StoreConfigurationDto toDto(StoreConfiguration configuration) {
        return StoreConfigurationDto.builder()
                .id(configuration.getId())
                .storeId(configuration.getStore().getId())
                .timezone(configuration.getTimezone())
                .currencySymbol(configuration.getCurrencySymbol())
                .forecastHorizonDays(configuration.getForecastHorizonDays())
                .lookbackDays(configuration.getLookbackDays())
                .minHistoryDays(configuration.getMinHistoryDays())
                .seasonalityPeriod(configuration.getSeasonalityPeriod())
                .safetyStockMultiplier(configuration.getSafetyStockMultiplier())
                .urgencyCriticalDays(configuration.getUrgencyCriticalDays())
                .urgencyHighDays(configuration.getUrgencyHighDays())
                .urgencyMediumDays(configuration.getUrgencyMediumDays())
                .autoForecastOnImport(configuration.getAutoForecastOnImport())
                .updatedAt(configuration.getUpdatedAt())
                .build();
    }
}
