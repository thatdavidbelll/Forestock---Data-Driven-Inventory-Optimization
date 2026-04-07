package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.domain.Product;
import com.forestock.forestock_backend.domain.StoreConfiguration;
import com.forestock.forestock_backend.repository.InventoryRepository;
import com.forestock.forestock_backend.repository.ProductRepository;
import com.forestock.forestock_backend.repository.SalesTransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReportServiceTest {

    @Mock
    private ProductRepository productRepository;

    @Mock
    private InventoryRepository inventoryRepository;

    @Mock
    private SalesTransactionRepository salesTransactionRepository;

    @Mock
    private InventoryService inventoryService;

    @Mock
    private StoreConfigurationService storeConfigurationService;

    private ReportService reportService;

    @BeforeEach
    void setUp() {
        reportService = new ReportService(
                productRepository,
                inventoryRepository,
                salesTransactionRepository,
                inventoryService,
                storeConfigurationService
        );
    }

    @Test
    void generateSalesReport_fallsBackWhenTimezoneInvalid() throws Exception {
        UUID storeId = UUID.randomUUID();

        Product product = Product.builder()
                .id(UUID.randomUUID())
                .sku("SKU-1")
                .name("Test Product")
                .category("Category")
                .active(true)
                .build();

        StoreConfiguration config = StoreConfiguration.builder()
                .timezone("not/a-real-timezone")
                .build();

        when(storeConfigurationService.getConfigForStore(storeId)).thenReturn(config);
        when(salesTransactionRepository.findBySaleDateBetweenAndStoreId(any(), any(), any())).thenReturn(List.of());
        when(productRepository.findByStoreIdAndActiveTrue(storeId)).thenReturn(List.of(product));

        byte[] bytes = reportService.generateSalesReport(storeId, java.time.LocalDate.now().minusDays(29), java.time.LocalDate.now(), "excel");

        assertThat(bytes).isNotNull();
        assertThat(bytes.length).isGreaterThan(0);
    }
}
