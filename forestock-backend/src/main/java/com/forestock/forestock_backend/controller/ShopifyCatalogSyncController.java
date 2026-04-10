package com.forestock.forestock_backend.controller;

import com.forestock.forestock_backend.config.ShopifyProperties;
import com.forestock.forestock_backend.dto.response.ApiResponse;
import com.forestock.forestock_backend.service.ShopifyCatalogSyncService;
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

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;

@RestController
@RequestMapping("/api/shopify")
@RequiredArgsConstructor
public class ShopifyCatalogSyncController {

    private static final String PROVISIONING_HEADER = "X-Forestock-Shopify-Secret";

    private final ShopifyCatalogSyncService catalogSyncService;
    private final ShopifyProperties shopifyProperties;

    @PostMapping("/catalog-sync")
    public ResponseEntity<ApiResponse<ShopifyCatalogSyncService.CatalogSyncResult>> syncCatalog(
            @RequestHeader(name = PROVISIONING_HEADER, required = false) String provisioningSecret,
            @Valid @RequestBody CatalogSyncRequest request) {
        if (!isValidProvisioningSecret(provisioningSecret)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error("Invalid provisioning secret"));
        }

        ShopifyCatalogSyncService.CatalogSyncResult result = catalogSyncService.syncCatalog(
                new ShopifyCatalogSyncService.CatalogSyncRequest(
                        request.getShopDomain(),
                        request.getItems().stream()
                                .map(item -> new ShopifyCatalogSyncService.ShopifyCatalogItem(
                                        item.getShopifyProductGid(),
                                        item.getShopifyVariantGid(),
                                        item.getShopifyInventoryItemGid(),
                                        item.getSku(),
                                        item.getName(),
                                        item.getVariantTitle(),
                                        item.getCategory(),
                                        item.getVendor(),
                                        item.getBarcode(),
                                        item.getUnitCost(),
                                        item.getInventoryQuantity(),
                                        item.isActive()
                                ))
                                .toList()
                )
        );

        return ResponseEntity.ok(ApiResponse.success("Catalog synced", result));
    }

    @PostMapping("/product-delete")
    public ResponseEntity<ApiResponse<ShopifyCatalogSyncService.ProductDeactivateResult>> deactivateProduct(
            @RequestHeader(name = PROVISIONING_HEADER, required = false) String provisioningSecret,
            @Valid @RequestBody ProductDeleteRequest request) {
        if (!isValidProvisioningSecret(provisioningSecret)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error("Invalid provisioning secret"));
        }

        ShopifyCatalogSyncService.ProductDeactivateResult result = catalogSyncService.deactivateProduct(
                request.getShopDomain(),
                request.getShopifyProductGid()
        );
        return ResponseEntity.ok(ApiResponse.success("Product deactivated", result));
    }

    @PostMapping("/inventory-sync")
    public ResponseEntity<ApiResponse<ShopifyCatalogSyncService.InventorySyncResult>> syncInventory(
            @RequestHeader(name = PROVISIONING_HEADER, required = false) String provisioningSecret,
            @Valid @RequestBody InventorySyncRequest request) {
        if (!isValidProvisioningSecret(provisioningSecret)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error("Invalid provisioning secret"));
        }

        ShopifyCatalogSyncService.InventorySyncResult result = catalogSyncService.syncInventoryLevel(
                request.getShopDomain(),
                request.getShopifyInventoryItemGid(),
                request.getQuantity()
        );
        return ResponseEntity.ok(ApiResponse.success("Inventory synced", result));
    }

    @Data
    public static class CatalogSyncRequest {
        @NotBlank(message = "Shop domain is required")
        @Pattern(regexp = "^[a-z0-9][a-z0-9\\-]*\\.myshopify\\.com$", message = "Shop domain must be a valid .myshopify.com domain")
        private String shopDomain;
        private List<CatalogSyncItemRequest> items = List.of();
    }

    @Data
    public static class CatalogSyncItemRequest {
        @NotBlank(message = "Shopify product GID is required")
        private String shopifyProductGid;
        @NotBlank(message = "Shopify variant GID is required")
        private String shopifyVariantGid;
        private String shopifyInventoryItemGid;
        private String sku;
        @NotBlank(message = "Name is required")
        private String name;
        private String variantTitle;
        private String category;
        private String vendor;
        private String barcode;
        private BigDecimal unitCost;
        private BigDecimal inventoryQuantity;
        private boolean active = true;
    }

    @Data
    public static class ProductDeleteRequest {
        @NotBlank(message = "Shop domain is required")
        @Pattern(regexp = "^[a-z0-9][a-z0-9\\-]*\\.myshopify\\.com$", message = "Shop domain must be a valid .myshopify.com domain")
        private String shopDomain;
        @NotBlank(message = "Shopify product GID is required")
        private String shopifyProductGid;
    }

    @Data
    public static class InventorySyncRequest {
        @NotBlank(message = "Shop domain is required")
        @Pattern(regexp = "^[a-z0-9][a-z0-9\\-]*\\.myshopify\\.com$", message = "Shop domain must be a valid .myshopify.com domain")
        private String shopDomain;
        @NotBlank(message = "Shopify inventory item GID is required")
        private String shopifyInventoryItemGid;
        private BigDecimal quantity;
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
