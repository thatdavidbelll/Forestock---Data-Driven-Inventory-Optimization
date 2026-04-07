package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.domain.Inventory;
import com.forestock.forestock_backend.domain.Product;
import com.forestock.forestock_backend.domain.Store;
import com.forestock.forestock_backend.domain.StoreConfiguration;
import com.forestock.forestock_backend.dto.response.InventoryDto;
import com.forestock.forestock_backend.repository.InventoryRepository;
import com.forestock.forestock_backend.repository.OrderSuggestionRepository;
import com.forestock.forestock_backend.repository.ProductRepository;
import com.forestock.forestock_backend.repository.SalesTransactionRepository;
import com.forestock.forestock_backend.repository.StoreRepository;
import com.forestock.forestock_backend.security.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InventoryServiceTest {

    @Mock private InventoryRepository inventoryRepository;
    @Mock private ProductRepository productRepository;
    @Mock private StoreRepository storeRepository;
    @Mock private OrderSuggestionRepository orderSuggestionRepository;
    @Mock private SalesTransactionRepository salesTransactionRepository;
    @Mock private StoreConfigurationService storeConfigurationService;
    @Mock private AuditLogService auditLogService;

    @InjectMocks
    private InventoryService inventoryService;

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void getCurrentStock_usesLatestSnapshotPerProduct() {
        UUID storeId = UUID.randomUUID();
        UUID productId = UUID.randomUUID();

        Store store = Store.builder().id(storeId).name("Smoke Store").build();
        Product product = Product.builder()
                .id(productId)
                .store(store)
                .sku("SKU-001")
                .name("Test Product")
                .category("General")
                .unit("pcs")
                .reorderPoint(BigDecimal.TEN)
                .active(true)
                .build();

        Inventory latest = Inventory.builder()
                .id(UUID.randomUUID())
                .store(store)
                .product(product)
                .quantity(BigDecimal.valueOf(25))
                .adjustmentReason("INITIAL_STOCK")
                .adjustedBy("storeadmin")
                .recordedAt(LocalDateTime.now())
                .build();

        TenantContext.setStoreId(storeId);
        when(productRepository.findByStoreIdAndActiveTrue(storeId)).thenReturn(List.of(product));
        when(inventoryRepository.findLatestByProductId(productId)).thenReturn(Optional.of(latest));
        when(storeConfigurationService.getConfigForStore(storeId)).thenReturn(StoreConfiguration.builder()
                .id(UUID.randomUUID())
                .forecastHorizonDays(14)
                .build());

        List<InventoryDto> result = inventoryService.getCurrentStock();

        assertThat(result).hasSize(1);
        assertThat(result.getFirst().getProductId()).isEqualTo(productId);
        assertThat(result.getFirst().getQuantity()).isEqualByComparingTo("25");
        assertThat(result.getFirst().isBelowReorderPoint()).isFalse();
        verify(inventoryRepository).findLatestByProductId(productId);
        verify(inventoryRepository, never()).findLatestForAllProductsByStore(any());
    }

    @Test
    void getCurrentStockMap_usesLatestSnapshotPerProduct() {
        UUID storeId = UUID.randomUUID();
        UUID productId = UUID.randomUUID();

        Store store = Store.builder().id(storeId).name("Smoke Store").build();
        Product product = Product.builder()
                .id(productId)
                .store(store)
                .sku("SKU-001")
                .name("Test Product")
                .unit("pcs")
                .active(true)
                .build();

        Inventory latest = Inventory.builder()
                .id(UUID.randomUUID())
                .store(store)
                .product(product)
                .quantity(BigDecimal.valueOf(25))
                .recordedAt(LocalDateTime.now())
                .build();

        TenantContext.setStoreId(storeId);
        when(productRepository.findByStoreIdAndActiveTrue(storeId)).thenReturn(List.of(product));
        when(inventoryRepository.findLatestByProductId(productId)).thenReturn(Optional.of(latest));

        var result = inventoryService.getCurrentStockMap();

        assertThat(result).containsEntry(productId, BigDecimal.valueOf(25));
        verify(inventoryRepository).findLatestByProductId(productId);
        verify(inventoryRepository, never()).findLatestForAllProductsByStore(any());
    }
}
