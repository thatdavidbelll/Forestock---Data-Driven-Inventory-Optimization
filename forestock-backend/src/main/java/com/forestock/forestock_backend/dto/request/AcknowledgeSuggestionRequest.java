package com.forestock.forestock_backend.dto.request;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class AcknowledgeSuggestionRequest {
    private String acknowledgedReason;
    private BigDecimal quantityOrdered;
    private LocalDate expectedDelivery;
    private String orderReference;
}
