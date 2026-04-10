package com.forestock.forestock_backend.controller;

import com.forestock.forestock_backend.dto.response.ApiResponse;
import com.forestock.forestock_backend.service.ShopifyGdprService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.MessageDigest;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/shopify/gdpr")
@RequiredArgsConstructor
public class ShopifyGdprController {

    private final ShopifyGdprService gdprService;

    @Value("${shopify.provisioning-secret}")
    private String provisioningSecret;

    @PostMapping("/customers/data-request")
    public ResponseEntity<ApiResponse<Void>> handleCustomerDataRequest(
            @RequestHeader("X-Forestock-Shopify-Secret") String secret,
            @RequestBody Map<String, Object> body) {
        if (!isValidProvisioningSecret(secret)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error("Unauthorized"));
        }
        String shopDomain = (String) body.get("shopDomain");
        Number customerIdNum = (Number) body.get("customerId");
        long customerId = customerIdNum != null ? customerIdNum.longValue() : 0L;
        String customerEmail = (String) body.get("customerEmail");

        gdprService.logDataRequest(shopDomain, customerId, customerEmail);
        log.info("GDPR data request logged: shop={}, customerId={}", shopDomain, customerId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/customers/redact")
    public ResponseEntity<ApiResponse<Void>> handleCustomerRedact(
            @RequestHeader("X-Forestock-Shopify-Secret") String secret,
            @RequestBody Map<String, Object> body) {
        if (!isValidProvisioningSecret(secret)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error("Unauthorized"));
        }
        String shopDomain = (String) body.get("shopDomain");
        Number customerIdNum = (Number) body.get("customerId");
        long customerId = customerIdNum != null ? customerIdNum.longValue() : 0L;
        String customerEmail = (String) body.get("customerEmail");

        @SuppressWarnings("unchecked")
        List<Number> rawIds = (List<Number>) body.getOrDefault("ordersToRedact", List.of());
        List<Long> orderIds = rawIds.stream().map(Number::longValue).toList();

        gdprService.redactCustomer(shopDomain, customerId, customerEmail, orderIds);
        log.info("GDPR customer redact completed: shop={}, customerId={}, orders={}",
                shopDomain, customerId, orderIds.size());
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/shop/redact")
    public ResponseEntity<ApiResponse<Void>> handleShopRedact(
            @RequestHeader("X-Forestock-Shopify-Secret") String secret,
            @RequestBody Map<String, Object> body) {
        if (!isValidProvisioningSecret(secret)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error("Unauthorized"));
        }
        String shopDomain = (String) body.get("shopDomain");
        gdprService.redactShop(shopDomain);
        log.info("GDPR shop redact completed: shop={}", shopDomain);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    private boolean isValidProvisioningSecret(String provided) {
        if (provided == null || provisioningSecret == null) return false;
        return MessageDigest.isEqual(
                provided.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                provisioningSecret.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }
}
