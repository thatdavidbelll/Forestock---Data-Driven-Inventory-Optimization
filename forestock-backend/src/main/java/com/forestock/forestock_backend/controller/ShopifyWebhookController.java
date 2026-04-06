package com.forestock.forestock_backend.controller;

import com.forestock.forestock_backend.config.CachedBodyHttpServletRequest;
import com.forestock.forestock_backend.dto.response.ApiResponse;
import com.forestock.forestock_backend.service.ShopifyIngestionResult;
import com.forestock.forestock_backend.service.ShopifyOrderIngestionService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;

@Slf4j
@RestController
@RequestMapping("/api/webhooks/shopify")
@RequiredArgsConstructor
public class ShopifyWebhookController {

    private final ShopifyOrderIngestionService ingestionService;

    @PostMapping("/orders")
    public ResponseEntity<ApiResponse<ShopifyIngestionResult>> handleOrderWebhook(HttpServletRequest request) {
        String shopDomain = request.getHeader("X-Shopify-Shop-Domain");
        String topic = request.getHeader("X-Shopify-Topic");
        log.info("Processing Shopify webhook: topic={}, domain={}", topic, shopDomain);

        String rawPayload;
        if (request instanceof CachedBodyHttpServletRequest cachedRequest) {
            rawPayload = new String(cachedRequest.getCachedBody(), StandardCharsets.UTF_8);
        } else {
            try {
                rawPayload = new String(request.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            } catch (Exception e) {
                log.error("Failed to read webhook body", e);
                return ResponseEntity.badRequest().body(ApiResponse.error("Failed to read request body"));
            }
        }

        ShopifyIngestionResult result = ingestionService.processOrder(shopDomain, rawPayload);
        return switch (result.getStatus()) {
            case SUCCESS -> ResponseEntity.ok(ApiResponse.success("Order processed", result));
            case DUPLICATE -> ResponseEntity.ok(ApiResponse.success("Order already processed", result));
            case ERROR -> ResponseEntity.unprocessableEntity().body(ApiResponse.error(result.getErrorMessage()));
        };
    }
}

