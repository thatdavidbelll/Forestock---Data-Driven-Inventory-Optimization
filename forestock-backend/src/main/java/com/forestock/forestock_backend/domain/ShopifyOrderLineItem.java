package com.forestock.forestock_backend.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "shopify_order_line_items")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ShopifyOrderLineItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne
    @JoinColumn(name = "store_id", nullable = false)
    private Store store;

    @ManyToOne
    @JoinColumn(name = "shopify_order_id", nullable = false)
    private ShopifyOrder shopifyOrder;

    @Column(name = "shopify_line_item_id", nullable = false)
    private Long shopifyLineItemId;

    @ManyToOne
    @JoinColumn(name = "product_id")
    private Product product;

    @Column
    private String sku;

    @Column
    private String title;

    @Column(name = "variant_title")
    private String variantTitle;

    @Column(nullable = false)
    private int quantity;

    @Column
    private BigDecimal price;

    @Builder.Default
    @Column(nullable = false)
    private boolean matched = false;
}

