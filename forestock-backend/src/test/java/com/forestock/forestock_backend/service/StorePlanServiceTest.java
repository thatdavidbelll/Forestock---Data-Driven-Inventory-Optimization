package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.domain.ShopifyConnection;
import com.forestock.forestock_backend.domain.Store;
import com.forestock.forestock_backend.domain.enums.StorePlanTier;
import com.forestock.forestock_backend.repository.ProductRepository;
import com.forestock.forestock_backend.repository.ShopifyConnectionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StorePlanServiceTest {

    @Mock
    private ShopifyConnectionRepository shopifyConnectionRepository;

    @Mock
    private ProductRepository productRepository;

    @InjectMocks
    private StorePlanService storePlanService;

    @Test
    void syncPlanForShop_setsPaidTierAndUnlimitedLimit() {
        UUID storeId = UUID.randomUUID();
        Store store = Store.builder().id(storeId).name("Demo Store").build();
        ShopifyConnection connection = ShopifyConnection.builder()
                .store(store)
                .shopDomain("demo.myshopify.com")
                .active(true)
                .planTier(StorePlanTier.FREE)
                .productLimit(15)
                .planChoiceConfirmed(false)
                .build();

        when(shopifyConnectionRepository.findByShopDomainAndActiveTrue("demo.myshopify.com"))
                .thenReturn(Optional.of(connection));
        when(shopifyConnectionRepository.save(connection)).thenReturn(connection);
        when(productRepository.countByStoreIdAndActiveTrue(storeId)).thenReturn(4L);

        StorePlanService.PlanSnapshot snapshot =
                storePlanService.syncPlanForShop("demo.myshopify.com", StorePlanTier.PAID);

        assertThat(snapshot.planTier()).isEqualTo(StorePlanTier.PAID);
        assertThat(snapshot.productLimit()).isNull();
        assertThat(snapshot.activeProductCount()).isEqualTo(4);
        assertThat(snapshot.remainingProductSlots()).isNull();
        assertThat(snapshot.overProductLimit()).isFalse();
        assertThat(snapshot.planChoiceConfirmed()).isTrue();
    }

    @Test
    void syncPlanForShop_keepsFreePlanUnconfirmedUntilMerchantChoosesIt() {
        UUID storeId = UUID.randomUUID();
        Store store = Store.builder().id(storeId).name("Demo Store").build();
        ShopifyConnection connection = ShopifyConnection.builder()
                .store(store)
                .shopDomain("demo.myshopify.com")
                .active(true)
                .planTier(StorePlanTier.FREE)
                .productLimit(15)
                .planChoiceConfirmed(false)
                .build();

        when(shopifyConnectionRepository.findByShopDomainAndActiveTrue("demo.myshopify.com"))
                .thenReturn(Optional.of(connection));
        when(shopifyConnectionRepository.save(connection)).thenReturn(connection);
        when(productRepository.countByStoreIdAndActiveTrue(storeId)).thenReturn(4L);

        StorePlanService.PlanSnapshot snapshot =
                storePlanService.syncPlanForShop("demo.myshopify.com", StorePlanTier.FREE);

        assertThat(snapshot.planTier()).isEqualTo(StorePlanTier.FREE);
        assertThat(snapshot.productLimit()).isEqualTo(15);
        assertThat(snapshot.planChoiceConfirmed()).isFalse();
    }

    @Test
    void confirmFreePlanChoiceForShop_marksChoiceConfirmed() {
        UUID storeId = UUID.randomUUID();
        Store store = Store.builder().id(storeId).name("Demo Store").build();
        ShopifyConnection connection = ShopifyConnection.builder()
                .store(store)
                .shopDomain("demo.myshopify.com")
                .active(true)
                .planTier(StorePlanTier.FREE)
                .productLimit(15)
                .planChoiceConfirmed(false)
                .build();

        when(shopifyConnectionRepository.findByShopDomainAndActiveTrue("demo.myshopify.com"))
                .thenReturn(Optional.of(connection));
        when(shopifyConnectionRepository.save(connection)).thenReturn(connection);
        when(productRepository.countByStoreIdAndActiveTrue(storeId)).thenReturn(4L);

        StorePlanService.PlanSnapshot snapshot =
                storePlanService.confirmFreePlanChoiceForShop("demo.myshopify.com");

        assertThat(snapshot.planTier()).isEqualTo(StorePlanTier.FREE);
        assertThat(snapshot.productLimit()).isEqualTo(15);
        assertThat(snapshot.planChoiceConfirmed()).isTrue();
    }

    @Test
    void getPlanForStore_marksFreeStoreOverLimit() {
        UUID storeId = UUID.randomUUID();
        Store store = Store.builder().id(storeId).name("Demo Store").build();
        ShopifyConnection connection = ShopifyConnection.builder()
                .store(store)
                .shopDomain("demo.myshopify.com")
                .active(true)
                .planTier(StorePlanTier.FREE)
                .productLimit(15)
                .build();

        when(shopifyConnectionRepository.findByStoreId(storeId)).thenReturn(Optional.of(connection));
        when(productRepository.countByStoreIdAndActiveTrue(storeId)).thenReturn(18L);

        StorePlanService.PlanSnapshot snapshot = storePlanService.getPlanForStore(storeId);

        assertThat(snapshot.planTier()).isEqualTo(StorePlanTier.FREE);
        assertThat(snapshot.productLimit()).isEqualTo(15);
        assertThat(snapshot.activeProductCount()).isEqualTo(18);
        assertThat(snapshot.remainingProductSlots()).isZero();
        assertThat(snapshot.overProductLimit()).isTrue();
        assertThat(snapshot.forecastAllowed()).isFalse();
        assertThat(snapshot.statusMessage()).contains("Reduce active products to 15 or upgrade");
        assertThat(snapshot.planChoiceConfirmed()).isFalse();
    }

    @Test
    void assertCanActivateAdditionalProducts_rejectsWhenFreeStoreIsAtLimit() {
        UUID storeId = UUID.randomUUID();
        Store store = Store.builder().id(storeId).name("Demo Store").build();
        ShopifyConnection connection = ShopifyConnection.builder()
                .store(store)
                .shopDomain("demo.myshopify.com")
                .active(true)
                .planTier(StorePlanTier.FREE)
                .productLimit(15)
                .planChoiceConfirmed(true)
                .build();

        when(shopifyConnectionRepository.findByStoreId(storeId)).thenReturn(Optional.of(connection));
        when(productRepository.countByStoreIdAndActiveTrue(storeId)).thenReturn(15L);

        assertThatThrownBy(() -> storePlanService.assertCanActivateAdditionalProducts(storeId, 1))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Free plan limit reached. Upgrade to track more than 15 active products.");
    }
}
