package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.domain.ForecastRun;
import com.forestock.forestock_backend.domain.OrderSuggestion;
import com.forestock.forestock_backend.domain.Product;
import com.forestock.forestock_backend.domain.ShopifyConnection;
import com.forestock.forestock_backend.domain.Store;
import com.forestock.forestock_backend.domain.enums.ForecastStatus;
import com.forestock.forestock_backend.domain.enums.Urgency;
import com.forestock.forestock_backend.repository.ForecastRunRepository;
import com.forestock.forestock_backend.repository.OrderSuggestionRepository;
import com.forestock.forestock_backend.repository.ProductRepository;
import com.forestock.forestock_backend.repository.SalesTransactionRepository;
import com.forestock.forestock_backend.repository.ShopifyConnectionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ShopifyAppHomeServiceTest {

    @Mock
    private ShopifyConnectionRepository shopifyConnectionRepository;

    @Mock
    private ProductRepository productRepository;

    @Mock
    private SalesTransactionRepository salesTransactionRepository;

    @Mock
    private ForecastRunRepository forecastRunRepository;

    @Mock
    private OrderSuggestionRepository orderSuggestionRepository;

    @Mock
    private DashboardService dashboardService;

    @InjectMocks
    private ShopifyAppHomeService shopifyAppHomeService;

    @Test
    void getRecommendations_returnsWebsiteParityFieldsForShopifyPayload() {
        UUID storeId = UUID.randomUUID();
        Store store = Store.builder().id(storeId).name("Demo Store").build();
        ShopifyConnection connection = ShopifyConnection.builder()
                .shopDomain("demo.myshopify.com")
                .active(true)
                .store(store)
                .build();
        ForecastRun completedRun = ForecastRun.builder()
                .id(UUID.randomUUID())
                .status(ForecastStatus.COMPLETED)
                .finishedAt(LocalDateTime.now().minusMinutes(5))
                .build();
        Product product = Product.builder()
                .id(UUID.randomUUID())
                .sku("SKU-1")
                .name("Test Product")
                .category("Snacks")
                .unit("pcs")
                .supplierName("Acme Foods")
                .build();
        OrderSuggestion suggestion = OrderSuggestion.builder()
                .id(UUID.randomUUID())
                .product(product)
                .store(store)
                .urgency(Urgency.CRITICAL)
                .suggestedQty(BigDecimal.valueOf(14))
                .forecastP50(BigDecimal.valueOf(12))
                .forecastP90(BigDecimal.valueOf(18))
                .currentStock(BigDecimal.valueOf(4))
                .daysOfStock(BigDecimal.valueOf(2.5))
                .leadTimeDaysAtGeneration(5)
                .moqApplied(BigDecimal.valueOf(10))
                .estimatedOrderValue(BigDecimal.valueOf(120))
                .acknowledged(true)
                .acknowledgedAt(LocalDateTime.now().minusHours(2))
                .acknowledgedReason("PO raised")
                .quantityOrdered(BigDecimal.valueOf(20))
                .expectedDelivery(LocalDate.now().plusDays(7))
                .orderReference("PO-1001")
                .generatedAt(LocalDateTime.now().minusHours(4))
                .build();

        when(shopifyConnectionRepository.findByShopDomain("demo.myshopify.com"))
                .thenReturn(Optional.of(connection));
        when(forecastRunRepository.findTopByStoreIdAndStatusOrderByFinishedAtDesc(storeId, ForecastStatus.COMPLETED))
                .thenReturn(Optional.of(completedRun));
        when(orderSuggestionRepository.findByForecastRunIdAndAcknowledgedOrderByUrgencyAscDaysOfStockAsc(completedRun.getId(), false))
                .thenReturn(List.of(suggestion));

        var payload = shopifyAppHomeService.getRecommendations("demo.myshopify.com");

        assertThat(payload.recommendations()).hasSize(1);
        var dto = payload.recommendations().getFirst();
        assertThat(dto.getProductId()).isEqualTo(product.getId());
        assertThat(dto.getProductCategory()).isEqualTo("Snacks");
        assertThat(dto.getUnit()).isEqualTo("pcs");
        assertThat(dto.getForecastP50()).isEqualByComparingTo("12");
        assertThat(dto.getForecastP90()).isEqualByComparingTo("18");
        assertThat(dto.getCurrentStock()).isEqualByComparingTo("4");
        assertThat(dto.getLeadTimeDaysAtGeneration()).isEqualTo(5);
        assertThat(dto.getMoqApplied()).isEqualByComparingTo("10");
        assertThat(dto.isAcknowledged()).isTrue();
        assertThat(dto.getAcknowledgedReason()).isEqualTo("PO raised");
        assertThat(dto.getOrderReference()).isEqualTo("PO-1001");
        assertThat(dto.getUrgency()).isEqualTo(Urgency.CRITICAL);
    }
}
