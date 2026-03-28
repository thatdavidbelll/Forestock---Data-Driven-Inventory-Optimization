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
import com.forestock.forestock_backend.service.ProductBulkImportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.LinkedHashMap;
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
    private final ProductBulkImportService productBulkImportService;

    // ── Read ─────────────────────────────────────────────────────────────────

    /**
     * GET /api/products?includeInactive=false
     * Returns all products for the current store.
     * Use includeInactive=true to also see deactivated products.
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<ProductDto>>> listAll(
            @RequestParam(defaultValue = "false") boolean includeInactive,
            @RequestParam(required = false) String search) {
        UUID storeId = TenantContext.getStoreId();
        List<ProductDto> products = (storeId != null
                ? productRepository.searchByStoreId(storeId, includeInactive, normalizeSearch(search))
                : (includeInactive
                        ? productRepository.findAll()
                        : productRepository.findByActiveTrue()))
                .stream()
                .map(this::toDto)
                .toList();
        return ResponseEntity.ok(ApiResponse.success(products));
    }

    @PostMapping("/import")
    public ResponseEntity<ApiResponse<Map<String, Object>>> importProducts(
            @RequestParam("file") MultipartFile file,
            @RequestParam(defaultValue = "false") boolean updateExisting) throws IOException {
        ProductBulkImportService.ImportResult result = productBulkImportService.importCsv(file, updateExisting);
        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "imported", result.imported(),
                "skipped", result.skipped(),
                "errors", result.errors()
        )));
    }

    @GetMapping("/export/csv")
    public ResponseEntity<byte[]> exportProductsCsv(
            @RequestParam(defaultValue = "false") boolean templateOnly) throws IOException {
        byte[] csv = productBulkImportService.exportCsv(templateOnly);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=products.csv")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(csv);
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
    public ResponseEntity<ApiResponse<ProductDto>> create(@RequestBody ProductDto request) {
        UUID storeId = TenantContext.getStoreId();
        if (storeId == null) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(ApiResponse.error("No store context"));
        }

        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new NoSuchElementException("Store not found"));

        if (productRepository.existsByStoreIdAndSku(storeId, request.getSku())) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(ApiResponse.error("SKU already exists: " + request.getSku()));
        }

        Product product = Product.builder()
                .store(store)
                .sku(request.getSku())
                .name(request.getName())
                .category(request.getCategory())
                .unit(request.getUnit())
                .reorderPoint(request.getReorderPoint())
                .maxStock(request.getMaxStock())
                .leadTimeDays(request.getLeadTimeDays())
                .minimumOrderQty(request.getMinimumOrderQty())
                .unitCost(request.getUnitCost())
                .supplierName(request.getSupplierName())
                .supplierContact(request.getSupplierContact())
                .barcode(request.getBarcode())
                .storageLocation(request.getStorageLocation())
                .notes(request.getNotes())
                .active(request.getActive())
                .build();
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
            @RequestBody ProductDto updates) {
        return productRepository.findById(id)
                .map(existing -> {
                    if (isAccessDenied(existing)) return FORBIDDEN;
                    Map<String, Object> before = new LinkedHashMap<>();
                    before.put("name", existing.getName());
                    before.put("category", existing.getCategory());
                    before.put("unit", existing.getUnit());
                    before.put("reorderPoint", existing.getReorderPoint());
                    before.put("maxStock", existing.getMaxStock());
                    before.put("leadTimeDays", existing.getLeadTimeDays());
                    before.put("minimumOrderQty", existing.getMinimumOrderQty());
                    before.put("unitCost", existing.getUnitCost());
                    before.put("supplierName", existing.getSupplierName());
                    before.put("active", existing.getActive());
                    existing.setName(updates.getName());
                    existing.setCategory(updates.getCategory());
                    existing.setUnit(updates.getUnit());
                    existing.setReorderPoint(updates.getReorderPoint());
                    existing.setMaxStock(updates.getMaxStock());
                    existing.setLeadTimeDays(updates.getLeadTimeDays());
                    existing.setMinimumOrderQty(updates.getMinimumOrderQty());
                    existing.setUnitCost(updates.getUnitCost());
                    existing.setSupplierName(updates.getSupplierName());
                    existing.setSupplierContact(updates.getSupplierContact());
                    existing.setBarcode(updates.getBarcode());
                    existing.setStorageLocation(updates.getStorageLocation());
                    existing.setNotes(updates.getNotes());
                    existing.setActive(updates.getActive());
                    Product saved = productRepository.save(existing);
                    Map<String, Object> after = new LinkedHashMap<>();
                    after.put("name", saved.getName());
                    after.put("category", saved.getCategory());
                    after.put("unit", saved.getUnit());
                    after.put("reorderPoint", saved.getReorderPoint());
                    after.put("maxStock", saved.getMaxStock());
                    after.put("leadTimeDays", saved.getLeadTimeDays());
                    after.put("minimumOrderQty", saved.getMinimumOrderQty());
                    after.put("unitCost", saved.getUnitCost());
                    after.put("supplierName", saved.getSupplierName());
                    after.put("active", saved.getActive());
                    Map<String, Object> extra = new LinkedHashMap<>();
                    extra.put("sku", saved.getSku());
                    auditLogService.logChange(
                            "PRODUCT_UPDATED",
                            "Product",
                            saved.getId().toString(),
                            before,
                            after,
                            extra
                    );
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

    private String normalizeSearch(String search) {
        if (search == null) return null;
        String trimmed = search.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

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
                .leadTimeDays(p.getLeadTimeDays())
                .minimumOrderQty(p.getMinimumOrderQty())
                .unitCost(p.getUnitCost())
                .supplierName(p.getSupplierName())
                .supplierContact(p.getSupplierContact())
                .barcode(p.getBarcode())
                .storageLocation(p.getStorageLocation())
                .notes(p.getNotes())
                .active(p.getActive())
                .createdAt(p.getCreatedAt())
                .build();
    }
}
