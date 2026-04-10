package com.forestock.forestock_backend.controller;

import com.forestock.forestock_backend.config.ShopifyProperties;
import com.forestock.forestock_backend.dto.response.ApiResponse;
import com.forestock.forestock_backend.service.ShopifyProvisioningService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

@RestController
@RequestMapping("/api/shopify")
@RequiredArgsConstructor
public class ShopifyProvisioningController {

    private static final String PROVISIONING_HEADER = "X-Forestock-Shopify-Secret";

    private final ShopifyProvisioningService provisioningService;
    private final ShopifyProperties shopifyProperties;

    @PostMapping("/provision")
    public ResponseEntity<ApiResponse<ShopifyProvisioningService.ProvisioningResult>> provisionShop(
            @RequestHeader(name = PROVISIONING_HEADER, required = false) String provisioningSecret,
            @Valid @RequestBody ProvisionShopRequest request) {
        if (!isValidProvisioningSecret(provisioningSecret)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error("Invalid provisioning secret"));
        }

        ShopifyProvisioningService.ProvisioningResult result = provisioningService.provisionShop(
                new ShopifyProvisioningService.ProvisioningRequest(
                        request.getShopDomain(),
                        request.getShopName(),
                        request.getEmail()
                )
        );

        return ResponseEntity.ok(ApiResponse.success("Shop provisioned", result));
    }

    @Data
    public static class ProvisionShopRequest {
        @NotBlank(message = "Shop domain is required")
        @Pattern(regexp = "^[a-z0-9][a-z0-9\\-]*\\.myshopify\\.com$", message = "Shop domain must be a valid .myshopify.com domain")
        private String shopDomain;
        private String shopName;
        private String email;
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
