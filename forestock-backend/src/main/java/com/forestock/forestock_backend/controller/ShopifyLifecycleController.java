package com.forestock.forestock_backend.controller;

import com.forestock.forestock_backend.config.ShopifyProperties;
import com.forestock.forestock_backend.domain.ShopifyConnection;
import com.forestock.forestock_backend.dto.response.ApiResponse;
import com.forestock.forestock_backend.service.ShopifyConnectionService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/shopify")
@RequiredArgsConstructor
public class ShopifyLifecycleController {

    private static final String PROVISIONING_HEADER = "X-Forestock-Shopify-Secret";

    private final ShopifyConnectionService connectionService;
    private final ShopifyProperties shopifyProperties;

    @PostMapping("/disconnect")
    public ResponseEntity<ApiResponse<DisconnectResult>> disconnect(
            @RequestHeader(name = PROVISIONING_HEADER, required = false) String provisioningSecret,
            @Valid @RequestBody DisconnectRequest request) {
        if (shopifyProperties.getProvisioningSecret() == null
                || shopifyProperties.getProvisioningSecret().isBlank()
                || !shopifyProperties.getProvisioningSecret().equals(provisioningSecret)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error("Invalid provisioning secret"));
        }

        ShopifyConnection connection = connectionService.deactivateByShopDomain(request.getShopDomain());
        DisconnectResult result = new DisconnectResult();
        result.setShopDomain(connection.getShopDomain());
        result.setActive(connection.isActive());
        return ResponseEntity.ok(ApiResponse.success("Shop disconnected", result));
    }

    @Data
    public static class DisconnectRequest {
        @NotBlank(message = "Shop domain is required")
        private String shopDomain;
    }

    @Data
    public static class DisconnectResult {
        private String shopDomain;
        private boolean active;
    }
}
