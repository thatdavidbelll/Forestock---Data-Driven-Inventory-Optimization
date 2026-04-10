package com.forestock.forestock_backend.domain;

import com.forestock.forestock_backend.domain.enums.Urgency;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "order_suggestions")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderSuggestion {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id", nullable = false)
    private Store store;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "forecast_run_id")
    private ForecastRun forecastRun;

    @Column(name = "suggested_qty", nullable = false, precision = 10, scale = 2)
    private BigDecimal suggestedQty;

    @Column(name = "forecast_p50", precision = 10, scale = 2)
    private BigDecimal forecastP50;

    @Column(name = "forecast_p90", precision = 10, scale = 2)
    private BigDecimal forecastP90;

    @Column(name = "current_stock", precision = 10, scale = 2)
    private BigDecimal currentStock;

    @Column(name = "days_of_stock", precision = 6, scale = 2)
    private BigDecimal daysOfStock;

    @Column(name = "lead_time_days_at_generation")
    private Integer leadTimeDaysAtGeneration;

    @Column(name = "moq_applied", precision = 12, scale = 2)
    private BigDecimal moqApplied;

    @Column(name = "estimated_order_value", precision = 14, scale = 2)
    private BigDecimal estimatedOrderValue;

    @Builder.Default
    @Column(name = "low_confidence", nullable = false)
    private Boolean lowConfidence = false;

    @Column(name = "history_days_at_generation")
    private Integer historyDaysAtGeneration;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private Urgency urgency;

    @Builder.Default
    @Column(nullable = false)
    private Boolean acknowledged = false;

    @Column(name = "acknowledged_at")
    private LocalDateTime acknowledgedAt;

    @Column(name = "acknowledged_reason", length = 255)
    private String acknowledgedReason;

    @Column(name = "quantity_ordered", precision = 12, scale = 2)
    private BigDecimal quantityOrdered;

    @Column(name = "expected_delivery")
    private LocalDate expectedDelivery;

    @Column(name = "order_reference", length = 100)
    private String orderReference;

    @Column(name = "generated_at", updatable = false)
    @CreationTimestamp
    private LocalDateTime generatedAt;
}
