package com.forestock.forestock_backend.controller;

import com.forestock.forestock_backend.domain.ShopifyConnection;
import com.forestock.forestock_backend.dto.response.ApiResponse;
import com.forestock.forestock_backend.service.ShopifyConnectionService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequestMapping("/api/store/shopify")
@RequiredArgsConstructor
public class ShopifyConnectionController {

    private final ShopifyConnectionService connectionService;

    @GetMapping
    public ResponseEntity<ApiResponse<ShopifyConnectionDto>> getConnection() {
        return connectionService.getConnectionForCurrentStore()
                .map(connection -> ResponseEntity.ok(ApiResponse.success(toDto(connection))))
                .orElseGet(() -> ResponseEntity.ok(ApiResponse.<ShopifyConnectionDto>success(null)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ShopifyConnectionDto>> createConnection(
            @Valid @RequestBody CreateShopifyConnectionRequest request) {
        ShopifyConnection connection = connectionService.createConnection(
                request.getShopDomain(),
                request.getWebhookSecret()
        );
        return ResponseEntity.ok(ApiResponse.success("Shopify connection created", toDto(connection)));
    }

    @DeleteMapping
    public ResponseEntity<ApiResponse<Void>> deleteConnection() {
        connectionService.deleteConnection();
        return ResponseEntity.ok(ApiResponse.success("Shopify connection removed", null));
    }

    @PutMapping("/toggle")
    public ResponseEntity<ApiResponse<ShopifyConnectionDto>> toggleConnection(@RequestParam boolean active) {
        ShopifyConnection connection = connectionService.toggleActive(active);
        return ResponseEntity.ok(ApiResponse.success(
                active ? "Connection activated" : "Connection deactivated",
                toDto(connection))
        );
    }

    @Data
    public static class CreateShopifyConnectionRequest {
        @NotBlank(message = "Shop domain is required")
        private String shopDomain;
        private String webhookSecret;
    }

    @Data
    public static class ShopifyConnectionDto {
        private String id;
        private String shopDomain;
        private boolean active;
        private String createdAt;
        private String updatedAt;
        private boolean hasCustomSecret;
    }

    private ShopifyConnectionDto toDto(ShopifyConnection connection) {
        ShopifyConnectionDto dto = new ShopifyConnectionDto();
        dto.setId(connection.getId().toString());
        dto.setShopDomain(connection.getShopDomain());
        dto.setActive(connection.isActive());
        dto.setCreatedAt(connection.getCreatedAt().toString());
        dto.setUpdatedAt(connection.getUpdatedAt().toString());
        dto.setHasCustomSecret(connection.getWebhookSecret() != null && !connection.getWebhookSecret().isBlank());
        return dto;
    }
}

