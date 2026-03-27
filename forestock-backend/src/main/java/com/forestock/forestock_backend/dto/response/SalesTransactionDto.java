package com.forestock.forestock_backend.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Lightweight projection of a SalesTransaction used in paginated list responses.
 */
public record SalesTransactionDto(
        UUID id,
        String productSku,
        String productName,
        LocalDate saleDate,
        BigDecimal quantitySold
) {}
