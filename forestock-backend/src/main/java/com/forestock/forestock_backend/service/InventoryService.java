package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.domain.Inventory;
import com.forestock.forestock_backend.domain.Product;
import com.forestock.forestock_backend.dto.response.InventoryDto;
import com.forestock.forestock_backend.repository.InventoryRepository;
import com.forestock.forestock_backend.repository.ProductRepository;
import com.forestock.forestock_backend.repository.StoreRepository;
import com.forestock.forestock_backend.security.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
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

    /**
     * Returns current stock for all active products in the current tenant's store.
     */
    @Transactional(readOnly = true)
    public List<InventoryDto> getCurrentStock() {
        UUID storeId = TenantContext.getStoreId();
        List<Inventory> inventories = storeId != null
                ? inventoryRepository.findLatestForAllProductsByStore(storeId)
                : inventoryRepository.findLatestForAllProducts();
        return inventories.stream().map(this::toDto).toList();
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
    public InventoryDto updateStock(UUID productId, BigDecimal quantity) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new NoSuchElementException("Product not found: " + productId));

        var store = product.getStore() != null ? product.getStore()
                : storeRepository.findById(TenantContext.getStoreId())
                        .orElseThrow(() -> new NoSuchElementException("Store not found"));

        Inventory snapshot = Inventory.builder()
                .store(store)
                .product(product)
                .quantity(quantity)
                .build();

        Inventory saved = inventoryRepository.save(snapshot);
        log.info("Stock updated: product={}, qty={}", product.getSku(), quantity);
        return toDto(saved);
    }

    /**
     * Returns the snapshot history for a product, ordered by recorded_at descending.
     */
    @Transactional(readOnly = true)
    public List<InventoryDto> getHistory(UUID productId) {
        if (!productRepository.existsById(productId)) {
            throw new NoSuchElementException("Product not found: " + productId);
        }
        return inventoryRepository.findByProductIdOrderByRecordedAtDesc(productId)
                .stream()
                .map(this::toDto)
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
        return inventoryRepository.findLatestByProductId(productId)
                .map(this::toDto)
                .orElseThrow(() -> new NoSuchElementException("No stock recorded for product: " + productId));
    }

    private InventoryDto toDto(Inventory inv) {
        Product p = inv.getProduct();
        boolean below = p.getReorderPoint() != null
                && inv.getQuantity().compareTo(p.getReorderPoint()) < 0;

        return InventoryDto.builder()
                .id(inv.getId())
                .productId(p.getId())
                .productSku(p.getSku())
                .productName(p.getName())
                .unit(p.getUnit())
                .quantity(inv.getQuantity())
                .reorderPoint(p.getReorderPoint())
                .belowReorderPoint(below)
                .recordedAt(inv.getRecordedAt())
                .build();
    }
}
