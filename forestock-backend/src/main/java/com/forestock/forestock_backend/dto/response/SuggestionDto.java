package com.forestock.forestock_backend.dto.response;

import com.forestock.forestock_backend.domain.enums.Urgency;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class SuggestionDto {
    private UUID id;
    private UUID productId;
    private String productSku;
    private String productName;
    private String productCategory;
    private String unit;
    private BigDecimal suggestedQty;
    private BigDecimal forecastP50;
    private BigDecimal forecastP90;
    private BigDecimal currentStock;
    private BigDecimal daysOfStock;
    private Urgency urgency;
    private LocalDateTime generatedAt;
}
