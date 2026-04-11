package com.forestock.forestock_backend.service;

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
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ShopifyOrderIngestionServiceTest {

    @Mock private ShopifyOrderRepository orderRepository;
    @Mock private ShopifyOrderLineItemRepository lineItemRepository;
    @Mock private ShopifyWebhookFailureRepository failureRepository;
    @Mock private ShopifyConnectionRepository connectionRepository;
    @Mock private ProductRepository productRepository;
    @Mock private ForecastTriggerService forecastTriggerService;
    @Mock private AuditLogService auditLogService;
    @Mock private JdbcTemplate jdbcTemplate;

    private ShopifyOrderIngestionService service;
    private Store testStore;
    private ShopifyConnection testConnection;
    private Product testProduct;

    private static final String ORDER_JSON = """
        {
          "id": 5551234567890,
          "name": "#1001",
          "order_number": "1001",
          "financial_status": "paid",
          "fulfillment_status": null,
          "total_price": "42.50",
          "subtotal_price": "40.00",
          "currency": "GBP",
          "created_at": "2026-04-06T10:30:00+00:00",
          "updated_at": "2026-04-06T10:30:00+00:00",
          "customer": {
            "email": "test@example.com",
            "first_name": "Jane",
            "last_name": "Doe"
          },
          "line_items": [
            {
              "id": 9991234567890,
              "sku": "PROD-001",
              "title": "Widget A",
              "variant_title": "Large",
              "quantity": 3,
              "price": "10.00"
            },
            {
              "id": 9991234567891,
              "sku": "UNKNOWN-SKU",
              "title": "Widget B",
              "variant_title": null,
              "quantity": 1,
              "price": "12.50"
            }
          ]
        }
        """;

    @BeforeEach
    void setUp() {
        ShopifyProperties properties = new ShopifyProperties();
        properties.setAutoForecastOnWebhook(true);

        service = new ShopifyOrderIngestionService(
                orderRepository,
                lineItemRepository,
                failureRepository,
                connectionRepository,
                productRepository,
                forecastTriggerService,
                auditLogService,
                properties,
                jdbcTemplate,
                new ObjectMapper()
        );

        testStore = Store.builder().id(UUID.randomUUID()).name("Test Store").slug("test").build();
        testConnection = ShopifyConnection.builder()
                .id(UUID.randomUUID())
                .store(testStore)
                .shopDomain("test.myshopify.com")
                .active(true)
                .build();
        testProduct = Product.builder()
                .id(UUID.randomUUID())
                .store(testStore)
                .sku("PROD-001")
                .name("Widget A")
                .unit("pcs")
                .active(true)
                .build();
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void processOrder_newOrder_matchesSkuAndUpsertsSales() {
        when(connectionRepository.findByShopDomainAndActiveTrue("test.myshopify.com"))
                .thenReturn(Optional.of(testConnection));
        when(orderRepository.existsByStoreIdAndShopifyOrderId(testStore.getId(), 5551234567890L))
                .thenReturn(false);
        when(productRepository.findByStoreIdAndActiveTrue(testStore.getId()))
                .thenReturn(List.of(testProduct));
        when(orderRepository.save(any(ShopifyOrder.class)))
                .thenAnswer(invocation -> {
                    ShopifyOrder order = invocation.getArgument(0);
                    if (order.getId() == null) {
                        order.setId(UUID.randomUUID());
                    }
                    return order;
                });
        when(lineItemRepository.save(any(ShopifyOrderLineItem.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        ShopifyIngestionResult result = service.processOrder("test.myshopify.com", ORDER_JSON);

        assertThat(result.getStatus()).isEqualTo(ShopifyIngestionResult.Status.SUCCESS);
        assertThat(result.getShopifyOrderId()).isEqualTo(5551234567890L);
        assertThat(result.getMatchedLineItems()).isEqualTo(1);
        assertThat(result.getUnmatchedLineItems()).isEqualTo(1);
        assertThat(result.getSalesRowsUpserted()).isEqualTo(1);

        ArgumentCaptor<ShopifyOrder> orderCaptor = ArgumentCaptor.forClass(ShopifyOrder.class);
        verify(orderRepository, atLeastOnce()).save(orderCaptor.capture());
        ShopifyOrder savedOrder = orderCaptor.getAllValues().getFirst();
        assertThat(savedOrder.getCustomerEmail()).isNull();
        assertThat(savedOrder.getCustomerFirstName()).isNull();
        assertThat(savedOrder.getCustomerLastName()).isNull();
        assertThat(savedOrder.getRawPayload().has("customer")).isFalse();
        assertThat(savedOrder.getRawPayload().has("billing_address")).isFalse();
        assertThat(savedOrder.getRawPayload().has("shipping_address")).isFalse();

        verify(jdbcTemplate).update(contains("ON CONFLICT"), eq(testStore.getId()),
                eq(testProduct.getId()), any(), any());
        verify(auditLogService).log(eq("SHOPIFY_ORDER_INGESTED"), eq("ShopifyOrder"),
                anyString(), contains("1 matched"));
    }

    @Test
    void processOrder_duplicateOrder_returnsIdempotent() {
        when(connectionRepository.findByShopDomainAndActiveTrue("test.myshopify.com"))
                .thenReturn(Optional.of(testConnection));
        when(orderRepository.existsByStoreIdAndShopifyOrderId(testStore.getId(), 5551234567890L))
                .thenReturn(true);

        ShopifyIngestionResult result = service.processOrder("test.myshopify.com", ORDER_JSON);

        assertThat(result.getStatus()).isEqualTo(ShopifyIngestionResult.Status.DUPLICATE);
        assertThat(result.getShopifyOrderId()).isEqualTo(5551234567890L);

        verify(orderRepository, never()).save(any());
        verify(lineItemRepository, never()).save(any());
        verify(jdbcTemplate, never()).update(anyString(), any(), any(), any(), any());
    }

    @Test
    void processOrder_unknownDomain_persistsFailure() {
        when(connectionRepository.findByShopDomainAndActiveTrue("unknown.myshopify.com"))
                .thenReturn(Optional.empty());

        ShopifyIngestionResult result = service.processOrder("unknown.myshopify.com", ORDER_JSON);

        assertThat(result.getStatus()).isEqualTo(ShopifyIngestionResult.Status.ERROR);
        assertThat(result.getErrorMessage()).contains("Unknown shop domain");
        verify(failureRepository).save(any(ShopifyWebhookFailure.class));
    }

    @Test
    void processOrder_invalidJson_persistsFailure() {
        ShopifyIngestionResult result = service.processOrder("test.myshopify.com", "not-json{{{");

        assertThat(result.getStatus()).isEqualTo(ShopifyIngestionResult.Status.ERROR);
        assertThat(result.getErrorMessage()).contains("Invalid JSON");
        verify(failureRepository).save(any(ShopifyWebhookFailure.class));
    }
}
