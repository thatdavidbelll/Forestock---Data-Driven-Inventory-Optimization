package com.forestock.forestock_backend.service;
import com.forestock.forestock_backend.domain.Inventory;
import com.forestock.forestock_backend.domain.OrderSuggestion;
import com.forestock.forestock_backend.domain.Product;
import com.forestock.forestock_backend.domain.StoreConfiguration;
import com.forestock.forestock_backend.dto.response.InventoryDto;
import com.forestock.forestock_backend.dto.response.SlowMoverDto;
import com.forestock.forestock_backend.repository.InventoryRepository;
import com.forestock.forestock_backend.repository.OrderSuggestionRepository;
import com.forestock.forestock_backend.repository.ProductRepository;
import com.forestock.forestock_backend.repository.SalesTransactionRepository;
import com.forestock.forestock_backend.repository.StoreRepository;
import com.forestock.forestock_backend.security.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class InventoryService {

    private final InventoryRepository inventoryRepository;
    private final ProductRepository productRepository;
    private final StoreRepository storeRepository;
    private final OrderSuggestionRepository orderSuggestionRepository;
    private final SalesTransactionRepository salesTransactionRepository;
    private final StoreConfigurationService storeConfigurationService;
    private final AuditLogService auditLogService;

    /**
     * Returns current stock for all active products in the current tenant's store.
     */
    @Transactional(readOnly = true)
    public List<InventoryDto> getCurrentStock() {
        UUID storeId = TenantContext.getStoreId();
        List<Inventory> inventories = storeId != null
                ? inventoryRepository.findLatestForAllProductsByStore(storeId)
                : inventoryRepository.findLatestForAllProducts();

        Map<UUID, BigDecimal> p50DailyByProductId = storeId != null
                ? getP50DailyByProductId(storeId)
                : Map.of();

        return inventories.stream()
                .map(inventory -> toDto(inventory, p50DailyByProductId.get(inventory.getProduct().getId())))
                .toList();
    }

    /**
     * Returns products whose current stock is below their reorder point.
     */
    @Transactional(readOnly = true)
    public List<InventoryDto> getAlerts() {
        return getCurrentStock().stream()
                .filter(inv -> {
                    BigDecimal reorderPoint = inv.getReorderPoint();
                    return reorderPoint != null && inv.getQuantity().compareTo(reorderPoint) < 0;
                })
                .toList();
    }

    /**
     * Manually updates stock for a product by inserting a new snapshot.
     */
    @Transactional
    public InventoryDto updateStock(UUID productId, BigDecimal quantity, String adjustmentReason, String adjustmentNote) {
        UUID storeId = TenantContext.getStoreId();
        Product product = findStoreScopedProduct(productId, storeId);
        Inventory previousSnapshot = inventoryRepository.findLatestByProductId(productId).orElse(null);

        var store = product.getStore() != null ? product.getStore()
                : storeRepository.findById(storeId)
                        .orElseThrow(() -> new NoSuchElementException("Store not found"));

        Inventory snapshot = Inventory.builder()
                .store(store)
                .product(product)
                .quantity(quantity)
                .adjustmentReason(normalize(adjustmentReason))
                .adjustmentNote(normalize(adjustmentNote))
                .adjustedBy(resolveActorUsername())
                .build();

        Inventory saved = inventoryRepository.save(snapshot);
        Map<String, Object> before = new LinkedHashMap<>();
        before.put("quantity", previousSnapshot != null ? previousSnapshot.getQuantity() : null);
        Map<String, Object> after = new LinkedHashMap<>();
        after.put("quantity", saved.getQuantity());
        Map<String, Object> extra = new LinkedHashMap<>();
        extra.put("reason", saved.getAdjustmentReason());
        extra.put("note", saved.getAdjustmentNote());
        extra.put("adjustedBy", saved.getAdjustedBy());

        auditLogService.logChange(
                "INVENTORY_UPDATED",
                "Product",
                product.getId().toString(),
                before,
                after,
                extra
        );
        log.info("Stock updated: product={}, qty={}", product.getSku(), quantity);
        return toDto(saved, resolveP50Daily(productId, storeId));
    }

    /**
     * Returns the snapshot history for a product, ordered by recorded_at descending.
     */
    @Transactional(readOnly = true)
    public List<InventoryDto> getHistory(UUID productId) {
        UUID storeId = TenantContext.getStoreId();
        findStoreScopedProduct(productId, storeId);

        BigDecimal p50Daily = resolveP50Daily(productId, storeId);
        return inventoryRepository.findByProductIdOrderByRecordedAtDesc(productId)
                .stream()
                .map(inventory -> toDto(inventory, p50Daily))
                .toList();
    }

    /**
     * Returns a map of productId → current quantity for the current tenant's store.
     * Used by ForecastOrchestrator.
     */
    @Transactional(readOnly = true)
    public Map<UUID, BigDecimal> getCurrentStockMap() {
        UUID storeId = TenantContext.getStoreId();
        List<Inventory> inventories = storeId != null
                ? inventoryRepository.findLatestForAllProductsByStore(storeId)
                : inventoryRepository.findLatestForAllProducts();
        return inventories.stream()
                .collect(Collectors.toMap(
                        inv -> inv.getProduct().getId(),
                        Inventory::getQuantity));
    }

    /**
     * Returns the current stock for a specific product.
     */
    @Transactional(readOnly = true)
    public InventoryDto getCurrentStockForProduct(UUID productId) {
        UUID storeId = TenantContext.getStoreId();
        return inventoryRepository.findLatestByProductId(productId)
                .filter(inventory -> storeId == null
                        || (inventory.getProduct().getStore() != null
                        && storeId.equals(inventory.getProduct().getStore().getId())))
                .map(inventory -> toDto(inventory, resolveP50Daily(productId, storeId)))
                .orElseThrow(() -> new NoSuchElementException("No stock recorded for product: " + productId));
    }

    @Transactional(readOnly = true)
    public List<SlowMoverDto> getSlowMovers(int inactiveDays) {
        UUID storeId = TenantContext.getStoreId();
        if (storeId == null) {
            throw new IllegalStateException("No store context");
        }

        LocalDate cutoffDate = LocalDate.now().minusDays(inactiveDays);
        Map<UUID, LocalDate> lastSaleDateByProductId = salesTransactionRepository.findLatestSaleDateByStoreId(storeId).stream()
                .collect(Collectors.toMap(
                        row -> (UUID) row[0],
                        row -> (LocalDate) row[1]
                ));

        return getCurrentStock().stream()
                .filter(item -> item.getQuantity() != null && item.getQuantity().compareTo(BigDecimal.ZERO) > 0)
                .filter(item -> {
                    LocalDate lastSaleDate = lastSaleDateByProductId.get(item.getProductId());
                    return lastSaleDate == null || lastSaleDate.isBefore(cutoffDate);
                })
                .map(item -> {
                    Product product = findStoreScopedProduct(item.getProductId(), storeId);
                    LocalDate lastSaleDate = lastSaleDateByProductId.get(item.getProductId());
                    Long daysSinceLastSale = lastSaleDate != null
                            ? ChronoUnit.DAYS.between(lastSaleDate, LocalDate.now())
                            : null;
                    BigDecimal estimatedStockValue = product.getUnitCost() != null
                            ? item.getQuantity().multiply(product.getUnitCost()).setScale(2, RoundingMode.HALF_UP)
                            : null;

                    return SlowMoverDto.builder()
                            .productId(item.getProductId())
                            .sku(item.getProductSku())
                            .name(item.getProductName())
                            .category(item.getProductCategory())
                            .currentStock(item.getQuantity())
                            .lastSaleDate(lastSaleDate)
                            .daysSinceLastSale(daysSinceLastSale)
                            .estimatedStockValue(estimatedStockValue)
                            .build();
                })
                .sorted((left, right) -> {
                    long leftDays = left.getDaysSinceLastSale() != null ? left.getDaysSinceLastSale() : Long.MAX_VALUE;
                    long rightDays = right.getDaysSinceLastSale() != null ? right.getDaysSinceLastSale() : Long.MAX_VALUE;
                    return Long.compare(rightDays, leftDays);
                })
                .toList();
    }

    private Map<UUID, BigDecimal> getP50DailyByProductId(UUID storeId) {
        StoreConfiguration configuration = storeConfigurationService.getConfigForStore(storeId);
        BigDecimal horizonDays = BigDecimal.valueOf(configuration.getForecastHorizonDays());

        return orderSuggestionRepository.findLatestByStoreId(storeId).stream()
                .filter(suggestion -> suggestion.getForecastP50() != null)
                .collect(Collectors.toMap(
                        suggestion -> suggestion.getProduct().getId(),
                        suggestion -> suggestion.getForecastP50().divide(horizonDays, 4, RoundingMode.HALF_UP),
                        (left, right) -> left
                ));
    }

    private BigDecimal resolveP50Daily(UUID productId, UUID storeId) {
        if (storeId == null) {
            return null;
        }
        return getP50DailyByProductId(storeId).get(productId);
    }

    private Product findStoreScopedProduct(UUID productId, UUID storeId) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new NoSuchElementException("Product not found: " + productId));

        if (storeId != null && (product.getStore() == null || !storeId.equals(product.getStore().getId()))) {
            throw new NoSuchElementException("Product not found: " + productId);
        }
        return product;
    }

    private String resolveActorUsername() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null || authentication.getName().isBlank()) {
            return "system";
        }
        return authentication.getName();
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private InventoryDto toDto(Inventory inv, BigDecimal p50Daily) {
        Product p = inv.getProduct();
        boolean below = p.getReorderPoint() != null
                && inv.getQuantity().compareTo(p.getReorderPoint()) < 0;

        return InventoryDto.builder()
                .id(inv.getId())
                .productId(p.getId())
                .productSku(p.getSku())
                .productName(p.getName())
                .productCategory(p.getCategory())
                .unit(p.getUnit())
                .quantity(inv.getQuantity())
                .reorderPoint(p.getReorderPoint())
                .belowReorderPoint(below)
                .p50Daily(p50Daily)
                .adjustmentReason(inv.getAdjustmentReason())
                .adjustmentNote(inv.getAdjustmentNote())
                .adjustedBy(inv.getAdjustedBy())
                .recordedAt(inv.getRecordedAt())
                .build();
    }
}
