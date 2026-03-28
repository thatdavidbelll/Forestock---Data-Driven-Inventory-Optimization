package com.forestock.forestock_backend.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class InventoryDto {
    private UUID id;
    private UUID productId;
    private String productSku;
    private String productName;
    private String productCategory;
    private String unit;
    private BigDecimal quantity;
    private BigDecimal reorderPoint;
    private boolean belowReorderPoint;
    private BigDecimal p50Daily;
    private String adjustmentReason;
    private String adjustmentNote;
    private String adjustedBy;
    private LocalDateTime recordedAt;
}
