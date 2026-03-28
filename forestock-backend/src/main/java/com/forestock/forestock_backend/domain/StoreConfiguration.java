package com.forestock.forestock_backend.domain;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "store_configurations")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StoreConfiguration {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id", nullable = false)
    private Store store;

    @Column(nullable = false, length = 50)
    @Builder.Default
    private String timezone = "UTC";

    @Column(name = "currency_symbol", nullable = false, length = 5)
    @Builder.Default
    private String currencySymbol = "£";

    @Column(name = "forecast_horizon_days", nullable = false)
    @Builder.Default
    private Integer forecastHorizonDays = 14;

    @Column(name = "lookback_days", nullable = false)
    @Builder.Default
    private Integer lookbackDays = 365;

    @Column(name = "min_history_days", nullable = false)
    @Builder.Default
    private Integer minHistoryDays = 30;

    @Column(name = "seasonality_period", nullable = false)
    @Builder.Default
    private Integer seasonalityPeriod = 7;

    @Column(name = "safety_stock_multiplier", nullable = false, precision = 4, scale = 2)
    @Builder.Default
    private BigDecimal safetyStockMultiplier = BigDecimal.valueOf(1.20);

    @Column(name = "urgency_critical_days", nullable = false)
    @Builder.Default
    private Integer urgencyCriticalDays = 2;

    @Column(name = "urgency_high_days", nullable = false)
    @Builder.Default
    private Integer urgencyHighDays = 5;

    @Column(name = "urgency_medium_days", nullable = false)
    @Builder.Default
    private Integer urgencyMediumDays = 10;

    @Column(name = "auto_forecast_on_import", nullable = false)
    @Builder.Default
    private Boolean autoForecastOnImport = true;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    void touch() {
        if (timezone == null || timezone.isBlank()) timezone = "UTC";
        if (currencySymbol == null || currencySymbol.isBlank()) currencySymbol = "£";
        if (forecastHorizonDays == null) forecastHorizonDays = 14;
        if (lookbackDays == null) lookbackDays = 365;
        if (minHistoryDays == null) minHistoryDays = 30;
        if (seasonalityPeriod == null) seasonalityPeriod = 7;
        if (safetyStockMultiplier == null) safetyStockMultiplier = BigDecimal.valueOf(1.20);
        if (urgencyCriticalDays == null) urgencyCriticalDays = 2;
        if (urgencyHighDays == null) urgencyHighDays = 5;
        if (urgencyMediumDays == null) urgencyMediumDays = 10;
        if (autoForecastOnImport == null) autoForecastOnImport = true;
        updatedAt = LocalDateTime.now();
    }
}
