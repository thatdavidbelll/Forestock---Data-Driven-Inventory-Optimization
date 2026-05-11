package com.forestock.forestock_backend.controller;

import com.forestock.forestock_backend.dto.response.ProductDto;
import com.forestock.forestock_backend.repository.InventoryRepository;
import com.forestock.forestock_backend.repository.OrderSuggestionRepository;
import com.forestock.forestock_backend.repository.ProductRepository;
import com.forestock.forestock_backend.repository.SalesTransactionRepository;
import com.forestock.forestock_backend.repository.StoreRepository;
import com.forestock.forestock_backend.security.TenantContext;
import com.forestock.forestock_backend.service.AuditLogService;
import com.forestock.forestock_backend.service.ForecastTriggerService;
import com.forestock.forestock_backend.service.ProductBulkImportService;
import com.forestock.forestock_backend.service.StorePlanService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.math.BigDecimal;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;

class ProductControllerPlanLimitTest {

    @Test
    void create_returnsConflictWhenFreePlanIsAtLimit() {
        UUID storeId = UUID.fromString("00000000-0000-0000-0000-000000000001");
        ProductRepository productRepository = mock(ProductRepository.class);
        StoreRepository storeRepository = mock(StoreRepository.class);
        SalesTransactionRepository salesTransactionRepository = mock(SalesTransactionRepository.class);
        InventoryRepository inventoryRepository = mock(InventoryRepository.class);
        OrderSuggestionRepository orderSuggestionRepository = mock(OrderSuggestionRepository.class);
        AuditLogService auditLogService = mock(AuditLogService.class);
        ProductBulkImportService productBulkImportService = mock(ProductBulkImportService.class);
        ForecastTriggerService forecastTriggerService = mock(ForecastTriggerService.class);
        StorePlanService storePlanService = mock(StorePlanService.class);

        ProductController controller = new ProductController(
                productRepository,
                storeRepository,
                salesTransactionRepository,
                inventoryRepository,
                orderSuggestionRepository,
                auditLogService,
                productBulkImportService,
                forecastTriggerService,
                storePlanService
        );

        ProductDto request = ProductDto.builder()
                .sku("SKU-200")
                .name("Blocked Product")
                .unit("pcs")
                .active(true)
                .unitCost(BigDecimal.TEN)
                .build();

        doThrow(new IllegalStateException("Free plan limit reached. Upgrade to track more than 15 active products."))
                .when(storePlanService).assertCanActivateAdditionalProducts(storeId, 1);

        TenantContext.setStoreId(storeId);
        try {
            var response = controller.create(request);
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().getMessage())
                    .isEqualTo("Free plan limit reached. Upgrade to track more than 15 active products.");
        } finally {
            TenantContext.clear();
        }
    }
}
