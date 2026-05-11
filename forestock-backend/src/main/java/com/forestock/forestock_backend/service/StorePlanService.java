package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.domain.ShopifyConnection;
import com.forestock.forestock_backend.domain.enums.StorePlanTier;
import com.forestock.forestock_backend.repository.ProductRepository;
import com.forestock.forestock_backend.repository.ShopifyConnectionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.NoSuchElementException;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class StorePlanService {

    private final ShopifyConnectionRepository shopifyConnectionRepository;
    private final ProductRepository productRepository;

    @Transactional
    public PlanSnapshot syncPlanForShop(String shopDomain, StorePlanTier planTier) {
        ShopifyConnection connection = shopifyConnectionRepository.findByShopDomainAndActiveTrue(shopDomain)
                .orElseThrow(() -> new NoSuchElementException("No active Shopify connection found for domain: " + shopDomain));

        connection.setPlanTier(planTier);
        connection.setProductLimit(planTier.getProductLimit());
        ShopifyConnection saved = shopifyConnectionRepository.save(connection);

        return buildSnapshot(saved.getStore().getId(), saved.getPlanTier(), saved.getProductLimit());
    }

    @Transactional(readOnly = true)
    public PlanSnapshot getPlanForStore(UUID storeId) {
        return shopifyConnectionRepository.findByStoreId(storeId)
                .map(connection -> buildSnapshot(storeId, connection.getPlanTier(), connection.getProductLimit()))
                .orElseGet(() -> buildSnapshot(storeId, StorePlanTier.PAID, null));
    }

    @Transactional(readOnly = true)
    public void assertCanActivateAdditionalProducts(UUID storeId, int additionalProducts) {
        if (additionalProducts <= 0) {
            return;
        }

        PlanSnapshot snapshot = getPlanForStore(storeId);
        if (snapshot.productLimit() == null) {
            return;
        }

        long projectedActiveProducts = snapshot.activeProductCount() + additionalProducts;
        if (projectedActiveProducts > snapshot.productLimit()) {
            throw new IllegalStateException("Free plan limit reached. Upgrade to track more than 15 active products.");
        }
    }

    private PlanSnapshot buildSnapshot(UUID storeId, StorePlanTier planTier, Integer productLimit) {
        long activeProductCount = productRepository.countByStoreIdAndActiveTrue(storeId);
        Integer remainingProductSlots = productLimit == null
                ? null
                : (int) Math.max(productLimit - activeProductCount, 0);
        boolean overProductLimit = productLimit != null && activeProductCount > productLimit;
        boolean forecastAllowed = !overProductLimit;
        String statusMessage = overProductLimit
                ? "Reduce active products to 15 or upgrade to continue running forecasts."
                : null;

        return new PlanSnapshot(
                planTier,
                productLimit,
                activeProductCount,
                remainingProductSlots,
                overProductLimit,
                forecastAllowed,
                statusMessage
        );
    }

    public record PlanSnapshot(
            StorePlanTier planTier,
            Integer productLimit,
            long activeProductCount,
            Integer remainingProductSlots,
            boolean overProductLimit,
            boolean forecastAllowed,
            String statusMessage
    ) {
    }
}
