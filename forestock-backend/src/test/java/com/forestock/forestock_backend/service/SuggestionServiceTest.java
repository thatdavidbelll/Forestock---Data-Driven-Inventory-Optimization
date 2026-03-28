package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.domain.ForecastRun;
import com.forestock.forestock_backend.domain.OrderSuggestion;
import com.forestock.forestock_backend.domain.Product;
import com.forestock.forestock_backend.domain.Store;
import com.forestock.forestock_backend.domain.enums.ForecastStatus;
import com.forestock.forestock_backend.domain.enums.Urgency;
import com.forestock.forestock_backend.repository.ForecastRunRepository;
import com.forestock.forestock_backend.repository.OrderSuggestionRepository;
import com.forestock.forestock_backend.security.TenantContext;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SuggestionServiceTest {

    @Mock
    private OrderSuggestionRepository suggestionRepository;

    @Mock
    private ForecastRunRepository forecastRunRepository;

    @InjectMocks
    private SuggestionService suggestionService;

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void getSuggestions_excludesAcknowledgedByDefault() {
        UUID storeId = UUID.randomUUID();
        ForecastRun latestRun = ForecastRun.builder()
                .id(UUID.randomUUID())
                .status(ForecastStatus.COMPLETED)
                .finishedAt(LocalDateTime.now())
                .build();
        OrderSuggestion unacknowledgedSuggestion = suggestion(false);

        TenantContext.setStoreId(storeId);
        when(forecastRunRepository.findTopByStoreIdAndStatusOrderByFinishedAtDesc(storeId, ForecastStatus.COMPLETED))
                .thenReturn(Optional.of(latestRun));
        when(suggestionRepository.findByForecastRunIdAndAcknowledgedOrderByUrgencyAscDaysOfStockAsc(latestRun.getId(), false))
                .thenReturn(List.of(unacknowledgedSuggestion));

        var result = suggestionService.getSuggestions(null, null, false);

        assertThat(result).hasSize(1);
        assertThat(result.getFirst().isAcknowledged()).isFalse();
        verify(suggestionRepository).findByForecastRunIdAndAcknowledgedOrderByUrgencyAscDaysOfStockAsc(latestRun.getId(), false);
        verify(suggestionRepository, never()).findByForecastRunIdOrderByUrgencyAscDaysOfStockAsc(any());
    }

    @Test
    void getSuggestions_includeAcknowledgedUsesUnfilteredQuery() {
        UUID storeId = UUID.randomUUID();
        ForecastRun latestRun = ForecastRun.builder()
                .id(UUID.randomUUID())
                .status(ForecastStatus.COMPLETED)
                .finishedAt(LocalDateTime.now())
                .build();
        OrderSuggestion acknowledgedSuggestion = suggestion(true);

        TenantContext.setStoreId(storeId);
        when(forecastRunRepository.findTopByStoreIdAndStatusOrderByFinishedAtDesc(storeId, ForecastStatus.COMPLETED))
                .thenReturn(Optional.of(latestRun));
        when(suggestionRepository.findByForecastRunIdOrderByUrgencyAscDaysOfStockAsc(latestRun.getId()))
                .thenReturn(List.of(acknowledgedSuggestion));

        var result = suggestionService.getSuggestions(null, null, true);

        assertThat(result).hasSize(1);
        assertThat(result.getFirst().isAcknowledged()).isTrue();
        verify(suggestionRepository).findByForecastRunIdOrderByUrgencyAscDaysOfStockAsc(latestRun.getId());
        verify(suggestionRepository, never()).findByForecastRunIdAndAcknowledgedOrderByUrgencyAscDaysOfStockAsc(any(), any(Boolean.class));
    }

    @Test
    void acknowledge_marksSuggestionAndSetsTimestamp() {
        UUID storeId = UUID.randomUUID();
        UUID suggestionId = UUID.randomUUID();
        OrderSuggestion suggestion = suggestion(false);
        suggestion.setId(suggestionId);

        TenantContext.setStoreId(storeId);
        when(suggestionRepository.findByIdAndStoreId(suggestionId, storeId)).thenReturn(Optional.of(suggestion));
        when(suggestionRepository.save(any(OrderSuggestion.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var result = suggestionService.acknowledge(suggestionId);

        ArgumentCaptor<OrderSuggestion> captor = ArgumentCaptor.forClass(OrderSuggestion.class);
        verify(suggestionRepository).save(captor.capture());

        assertThat(result.isAcknowledged()).isTrue();
        assertThat(result.getAcknowledgedAt()).isNotNull();
        assertThat(captor.getValue().getAcknowledged()).isTrue();
        assertThat(captor.getValue().getAcknowledgedAt()).isNotNull();
    }

    @Test
    void acknowledge_throwsWhenSuggestionDoesNotBelongToStore() {
        UUID storeId = UUID.randomUUID();
        UUID suggestionId = UUID.randomUUID();

        TenantContext.setStoreId(storeId);
        when(suggestionRepository.findByIdAndStoreId(suggestionId, storeId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> suggestionService.acknowledge(suggestionId))
                .isInstanceOf(EntityNotFoundException.class)
                .hasMessage("Suggestion not found");
    }

    private static OrderSuggestion suggestion(boolean acknowledged) {
        Product product = Product.builder()
                .id(UUID.randomUUID())
                .sku("SKU-1")
                .name("Test Product")
                .category("Dairy")
                .unit("pcs")
                .build();

        return OrderSuggestion.builder()
                .id(UUID.randomUUID())
                .store(Store.builder().id(UUID.randomUUID()).name("Test Store").build())
                .product(product)
                .suggestedQty(BigDecimal.TEN)
                .forecastP50(BigDecimal.valueOf(8))
                .forecastP90(BigDecimal.valueOf(12))
                .currentStock(BigDecimal.valueOf(2))
                .daysOfStock(BigDecimal.ONE)
                .urgency(Urgency.CRITICAL)
                .acknowledged(acknowledged)
                .acknowledgedAt(acknowledged ? LocalDateTime.now().minusHours(1) : null)
                .generatedAt(LocalDateTime.now().minusHours(2))
                .build();
    }
}
