package com.forestock.forestock_backend.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class ProductDto {
    private UUID id;
    private String sku;
    private String name;
    private String category;
    private String unit;
    private BigDecimal reorderPoint;
    private BigDecimal maxStock;
    private Integer leadTimeDays;
    private BigDecimal minimumOrderQty;
    private BigDecimal unitCost;
    private String supplierName;
    private String supplierContact;
    private String barcode;
    private String storageLocation;
    private String notes;
    private Boolean active;
    private LocalDateTime createdAt;
}
