package com.forestock.forestock_backend.controller;

import com.forestock.forestock_backend.config.ShopifyProperties;
import com.forestock.forestock_backend.dto.response.ApiResponse;
import com.forestock.forestock_backend.service.ShopifyOrderBackfillService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;

@RestController
@RequestMapping("/api/shopify")
@RequiredArgsConstructor
public class ShopifyOrderBackfillController {

    private static final String PROVISIONING_HEADER = "X-Forestock-Shopify-Secret";

    private final ShopifyOrderBackfillService orderBackfillService;
    private final ShopifyProperties shopifyProperties;

    @PostMapping("/order-backfill")
    public ResponseEntity<ApiResponse<ShopifyOrderBackfillService.BackfillResult>> backfillOrders(
            @RequestHeader(name = PROVISIONING_HEADER, required = false) String provisioningSecret,
            @Valid @RequestBody BackfillRequest request) {
        if (!isValidProvisioningSecret(provisioningSecret)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error("Invalid provisioning secret"));
        }

        ShopifyOrderBackfillService.BackfillResult result = orderBackfillService.backfill(
                new ShopifyOrderBackfillService.BackfillRequest(
                        request.getShopDomain(),
                        request.getOrders().stream()
                                .map(order -> new ShopifyOrderBackfillService.BackfillOrder(
                                        order.getShopifyOrderId(),
                                        order.getOrderNumber(),
                                        order.getOrderName(),
                                        order.getFinancialStatus(),
                                        order.getFulfillmentStatus(),
                                        order.getTotalPrice(),
                                        order.getSubtotalPrice(),
                                        order.getCurrency(),
                                        order.getCreatedAt(),
                                        order.getUpdatedAt(),
                                        order.getLineItems().stream()
                                                .map(lineItem -> new ShopifyOrderBackfillService.BackfillLineItem(
                                                        lineItem.getShopifyLineItemId(),
                                                        lineItem.getShopifyVariantGid(),
                                                        lineItem.getSku(),
                                                        lineItem.getTitle(),
                                                        lineItem.getVariantTitle(),
                                                        lineItem.getQuantity(),
                                                        lineItem.getPrice()
                                                ))
                                                .toList()
                                ))
                                .toList()
                )
        );

        return ResponseEntity.ok(ApiResponse.success("Orders backfilled", result));
    }

    @Data
    public static class BackfillRequest {
        @NotBlank(message = "Shop domain is required")
        @Pattern(regexp = "^[a-z0-9][a-z0-9\\-]*\\.myshopify\\.com$", message = "Shop domain must be a valid .myshopify.com domain")
        private String shopDomain;
        @Size(max = 1000, message = "Maximum 1000 orders per backfill request")
        private List<BackfillOrderRequest> orders = List.of();
    }

    @Data
    public static class BackfillOrderRequest {
        private Long shopifyOrderId;
        private String orderNumber;
        private String orderName;
        private String financialStatus;
        private String fulfillmentStatus;
        private BigDecimal totalPrice;
        private BigDecimal subtotalPrice;
        private String currency;
        private String createdAt;
        private String updatedAt;
        private List<BackfillLineItemRequest> lineItems = List.of();
    }

    @Data
    public static class BackfillLineItemRequest {
        private Long shopifyLineItemId;
        private String shopifyVariantGid;
        private String sku;
        private String title;
        private String variantTitle;
        private int quantity;
        private BigDecimal price;
    }

    private boolean isValidProvisioningSecret(String provided) {
        String expected = shopifyProperties.getProvisioningSecret();
        if (expected == null || expected.isBlank() || provided == null) {
            return false;
        }
        return MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8),
                provided.getBytes(StandardCharsets.UTF_8)
        );
    }
}
