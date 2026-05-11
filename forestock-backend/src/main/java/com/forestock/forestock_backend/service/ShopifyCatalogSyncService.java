package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.domain.Inventory;
import com.forestock.forestock_backend.domain.Product;
import com.forestock.forestock_backend.domain.ShopifyConnection;
import com.forestock.forestock_backend.domain.Store;
import com.forestock.forestock_backend.repository.InventoryRepository;
import com.forestock.forestock_backend.repository.ProductRepository;
import com.forestock.forestock_backend.repository.ShopifyConnectionRepository;
import lombok.Builder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.NoSuchElementException;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ShopifyCatalogSyncService {

    private final ShopifyConnectionRepository shopifyConnectionRepository;
    private final ProductRepository productRepository;
    private final InventoryRepository inventoryRepository;
    private final AuditLogService auditLogService;
    private final ForecastTriggerService forecastTriggerService;
    private final StorePlanService storePlanService;

    @Transactional
    public CatalogSyncResult syncCatalog(CatalogSyncRequest request) {
        String shopDomain = normalize(request.shopDomain());
        if (shopDomain == null) {
            throw new IllegalArgumentException("Shop domain is required");
        }

        ShopifyConnection connection = shopifyConnectionRepository.findByShopDomain(shopDomain)
                .orElseThrow(() -> new NoSuchElementException("No Shopify connection found for domain: " + shopDomain));

        Store store = connection.getStore();
        int createdProducts = 0;
        int updatedProducts = 0;
        int inventorySnapshotsCreated = 0;
        StorePlanService.PlanSnapshot planSnapshot = storePlanService.getPlanForStore(store.getId());
        int reservedActivations = 0;

        for (ShopifyCatalogItem item : request.items()) {
            SyncOutcome outcome = upsertCatalogItem(store, item, planSnapshot, reservedActivations);
            if (outcome.createdProduct()) {
                createdProducts++;
            } else if (outcome.updatedProduct()) {
                updatedProducts++;
            }
            if (outcome.createdInventorySnapshot()) {
                inventorySnapshotsCreated++;
            }
            if (outcome.productActivated()) {
                reservedActivations++;
            }
        }

        auditLogService.log(
                "SHOPIFY_CATALOG_SYNCED",
                "Store",
                store.getId().toString(),
                String.format(
                        "Synced %d Shopify catalog items for %s (%d created, %d updated, %d inventory snapshots)",
                        request.items().size(),
                        shopDomain,
                        createdProducts,
                        updatedProducts,
                        inventorySnapshotsCreated
                )
        );

        CatalogSyncResult result = CatalogSyncResult.builder()
                .shopDomain(shopDomain)
                .processedItems(request.items().size())
                .createdProducts(createdProducts)
                .updatedProducts(updatedProducts)
                .inventorySnapshotsCreated(inventorySnapshotsCreated)
                .build();

        if (createdProducts > 0 || updatedProducts > 0 || inventorySnapshotsCreated > 0) {
            forecastTriggerService.triggerForStore(store.getId(), "shopify-catalog-sync");
        }

        return result;
    }

    @Transactional
    public ProductDeactivateResult deactivateProduct(String shopDomain, String shopifyProductGid) {
        String normalizedShopDomain = normalize(shopDomain);
        String normalizedProductGid = normalize(shopifyProductGid);
        if (normalizedShopDomain == null || normalizedProductGid == null) {
            throw new IllegalArgumentException("Shop domain and Shopify product GID are required");
        }

        ShopifyConnection connection = shopifyConnectionRepository.findByShopDomain(normalizedShopDomain)
                .orElseThrow(() -> new NoSuchElementException("No Shopify connection found for domain: " + normalizedShopDomain));

        int deactivatedCount = 0;
        for (Product product : productRepository.findByStoreIdAndShopifyProductGid(connection.getStore().getId(), normalizedProductGid)) {
            if (Boolean.TRUE.equals(product.getActive())) {
                product.setActive(false);
                productRepository.save(product);
                deactivatedCount++;
            }
        }

        auditLogService.log(
                "SHOPIFY_PRODUCT_DEACTIVATED",
                "Store",
                connection.getStore().getId().toString(),
                String.format("Deactivated %d product rows for Shopify product %s", deactivatedCount, normalizedProductGid)
        );

        ProductDeactivateResult result = ProductDeactivateResult.builder()
                .shopDomain(normalizedShopDomain)
                .shopifyProductGid(normalizedProductGid)
                .deactivatedProducts(deactivatedCount)
                .build();

        if (deactivatedCount > 0) {
            forecastTriggerService.triggerForStore(connection.getStore().getId(), "shopify-product-deactivate");
        }

        return result;
    }

    @Transactional
    public InventorySyncResult syncInventoryLevel(String shopDomain, String inventoryItemGid, BigDecimal quantity) {
        String normalizedShopDomain = normalize(shopDomain);
        String normalizedInventoryItemGid = normalize(inventoryItemGid);
        if (normalizedShopDomain == null || normalizedInventoryItemGid == null) {
            throw new IllegalArgumentException("Shop domain and inventory item GID are required");
        }

        ShopifyConnection connection = shopifyConnectionRepository.findByShopDomain(normalizedShopDomain)
                .orElseThrow(() -> new NoSuchElementException("No Shopify connection found for domain: " + normalizedShopDomain));

        Product product = productRepository.findByStoreIdAndShopifyInventoryItemGid(
                        connection.getStore().getId(),
                        normalizedInventoryItemGid
                )
                .orElseThrow(() -> new NoSuchElementException("No product found for inventory item: " + normalizedInventoryItemGid));

        boolean createdSnapshot = syncInventory(connection.getStore(), product, quantity != null ? quantity : BigDecimal.ZERO);
        auditLogService.log(
                "SHOPIFY_INVENTORY_SYNCED",
                "Product",
                product.getId().toString(),
                String.format("Inventory synced from Shopify to %s (%s)", quantity, normalizedInventoryItemGid)
        );

        InventorySyncResult result = InventorySyncResult.builder()
                .shopDomain(normalizedShopDomain)
                .productId(product.getId())
                .shopifyInventoryItemGid(normalizedInventoryItemGid)
                .inventorySnapshotCreated(createdSnapshot)
                .quantity(quantity != null ? quantity : BigDecimal.ZERO)
                .build();

        if (createdSnapshot) {
            forecastTriggerService.triggerForStore(connection.getStore().getId(), "shopify-inventory-sync");
        }

        return result;
    }

    private SyncOutcome upsertCatalogItem(Store store,
                                          ShopifyCatalogItem item,
                                          StorePlanService.PlanSnapshot planSnapshot,
                                          int reservedActivations) {
        String variantGid = normalize(item.shopifyVariantGid());
        if (variantGid == null) {
            throw new IllegalArgumentException("Shopify variant GID is required");
        }

        String normalizedSku = normalizeSku(item.sku(), variantGid);
        Product product = productRepository.findByStoreIdAndShopifyVariantGid(store.getId(), variantGid)
                .or(() -> productRepository.findByStoreIdAndSku(store.getId(), normalizedSku))
                .orElse(null);

        boolean wasActive = product != null && Boolean.TRUE.equals(product.getActive());
        boolean shouldBeActive = item.active();
        if (shouldBeActive && planSnapshot.productLimit() != null) {
            int additionalActivation = wasActive ? 0 : 1;
            long futureActiveCount = planSnapshot.activeProductCount() + reservedActivations + additionalActivation;
            if (futureActiveCount > planSnapshot.productLimit()) {
                shouldBeActive = false;
            }
        }

        boolean createdProduct = false;
        boolean updatedProduct = false;

        if (product == null) {
            product = Product.builder()
                    .store(store)
                    .sku(normalizedSku)
                    .active(shouldBeActive)
                    .build();
            createdProduct = true;
        } else if (!normalizedSku.equals(product.getSku())
                || !safeEquals(product.getName(), item.name())
                || !safeEquals(product.getCategory(), normalize(item.category()))
                || !safeEquals(product.getBarcode(), normalize(item.barcode()))
                || !safeEquals(product.getShopifyProductGid(), normalize(item.shopifyProductGid()))
                || !safeEquals(product.getShopifyVariantGid(), variantGid)
                || !safeEquals(product.getShopifyInventoryItemGid(), normalize(item.shopifyInventoryItemGid()))
                || !safeEquals(product.getProductImageUrl(), normalize(item.productImageUrl()))
                || !safeEquals(product.getUnitCost(), item.unitCost())
                || !safeEquals(product.getActive(), shouldBeActive)) {
            updatedProduct = true;
        }

        product.setSku(normalizedSku);
        product.setName(resolveProductName(item));
        product.setCategory(normalize(item.category()));
        product.setUnit("units");
        product.setUnitCost(item.unitCost());
        product.setBarcode(normalize(item.barcode()));
        product.setSupplierName(normalize(item.vendor()));
        product.setShopifyProductGid(normalize(item.shopifyProductGid()));
        product.setShopifyVariantGid(variantGid);
        product.setShopifyInventoryItemGid(normalize(item.shopifyInventoryItemGid()));
        product.setProductImageUrl(normalize(item.productImageUrl()));
        product.setActive(shouldBeActive);

        Product saved = productRepository.save(product);
        boolean createdInventorySnapshot = syncInventory(store, saved, item.inventoryQuantity());
        boolean productActivated = !wasActive && Boolean.TRUE.equals(saved.getActive());

        return new SyncOutcome(createdProduct, updatedProduct, createdInventorySnapshot, productActivated);
    }

    private boolean syncInventory(Store store, Product product, BigDecimal quantity) {
        BigDecimal normalizedQuantity = quantity != null ? quantity : BigDecimal.ZERO;
        Inventory latest = inventoryRepository.findLatestByProductId(product.getId()).orElse(null);
        if (latest != null && latest.getQuantity().compareTo(normalizedQuantity) == 0) {
            return false;
        }

        inventoryRepository.save(Inventory.builder()
                .store(store)
                .product(product)
                .quantity(normalizedQuantity)
                .adjustmentReason("SHOPIFY_SYNC")
                .adjustmentNote("Initial Shopify catalog bootstrap")
                .adjustedBy("shopify-sync")
                .build());
        return true;
    }

    private String resolveProductName(ShopifyCatalogItem item) {
        String variantTitle = normalize(item.variantTitle());
        if (variantTitle == null || "default title".equalsIgnoreCase(variantTitle)) {
            return item.name().trim();
        }
        return item.name().trim() + " - " + variantTitle;
    }

    private String normalizeSku(String sku, String variantGid) {
        String normalized = normalize(sku);
        if (normalized != null) {
            return normalized;
        }
        return "shopify-" + variantGid.substring(variantGid.lastIndexOf("/") + 1).toLowerCase(Locale.ROOT);
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private boolean safeEquals(Object left, Object right) {
        if (left == null) {
            return right == null;
        }
        return left.equals(right);
    }

    public record CatalogSyncRequest(String shopDomain, List<ShopifyCatalogItem> items) {
        public CatalogSyncRequest {
            items = items != null ? items : new ArrayList<>();
        }
    }

    public record ShopifyCatalogItem(
            String shopifyProductGid,
            String shopifyVariantGid,
            String shopifyInventoryItemGid,
            String productImageUrl,
            String sku,
            String name,
            String variantTitle,
            String category,
            String vendor,
            String barcode,
            BigDecimal unitCost,
            BigDecimal inventoryQuantity,
            boolean active
    ) {
    }

    @Builder
    public record CatalogSyncResult(
            String shopDomain,
            int processedItems,
            int createdProducts,
            int updatedProducts,
            int inventorySnapshotsCreated
    ) {
    }

    @Builder
    public record ProductDeactivateResult(
            String shopDomain,
            String shopifyProductGid,
            int deactivatedProducts
    ) {
    }

    @Builder
    public record InventorySyncResult(
            String shopDomain,
            UUID productId,
            String shopifyInventoryItemGid,
            BigDecimal quantity,
            boolean inventorySnapshotCreated
    ) {
    }

    private record SyncOutcome(
            boolean createdProduct,
            boolean updatedProduct,
            boolean createdInventorySnapshot,
            boolean productActivated
    ) {
    }
}
