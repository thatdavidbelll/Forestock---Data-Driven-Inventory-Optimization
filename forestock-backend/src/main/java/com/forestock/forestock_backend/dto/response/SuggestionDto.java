package com.forestock.forestock_backend.dto.response;

import com.forestock.forestock_backend.domain.enums.Urgency;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Builder
public class SuggestionDto {
    private UUID id;
    private UUID productId;
    private String productSku;
    private String productName;
    private String productImageUrl;
    private String productCategory;
    private String unit;
    private BigDecimal suggestedQty;
    private BigDecimal forecastP50;
    private BigDecimal forecastP90;
    private BigDecimal currentStock;
    private BigDecimal daysOfStock;
    private Integer leadTimeDaysAtGeneration;
    private BigDecimal moqApplied;
    private BigDecimal estimatedOrderValue;
    private String supplierName;
    private boolean lowConfidence;
    private String forecastModel;
    private Integer historyDaysAtGeneration;
    private Urgency urgency;
    private boolean acknowledged;
    private OffsetDateTime acknowledgedAt;
    private String acknowledgedReason;
    private BigDecimal quantityOrdered;
    private LocalDate expectedDelivery;
    private String orderReference;
    private OffsetDateTime generatedAt;
}
