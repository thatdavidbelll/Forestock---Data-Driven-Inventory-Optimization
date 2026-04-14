package com.forestock.forestock_backend.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Builder
public class StoreConfigurationDto {
    private UUID id;
    private UUID storeId;
    private String timezone;
    private String currencySymbol;
    private Integer forecastHorizonDays;
    private Integer lookbackDays;
    private Integer minHistoryDays;
    private Integer seasonalityPeriod;
    private BigDecimal safetyStockMultiplier;
    private Integer urgencyCriticalDays;
    private Integer urgencyHighDays;
    private Integer urgencyMediumDays;
    private Boolean autoForecastOnImport;
    private OffsetDateTime updatedAt;
}
