package com.forestock.forestock_backend.domain;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "sales_transactions",
       uniqueConstraints = @UniqueConstraint(columnNames = {"product_id", "sale_date"}))
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SalesTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id", nullable = false)
    private Store store;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(name = "quantity_sold", nullable = false, precision = 10, scale = 2)
    private BigDecimal quantitySold;

    @Column(name = "sale_date", nullable = false)
    private LocalDate saleDate;
}
