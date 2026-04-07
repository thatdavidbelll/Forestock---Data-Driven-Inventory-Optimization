package com.forestock.forestock_backend.dto.response;

import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductDto {
    private UUID id;
    @NotBlank(message = "SKU is required")
    private String sku;
    @NotBlank(message = "Name is required")
    @Size(max = 255, message = "Name must be 255 characters or less")
    private String name;
    private String category;
    @NotBlank(message = "Unit is required")
    private String unit;
    private BigDecimal reorderPoint;
    private BigDecimal maxStock;
    private Integer leadTimeDays;
    private BigDecimal minimumOrderQty;
    private BigDecimal unitCost;
    private String supplierName;
    private String supplierContact;
    private String barcode;
    private String shopifyProductGid;
    private String shopifyVariantGid;
    private String shopifyInventoryItemGid;
    private String storageLocation;
    private String notes;
    private Boolean active;
    private LocalDateTime createdAt;
}
