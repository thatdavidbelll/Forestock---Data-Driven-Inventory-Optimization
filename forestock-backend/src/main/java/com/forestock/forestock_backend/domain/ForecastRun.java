package com.forestock.forestock_backend.domain;

import com.forestock.forestock_backend.domain.enums.ForecastStatus;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "forecast_runs")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ForecastRun {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id", nullable = false)
    private Store store;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private ForecastStatus status;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "finished_at")
    private LocalDateTime finishedAt;

    @Column(name = "horizon_days")
    @Builder.Default
    private Integer horizonDays = 14;

    @Column(name = "products_processed")
    @Builder.Default
    private Integer productsProcessed = 0;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "triggered_by", length = 50)
    @Builder.Default
    private String triggeredBy = "SCHEDULER";
}
