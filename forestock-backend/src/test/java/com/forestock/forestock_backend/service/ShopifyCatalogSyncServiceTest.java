package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.domain.ShopifyConnection;
import com.forestock.forestock_backend.domain.Store;
import com.forestock.forestock_backend.domain.enums.StorePlanTier;
import com.forestock.forestock_backend.repository.InventoryRepository;
import com.forestock.forestock_backend.repository.ProductRepository;
import com.forestock.forestock_backend.repository.ShopifyConnectionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ShopifyCatalogSyncServiceTest {

    @Mock
    private ShopifyConnectionRepository shopifyConnectionRepository;

    @Mock
    private ProductRepository productRepository;

    @Mock
    private InventoryRepository inventoryRepository;

    @Mock
    private AuditLogService auditLogService;

    @Mock
    private ForecastTriggerService forecastTriggerService;

    @Mock
    private StorePlanService storePlanService;

    @InjectMocks
    private ShopifyCatalogSyncService service;

    @Test
    void syncCatalog_importsOverLimitProductsAsInactive() {
        UUID storeId = UUID.randomUUID();
        Store store = Store.builder().id(storeId).name("Demo").build();
        ShopifyConnection connection = ShopifyConnection.builder()
                .store(store)
                .shopDomain("demo.myshopify.com")
                .active(true)
                .planTier(StorePlanTier.FREE)
                .productLimit(15)
                .build();

        when(shopifyConnectionRepository.findByShopDomain("demo.myshopify.com"))
                .thenReturn(Optional.of(connection));
        when(storePlanService.getPlanForStore(storeId))
                .thenReturn(new StorePlanService.PlanSnapshot(StorePlanTier.FREE, 15, 15, 0, false, true, null));
        when(productRepository.findByStoreIdAndShopifyVariantGid(storeId, "gid://shopify/ProductVariant/1"))
                .thenReturn(Optional.empty());
        when(productRepository.findByStoreIdAndSku(storeId, "SKU-1"))
                .thenReturn(Optional.empty());
        when(productRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(inventoryRepository.findLatestByProductId(any())).thenReturn(Optional.empty());

        var result = service.syncCatalog(new ShopifyCatalogSyncService.CatalogSyncRequest(
                "demo.myshopify.com",
                List.of(new ShopifyCatalogSyncService.ShopifyCatalogItem(
                        "gid://shopify/Product/1",
                        "gid://shopify/ProductVariant/1",
                        "gid://shopify/InventoryItem/1",
                        null,
                        "SKU-1",
                        "Imported Product",
                        null,
                        "Snacks",
                        "Vendor",
                        null,
                        BigDecimal.TEN,
                        BigDecimal.ONE,
                        true
                ))
        ));

        ArgumentCaptor<com.forestock.forestock_backend.domain.Product> productCaptor =
                ArgumentCaptor.forClass(com.forestock.forestock_backend.domain.Product.class);
        verify(productRepository).save(productCaptor.capture());

        assertThat(result.createdProducts()).isEqualTo(1);
        assertThat(result.updatedProducts()).isZero();
        assertThat(productCaptor.getValue().getActive()).isFalse();
    }
}
