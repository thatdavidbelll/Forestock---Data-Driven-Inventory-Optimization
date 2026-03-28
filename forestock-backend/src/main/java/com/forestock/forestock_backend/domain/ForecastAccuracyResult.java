package com.forestock.forestock_backend.domain;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "forecast_accuracy_results")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ForecastAccuracyResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id", nullable = false)
    private Store store;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "forecast_run_id", nullable = false)
    private ForecastRun forecastRun;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(name = "evaluation_date", nullable = false)
    private LocalDate evaluationDate;

    @Column(name = "forecast_period_start", nullable = false)
    private LocalDate forecastPeriodStart;

    @Column(name = "forecast_period_end", nullable = false)
    private LocalDate forecastPeriodEnd;

    @Column(name = "predicted_total", nullable = false, precision = 10, scale = 2)
    private BigDecimal predictedTotal;

    @Column(name = "actual_total", precision = 10, scale = 2)
    private BigDecimal actualTotal;

    @Column(precision = 6, scale = 2)
    private BigDecimal mape;

    @Column(name = "evaluated_at")
    private LocalDateTime evaluatedAt;
}
