package com.forestock.forestock_backend.service;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ShopifyIngestionResult {

    public enum Status { SUCCESS, DUPLICATE, ERROR }

    private Status status;
    private Long shopifyOrderId;
    private int matchedLineItems;
    private int unmatchedLineItems;
    private int salesRowsUpserted;
    private String errorMessage;

    public static ShopifyIngestionResult success(Long orderId, int matched, int unmatched, int upserted) {
        return ShopifyIngestionResult.builder()
                .status(Status.SUCCESS)
                .shopifyOrderId(orderId)
                .matchedLineItems(matched)
                .unmatchedLineItems(unmatched)
                .salesRowsUpserted(upserted)
                .build();
    }

    public static ShopifyIngestionResult duplicate(Long orderId) {
        return ShopifyIngestionResult.builder()
                .status(Status.DUPLICATE)
                .shopifyOrderId(orderId)
                .build();
    }

    public static ShopifyIngestionResult error(String message) {
        return ShopifyIngestionResult.builder()
                .status(Status.ERROR)
                .errorMessage(message)
                .build();
    }
}

