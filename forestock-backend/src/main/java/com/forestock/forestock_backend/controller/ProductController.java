package com.forestock.forestock_backend.controller;

import com.forestock.forestock_backend.domain.Product;
import com.forestock.forestock_backend.domain.Store;
import com.forestock.forestock_backend.dto.response.ApiResponse;
import com.forestock.forestock_backend.dto.response.ProductDto;
import com.forestock.forestock_backend.repository.InventoryRepository;
import com.forestock.forestock_backend.repository.OrderSuggestionRepository;
import com.forestock.forestock_backend.repository.ProductRepository;
import com.forestock.forestock_backend.repository.SalesTransactionRepository;
import com.forestock.forestock_backend.repository.StoreRepository;
import com.forestock.forestock_backend.security.TenantContext;
import com.forestock.forestock_backend.service.AuditLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.UUID;

@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
public class ProductController {

    private final ProductRepository productRepository;
    private final StoreRepository storeRepository;
    private final SalesTransactionRepository salesTransactionRepository;
    private final InventoryRepository inventoryRepository;
    private final OrderSuggestionRepository orderSuggestionRepository;
    private final AuditLogService auditLogService;

    // ── Read ─────────────────────────────────────────────────────────────────

    /**
     * GET /api/products?includeInactive=false
     * Returns all products for the current store.
     * Use includeInactive=true to also see deactivated products.
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<ProductDto>>> listAll(
            @RequestParam(defaultValue = "false") boolean includeInactive) {
        UUID storeId = TenantContext.getStoreId();
        List<ProductDto> products = (storeId != null
                ? (includeInactive
                        ? productRepository.findByStoreId(storeId)
                        : productRepository.findByStoreIdAndActiveTrue(storeId))
                : (includeInactive
                        ? productRepository.findAll()
                        : productRepository.findByActiveTrue()))
                .stream()
                .map(this::toDto)
                .toList();
        return ResponseEntity.ok(ApiResponse.success(products));
    }

    /**
     * GET /api/products/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ProductDto>> getById(@PathVariable UUID id) {
        return productRepository.findById(id)
                .map(p -> isAccessDenied(p) ? FORBIDDEN
                        : ResponseEntity.ok(ApiResponse.success(toDto(p))))
                .orElse(ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(ApiResponse.error("Product not found")));
    }

    // ── Create ────────────────────────────────────────────────────────────────

    /**
     * POST /api/products
     */
    @PostMapping
    public ResponseEntity<ApiResponse<ProductDto>> create(@RequestBody Product product) {
        UUID storeId = TenantContext.getStoreId();
        if (storeId == null) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(ApiResponse.error("No store context"));
        }

        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new NoSuchElementException("Store not found"));

        if (productRepository.existsByStoreIdAndSku(storeId, product.getSku())) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(ApiResponse.error("SKU already exists: " + product.getSku()));
        }

        product.setStore(store);
        Product saved = productRepository.save(product);
        auditLogService.log("PRODUCT_CREATED", "Product", saved.getId().toString(),
                "Created product '" + saved.getSku() + "' (" + saved.getName() + ")");
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Product created", toDto(saved)));
    }

    // ── Update ────────────────────────────────────────────────────────────────

    /**
     * PUT /api/products/{id}
     * Updates product fields. Use active=false to deactivate (soft delete).
     */
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<ProductDto>> update(
            @PathVariable UUID id,
            @RequestBody Product updates) {
        return productRepository.findById(id)
                .map(existing -> {
                    if (isAccessDenied(existing)) return FORBIDDEN;
                    existing.setName(updates.getName());
                    existing.setCategory(updates.getCategory());
                    existing.setUnit(updates.getUnit());
                    existing.setReorderPoint(updates.getReorderPoint());
                    existing.setMaxStock(updates.getMaxStock());
                    existing.setActive(updates.getActive());
                    Product saved = productRepository.save(existing);
                    auditLogService.log("PRODUCT_UPDATED", "Product", saved.getId().toString(),
                            "Updated product '" + saved.getSku() + "' (" + saved.getName() + "), active=" + saved.getActive());
                    return ResponseEntity.ok(ApiResponse.success(toDto(saved)));
                })
                .orElse(ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(ApiResponse.error("Product not found")));
    }

    /**
     * PUT /api/products/{id}/restore
     * Reactivates a previously deactivated (soft-deleted) product.
     */
    @PutMapping("/{id}/restore")
    public ResponseEntity<ApiResponse<ProductDto>> restore(@PathVariable UUID id) {
        return productRepository.findById(id)
                .map(p -> {
                    if (isAccessDenied(p)) return FORBIDDEN;
                    if (Boolean.TRUE.equals(p.getActive())) {
                        return ResponseEntity.status(HttpStatus.CONFLICT)
                                .body(ApiResponse.<ProductDto>error("Product is already active"));
                    }
                    p.setActive(true);
                    Product saved = productRepository.save(p);
                    auditLogService.log("PRODUCT_RESTORED", "Product", saved.getId().toString(),
                            "Restored product '" + saved.getSku() + "'");
                    return ResponseEntity.ok(ApiResponse.success("Product restored", toDto(saved)));
                })
                .orElse(ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(ApiResponse.error("Product not found")));
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    /**
     * DELETE /api/products/{id}
     * Soft delete — marks product as inactive. Preserves all historical data.
     * The product won't appear in forecasts or suggestions until restored.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deactivate(@PathVariable UUID id) {
        return productRepository.findById(id)
                .map(p -> {
                    if (isAccessDenied(p))
                        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                                .body(ApiResponse.<Void>error("Access denied"));
                    p.setActive(false);
                    productRepository.save(p);
                    auditLogService.log("PRODUCT_DEACTIVATED", "Product", p.getId().toString(),
                            "Deactivated product '" + p.getSku() + "'");
                    return ResponseEntity.ok(ApiResponse.<Void>success("Product deactivated", null));
                })
                .orElse(ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(ApiResponse.error("Product not found")));
    }

    /**
     * DELETE /api/products/{id}/hard
     * Permanent deletion — removes the product and ALL its associated data:
     * order suggestions, sales transactions, inventory snapshots.
     * This cannot be undone.
     */
    @DeleteMapping("/{id}/hard")
    @Transactional
    public ResponseEntity<ApiResponse<Map<String, Object>>> hardDelete(@PathVariable UUID id) {
        return productRepository.findById(id)
                .map(p -> {
                    if (isAccessDenied(p))
                        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                                .body(ApiResponse.<Map<String, Object>>error("Access denied"));
                    int suggestions  = orderSuggestionRepository.deleteByProductId(p.getId());
                    int transactions = salesTransactionRepository.deleteByProductId(p.getId());
                    int inventory    = inventoryRepository.deleteByProductId(p.getId());
                    productRepository.deleteById(p.getId());

                    Map<String, Object> summary = Map.of(
                            "sku",          p.getSku(),
                            "suggestions",  suggestions,
                            "transactions", transactions,
                            "inventory",    inventory
                    );
                    auditLogService.log("PRODUCT_HARD_DELETED", "Product", p.getId().toString(),
                            "Hard-deleted product '" + p.getSku() + "' with " + transactions
                                    + " transactions, " + inventory + " inventory rows, " + suggestions + " suggestions removed");
                    return ResponseEntity.ok(ApiResponse.success(
                            "Product '" + p.getSku() + "' permanently deleted", summary));
                })
                .orElse(ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(ApiResponse.error("Product not found")));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Returns 403 if the product belongs to a different store than the current tenant. */
    private boolean isAccessDenied(Product p) {
        UUID storeId = TenantContext.getStoreId();
        if (storeId == null) return false; // no tenant context (e.g. admin without store)
        return p.getStore() == null || !storeId.equals(p.getStore().getId());
    }

    private static final ResponseEntity<ApiResponse<ProductDto>> FORBIDDEN =
            ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error("Access denied"));

    // ── Mapping ───────────────────────────────────────────────────────────────

    private ProductDto toDto(Product p) {
        return ProductDto.builder()
                .id(p.getId())
                .sku(p.getSku())
                .name(p.getName())
                .category(p.getCategory())
                .unit(p.getUnit())
                .reorderPoint(p.getReorderPoint())
                .maxStock(p.getMaxStock())
                .active(p.getActive())
                .createdAt(p.getCreatedAt())
                .build();
    }
}
