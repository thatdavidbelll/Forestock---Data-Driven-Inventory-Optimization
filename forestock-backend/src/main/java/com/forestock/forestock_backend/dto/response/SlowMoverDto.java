package com.forestock.forestock_backend.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Data
@Builder
public class SlowMoverDto {
    private UUID productId;
    private String sku;
    private String name;
    private String category;
    private BigDecimal currentStock;
    private LocalDate lastSaleDate;
    private Long daysSinceLastSale;
    private BigDecimal estimatedStockValue;
}
