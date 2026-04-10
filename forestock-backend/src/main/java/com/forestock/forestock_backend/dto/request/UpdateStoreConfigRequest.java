package com.forestock.forestock_backend.dto.request;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class UpdateStoreConfigRequest {

    @Size(max = 50)
    private String timezone;

    @Size(max = 5)
    private String currencySymbol;

    @Min(3)
    @Max(90)
    private Integer forecastHorizonDays;

    @Min(90)
    @Max(730)
    private Integer lookbackDays;

    @Min(14)
    @Max(90)
    private Integer minHistoryDays;

    @Min(1)
    @Max(365)
    private Integer seasonalityPeriod;

    @DecimalMin("1.00")
    @DecimalMax("2.00")
    private BigDecimal safetyStockMultiplier;

    @Min(1)
    @Max(365)
    private Integer urgencyCriticalDays;

    @Min(1)
    @Max(365)
    private Integer urgencyHighDays;

    @Min(1)
    @Max(365)
    private Integer urgencyMediumDays;

    private Boolean autoForecastOnImport;
}
