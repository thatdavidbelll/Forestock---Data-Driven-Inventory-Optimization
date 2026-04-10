package com.forestock.forestock_backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.forestock.forestock_backend.config.ShopifyProperties;
import com.forestock.forestock_backend.domain.Product;
import com.forestock.forestock_backend.domain.ShopifyConnection;
import com.forestock.forestock_backend.domain.ShopifyOrder;
import com.forestock.forestock_backend.domain.ShopifyOrderLineItem;
import com.forestock.forestock_backend.domain.ShopifyWebhookFailure;
import com.forestock.forestock_backend.domain.Store;
import com.forestock.forestock_backend.repository.ProductRepository;
import com.forestock.forestock_backend.repository.ShopifyConnectionRepository;
import com.forestock.forestock_backend.repository.ShopifyOrderLineItemRepository;
import com.forestock.forestock_backend.repository.ShopifyOrderRepository;
import com.forestock.forestock_backend.repository.ShopifyWebhookFailureRepository;
import com.forestock.forestock_backend.security.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ShopifyOrderIngestionService {

    private static final String TOPIC = "orders/create";

    private final ShopifyOrderRepository orderRepository;
    private final ShopifyOrderLineItemRepository lineItemRepository;
    private final ShopifyWebhookFailureRepository failureRepository;
    private final ShopifyConnectionRepository connectionRepository;
    private final ProductRepository productRepository;
    private final ForecastTriggerService forecastTriggerService;
    private final AuditLogService auditLogService;
    private final ShopifyProperties shopifyProperties;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    @Transactional
    public ShopifyIngestionResult processOrder(String shopDomain, String rawPayload) {
        JsonNode root;
        try {
            root = objectMapper.readTree(rawPayload);
        } catch (Exception e) {
            log.error("Failed to parse Shopify webhook JSON", e);
            persistFailure(null, shopDomain, TOPIC, null, wrapRawPayload(rawPayload), "JSON parse error: " + e.getMessage());
            return ShopifyIngestionResult.error("Invalid JSON payload");
        }

        ShopifyConnection connection = connectionRepository.findByShopDomainAndActiveTrue(shopDomain).orElse(null);
        if (connection == null) {
            log.warn("No active Shopify connection for domain: {}", shopDomain);
            persistFailure(null, shopDomain, TOPIC, extractOrderId(root), root,
                    "No active connection for domain: " + shopDomain);
            return ShopifyIngestionResult.error("Unknown shop domain: " + shopDomain);
        }

        UUID storeId = connection.getStore().getId();
        TenantContext.setStoreId(storeId);
        try {
            return processOrderInternal(root, connection, storeId);
        } catch (Exception e) {
            log.error("Shopify order processing failed for store {}", storeId, e);
            persistFailure(connection.getStore(), shopDomain, TOPIC, extractOrderId(root), root, e.getMessage());
            return ShopifyIngestionResult.error("Processing failed: " + e.getMessage());
        } finally {
            TenantContext.clear();
        }
    }

    private ShopifyIngestionResult processOrderInternal(JsonNode root, ShopifyConnection connection, UUID storeId) {
        Long shopifyOrderId = extractOrderId(root);
        if (shopifyOrderId == null) {
            throw new IllegalArgumentException("Shopify order payload is missing id");
        }

        if (orderRepository.existsByStoreIdAndShopifyOrderId(storeId, shopifyOrderId)) {
            log.info("Duplicate Shopify order {} for store {}, skipping", shopifyOrderId, storeId);
            return ShopifyIngestionResult.duplicate(shopifyOrderId);
        }

        LocalDateTime orderCreatedAt = parseShopifyTimestamp(root.path("created_at").asText(null));
        if (orderCreatedAt == null) {
            throw new IllegalArgumentException("Shopify order payload is missing created_at");
        }

        ShopifyOrder order = orderRepository.save(ShopifyOrder.builder()
                .store(connection.getStore())
                .shopifyOrderId(shopifyOrderId)
                .shopifyOrderNumber(root.path("order_number").asText(null))
                .shopifyOrderName(root.path("name").asText(null))
                .financialStatus(root.path("financial_status").asText(null))
                .fulfillmentStatus(root.path("fulfillment_status").asText(null))
                .customerEmail(root.path("customer").path("email").asText(null))
                .customerFirstName(root.path("customer").path("first_name").asText(null))
                .customerLastName(root.path("customer").path("last_name").asText(null))
                .totalPrice(parseBigDecimal(root.path("total_price")))
                .subtotalPrice(parseBigDecimal(root.path("subtotal_price")))
                .currency(root.path("currency").asText(null))
                .orderCreatedAt(orderCreatedAt)
                .orderUpdatedAt(parseShopifyTimestamp(root.path("updated_at").asText(null)))
                .rawPayload(root)
                .processed(false)
                .build());

        Map<String, Product> productCache = buildProductSkuCache(storeId);
        Map<UUID, Map<LocalDate, BigDecimal>> salesAggregation = new HashMap<>();
        LocalDate saleDate = orderCreatedAt.toLocalDate();
        int matched = 0;
        int unmatched = 0;

        for (JsonNode item : root.path("line_items")) {
            String sku = item.path("sku").asText("").trim();
            Product matchedProduct = sku.isEmpty() ? null : productCache.get(sku);

            lineItemRepository.save(ShopifyOrderLineItem.builder()
                    .store(connection.getStore())
                    .shopifyOrder(order)
                    .shopifyLineItemId(item.path("id").asLong())
                    .product(matchedProduct)
                    .sku(sku.isEmpty() ? null : sku)
                    .title(item.path("title").asText(null))
                    .variantTitle(item.path("variant_title").asText(null))
                    .quantity(item.path("quantity").asInt(0))
                    .price(parseBigDecimal(item.path("price")))
                    .matched(matchedProduct != null)
                    .build());

            if (matchedProduct != null) {
                matched++;
                salesAggregation
                        .computeIfAbsent(matchedProduct.getId(), ignored -> new HashMap<>())
                        .merge(saleDate, BigDecimal.valueOf(item.path("quantity").asInt(0)), BigDecimal::add);
            } else {
                unmatched++;
                if (!sku.isEmpty()) {
                    log.warn("Shopify SKU '{}' not found in store {} products", sku, storeId);
                }
            }
        }

        int salesUpserted = upsertSalesTransactions(storeId, salesAggregation);
        order.setProcessed(true);
        order.setProcessedAt(LocalDateTime.now());
        orderRepository.save(order);

        auditLogService.log(
                "SHOPIFY_ORDER_INGESTED",
                "ShopifyOrder",
                order.getId().toString(),
                String.format("Shopify order %s: %d line items (%d matched, %d unmatched), %d sales rows upserted",
                        order.getShopifyOrderName(), matched + unmatched, matched, unmatched, salesUpserted)
        );

        if (shopifyProperties.isAutoForecastOnWebhook() && matched > 0) {
            forecastTriggerService.triggerForStore(storeId, "shopify-webhook-order");
        }

        return ShopifyIngestionResult.success(shopifyOrderId, matched, unmatched, salesUpserted);
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
        log.debug("Upserted {} sales_transactions rows from Shopify order", count);
        return count;
    }

    private Map<String, Product> buildProductSkuCache(UUID storeId) {
        Map<String, Product> cache = new HashMap<>();
        for (Product product : productRepository.findByStoreIdAndActiveTrue(storeId)) {
            cache.put(product.getSku(), product);
        }
        return cache;
    }

    private void persistFailure(Store store, String shopDomain, String topic, Long shopifyOrderId,
                                JsonNode rawPayload, String errorMessage) {
        try {
            failureRepository.save(ShopifyWebhookFailure.builder()
                    .store(store)
                    .shopDomain(shopDomain)
                    .topic(topic)
                    .shopifyOrderId(shopifyOrderId)
                    .rawPayload(rawPayload)
                    .errorMessage(errorMessage)
                    .build());
        } catch (Exception e) {
            log.error("CRITICAL: Failed to persist webhook failure record", e);
        }
    }

    private Long extractOrderId(JsonNode root) {
        JsonNode id = root.path("id");
        return id.isMissingNode() || id.isNull() ? null : id.asLong();
    }

    private BigDecimal parseBigDecimal(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }
        try {
            return new BigDecimal(node.asText());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private LocalDateTime parseShopifyTimestamp(String timestamp) {
        if (timestamp == null || timestamp.isBlank()) {
            return null;
        }
        return OffsetDateTime.parse(timestamp).toLocalDateTime();
    }

    private JsonNode wrapRawPayload(String rawPayload) {
        return objectMapper.createObjectNode().put("rawPayload", rawPayload);
    }
}
