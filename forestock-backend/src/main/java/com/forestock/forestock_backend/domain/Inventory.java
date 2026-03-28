package com.forestock.forestock_backend.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "inventory")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Inventory {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id", nullable = false)
    private Store store;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal quantity;

    @Column(name = "adjustment_reason", length = 50)
    private String adjustmentReason;

    @Column(name = "adjustment_note", length = 255)
    private String adjustmentNote;

    @Column(name = "adjusted_by", length = 100)
    private String adjustedBy;

    @Column(name = "recorded_at", updatable = false)
    @CreationTimestamp
    private LocalDateTime recordedAt;
}
