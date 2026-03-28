package com.forestock.forestock_backend.dto.request;

import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class BulkAcknowledgeSuggestionsRequest {
    private List<UUID> suggestionIds;
    private String acknowledgedReason;
    private java.math.BigDecimal quantityOrdered;
    private java.time.LocalDate expectedDelivery;
    private String orderReference;
}
