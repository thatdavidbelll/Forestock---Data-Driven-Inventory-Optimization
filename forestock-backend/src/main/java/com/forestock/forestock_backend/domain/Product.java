package com.forestock.forestock_backend.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "products",
       uniqueConstraints = @UniqueConstraint(columnNames = {"store_id", "sku"}))
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id", nullable = false)
    private Store store;

    @Column(nullable = false, length = 50)
    private String sku;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(length = 100)
    private String category;

    @Column(nullable = false, length = 20)
    private String unit;

    @Column(name = "reorder_point", precision = 10, scale = 2)
    private BigDecimal reorderPoint;

    @Column(name = "max_stock", precision = 10, scale = 2)
    private BigDecimal maxStock;

    @Column(name = "lead_time_days")
    private Integer leadTimeDays;

    @Column(name = "minimum_order_qty", precision = 12, scale = 2)
    private BigDecimal minimumOrderQty;

    @Column(name = "unit_cost", precision = 12, scale = 4)
    private BigDecimal unitCost;

    @Column(name = "supplier_name", length = 255)
    private String supplierName;

    @Column(name = "supplier_contact", length = 255)
    private String supplierContact;

    @Column(length = 100)
    private String barcode;

    @Column(name = "shopify_product_gid", length = 255)
    private String shopifyProductGid;

    @Column(name = "shopify_variant_gid", length = 255)
    private String shopifyVariantGid;

    @Column(name = "shopify_inventory_item_gid", length = 255)
    private String shopifyInventoryItemGid;

    @Column(name = "product_image_url", columnDefinition = "TEXT")
    private String productImageUrl;

    @Column(name = "storage_location", length = 100)
    private String storageLocation;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(nullable = false)
    @Builder.Default
    private Boolean active = true;

    @Column(name = "created_at", updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() {
        if (active == null) active = true;
    }
}
