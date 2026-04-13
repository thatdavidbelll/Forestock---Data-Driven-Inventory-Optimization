package com.forestock.forestock_backend.dto.response;

public record ImportRowError(int rowNumber, String sku, String message) {
}
