package com.forestock.forestock_backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.forestock.forestock_backend.domain.Product;
import com.forestock.forestock_backend.domain.ShopifyConnection;
import com.forestock.forestock_backend.domain.ShopifyOrder;
import com.forestock.forestock_backend.domain.ShopifyOrderLineItem;
import com.forestock.forestock_backend.repository.ProductRepository;
import com.forestock.forestock_backend.repository.ShopifyConnectionRepository;
import com.forestock.forestock_backend.repository.ShopifyOrderLineItemRepository;
import com.forestock.forestock_backend.repository.ShopifyOrderRepository;
import lombok.Builder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ShopifyOrderBackfillService {

    private final ShopifyConnectionRepository shopifyConnectionRepository;
    private final ShopifyOrderRepository shopifyOrderRepository;
    private final ShopifyOrderLineItemRepository shopifyOrderLineItemRepository;
    private final ProductRepository productRepository;
    private final AuditLogService auditLogService;
    private final ForecastTriggerService forecastTriggerService;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    @Transactional
    public BackfillResult backfill(BackfillRequest request) {
        String shopDomain = normalize(request.shopDomain());
        if (shopDomain == null) {
            throw new IllegalArgumentException("Shop domain is required");
        }

        ShopifyConnection connection = shopifyConnectionRepository.findByShopDomain(shopDomain)
                .orElseThrow(() -> new NoSuchElementException("No Shopify connection found for domain: " + shopDomain));

        UUID storeId = connection.getStore().getId();
        Map<String, Product> productsByVariantGid = new HashMap<>();
        Map<String, Product> productsBySku = new HashMap<>();
        for (Product product : productRepository.findByStoreId(storeId)) {
            if (product.getShopifyVariantGid() != null && !product.getShopifyVariantGid().isBlank()) {
                productsByVariantGid.put(product.getShopifyVariantGid(), product);
            }
            if (product.getSku() != null && !product.getSku().isBlank()) {
                productsBySku.put(product.getSku(), product);
            }
        }

        int importedOrders = 0;
        int duplicateOrders = 0;
        int matchedLineItems = 0;
        int unmatchedLineItems = 0;
        int salesRowsUpserted = 0;

        for (BackfillOrder orderRequest : request.orders()) {
            if (orderRequest.shopifyOrderId() == null) {
                continue;
            }

            if (shopifyOrderRepository.existsByStoreIdAndShopifyOrderId(storeId, orderRequest.shopifyOrderId())) {
                duplicateOrders++;
                continue;
            }

            LocalDateTime createdAt = parseTimestamp(orderRequest.createdAt());
            if (createdAt == null) {
                log.warn("Skipping Shopify order {} because createdAt is missing", orderRequest.shopifyOrderId());
                continue;
            }

            ShopifyOrder savedOrder = shopifyOrderRepository.save(ShopifyOrder.builder()
                    .store(connection.getStore())
                    .shopifyOrderId(orderRequest.shopifyOrderId())
                    .shopifyOrderNumber(orderRequest.orderNumber())
                    .shopifyOrderName(orderRequest.orderName())
                    .financialStatus(orderRequest.financialStatus())
                    .fulfillmentStatus(orderRequest.fulfillmentStatus())
                    .totalPrice(orderRequest.totalPrice())
                    .subtotalPrice(orderRequest.subtotalPrice())
                    .currency(orderRequest.currency())
                    .orderCreatedAt(createdAt)
                    .orderUpdatedAt(parseTimestamp(orderRequest.updatedAt()))
                    .rawPayload(objectMapper.valueToTree(orderRequest))
                    .processed(true)
                    .processedAt(LocalDateTime.now())
                    .build());

            Map<UUID, Map<LocalDate, BigDecimal>> salesAggregation = new HashMap<>();
            LocalDate saleDate = createdAt.toLocalDate();

            for (BackfillLineItem lineItem : orderRequest.lineItems()) {
                Product matchedProduct = findMatchedProduct(productsByVariantGid, productsBySku, lineItem);
                shopifyOrderLineItemRepository.save(ShopifyOrderLineItem.builder()
                        .store(connection.getStore())
                        .shopifyOrder(savedOrder)
                        .shopifyLineItemId(lineItem.shopifyLineItemId())
                        .product(matchedProduct)
                        .sku(normalize(lineItem.sku()))
                        .title(lineItem.title())
                        .variantTitle(lineItem.variantTitle())
                        .quantity(lineItem.quantity())
                        .price(lineItem.price())
                        .matched(matchedProduct != null)
                        .build());

                if (matchedProduct != null) {
                    matchedLineItems++;
                    salesAggregation
                            .computeIfAbsent(matchedProduct.getId(), ignored -> new HashMap<>())
                            .merge(saleDate, BigDecimal.valueOf(lineItem.quantity()), BigDecimal::add);
                } else {
                    unmatchedLineItems++;
                }
            }

            salesRowsUpserted += upsertSalesTransactions(storeId, salesAggregation);
            importedOrders++;
        }

        auditLogService.log(
                "SHOPIFY_ORDER_BACKFILLED",
                "Store",
                connection.getStore().getId().toString(),
                String.format(
                        "Imported %d Shopify orders (%d duplicates skipped, %d matched line items, %d unmatched, %d sales rows)",
                        importedOrders,
                        duplicateOrders,
                        matchedLineItems,
                        unmatchedLineItems,
                        salesRowsUpserted
                )
        );

        BackfillResult result = BackfillResult.builder()
                .shopDomain(shopDomain)
                .importedOrders(importedOrders)
                .duplicateOrders(duplicateOrders)
                .matchedLineItems(matchedLineItems)
                .unmatchedLineItems(unmatchedLineItems)
                .salesRowsUpserted(salesRowsUpserted)
                .build();

        if (salesRowsUpserted > 0 || importedOrders > 0) {
            forecastTriggerService.triggerForStore(storeId, "shopify-order-backfill");
        }

        return result;
    }

    private Product findMatchedProduct(Map<String, Product> productsByVariantGid,
                                       Map<String, Product> productsBySku,
                                       BackfillLineItem lineItem) {
        String variantGid = normalize(lineItem.shopifyVariantGid());
        if (variantGid != null && productsByVariantGid.containsKey(variantGid)) {
            return productsByVariantGid.get(variantGid);
        }

        String sku = normalize(lineItem.sku());
        if (sku != null) {
            return productsBySku.get(sku);
        }
        return null;
    }

    private int upsertSalesTransactions(UUID storeId, Map<UUID, Map<LocalDate, BigDecimal>> aggregation) {
        if (aggregation.isEmpty()) {
            return 0;
        }

        String sql = """
                INSERT INTO sales_transactions (id, store_id, product_id, sale_date, quantity_sold)
                VALUES (gen_random_uuid(), ?, ?, ?, ?)
                ON CONFLICT (product_id, sale_date)
                DO UPDATE SET quantity_sold = sales_transactions.quantity_sold + EXCLUDED.quantity_sold
                """;

        int count = 0;
        for (Map.Entry<UUID, Map<LocalDate, BigDecimal>> productEntry : aggregation.entrySet()) {
            for (Map.Entry<LocalDate, BigDecimal> dateEntry : productEntry.getValue().entrySet()) {
                jdbcTemplate.update(sql, storeId, productEntry.getKey(), dateEntry.getKey(), dateEntry.getValue());
                count++;
            }
        }
        return count;
    }

    private LocalDateTime parseTimestamp(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return OffsetDateTime.parse(value).toLocalDateTime();
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    public record BackfillRequest(String shopDomain, List<BackfillOrder> orders) {
    }

    public record BackfillOrder(
            Long shopifyOrderId,
            String orderNumber,
            String orderName,
            String financialStatus,
            String fulfillmentStatus,
            BigDecimal totalPrice,
            BigDecimal subtotalPrice,
            String currency,
            String createdAt,
            String updatedAt,
            List<BackfillLineItem> lineItems
    ) {
    }

    public record BackfillLineItem(
            Long shopifyLineItemId,
            String shopifyVariantGid,
            String sku,
            String title,
            String variantTitle,
            int quantity,
            BigDecimal price
    ) {
    }

    @Builder
    public record BackfillResult(
            String shopDomain,
            int importedOrders,
            int duplicateOrders,
            int matchedLineItems,
            int unmatchedLineItems,
            int salesRowsUpserted
    ) {
    }
}
