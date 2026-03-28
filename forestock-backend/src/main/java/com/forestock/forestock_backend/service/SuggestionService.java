package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.domain.ForecastRun;
import com.forestock.forestock_backend.domain.OrderSuggestion;
import com.forestock.forestock_backend.domain.enums.ForecastStatus;
import com.forestock.forestock_backend.domain.enums.Urgency;
import com.forestock.forestock_backend.dto.response.SuggestionDto;
import com.forestock.forestock_backend.repository.ForecastRunRepository;
import com.forestock.forestock_backend.repository.OrderSuggestionRepository;
import com.forestock.forestock_backend.security.TenantContext;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.time.LocalDateTime;
import java.util.NoSuchElementException;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SuggestionService {

    private final OrderSuggestionRepository suggestionRepository;
    private final ForecastRunRepository forecastRunRepository;

    @Transactional(readOnly = true)
    public List<SuggestionDto> getSuggestions(String urgencyFilter, String categoryFilter) {
        return getSuggestions(urgencyFilter, categoryFilter, false);
    }

    @Transactional(readOnly = true)
    public List<SuggestionDto> getSuggestions(String urgencyFilter, String categoryFilter, boolean includeAcknowledged) {
        UUID storeId = TenantContext.getStoreId();

        ForecastRun latestRun = (storeId != null
                ? forecastRunRepository.findTopByStoreIdAndStatusOrderByFinishedAtDesc(storeId, ForecastStatus.COMPLETED)
                : forecastRunRepository.findTopByStatusOrderByFinishedAtDesc(ForecastStatus.COMPLETED))
                .orElseThrow(() -> new NoSuchElementException("No completed forecast run found"));

        List<OrderSuggestion> suggestions;

        if (urgencyFilter != null && !urgencyFilter.isBlank()) {
            Urgency urgency = Urgency.valueOf(urgencyFilter.toUpperCase());
            suggestions = includeAcknowledged
                    ? suggestionRepository.findByForecastRunIdAndUrgencyOrderByDaysOfStockAsc(latestRun.getId(), urgency)
                    : suggestionRepository.findByForecastRunIdAndUrgencyAndAcknowledgedOrderByDaysOfStockAsc(
                            latestRun.getId(), urgency, false);
        } else if (categoryFilter != null && !categoryFilter.isBlank()) {
            suggestions = includeAcknowledged
                    ? suggestionRepository.findByForecastRunIdAndProductCategoryOrderByUrgencyAscDaysOfStockAsc(
                            latestRun.getId(), categoryFilter)
                    : suggestionRepository.findByForecastRunIdAndProductCategoryAndAcknowledgedOrderByUrgencyAscDaysOfStockAsc(
                            latestRun.getId(), categoryFilter, false);
        } else {
            suggestions = includeAcknowledged
                    ? suggestionRepository.findByForecastRunIdOrderByUrgencyAscDaysOfStockAsc(latestRun.getId())
                    : suggestionRepository.findByForecastRunIdAndAcknowledgedOrderByUrgencyAscDaysOfStockAsc(
                            latestRun.getId(), false);
        }

        return suggestions.stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public SuggestionDto getSuggestionById(UUID id) {
        UUID storeId = TenantContext.getStoreId();

        return suggestionRepository.findByIdAndStoreId(id, storeId)
                .map(this::toDto)
                .orElseThrow(() -> new NoSuchElementException("Suggestion not found: " + id));
    }

    @Transactional
    public SuggestionDto acknowledge(UUID id) {
        UUID storeId = TenantContext.getStoreId();
        OrderSuggestion suggestion = suggestionRepository.findByIdAndStoreId(id, storeId)
                .orElseThrow(() -> new EntityNotFoundException("Suggestion not found"));

        suggestion.setAcknowledged(true);
        suggestion.setAcknowledgedAt(LocalDateTime.now());

        return toDto(suggestionRepository.save(suggestion));
    }

    private SuggestionDto toDto(OrderSuggestion s) {
        return SuggestionDto.builder()
                .id(s.getId())
                .productId(s.getProduct().getId())
                .productSku(s.getProduct().getSku())
                .productName(s.getProduct().getName())
                .productCategory(s.getProduct().getCategory())
                .unit(s.getProduct().getUnit())
                .suggestedQty(s.getSuggestedQty())
                .forecastP50(s.getForecastP50())
                .forecastP90(s.getForecastP90())
                .currentStock(s.getCurrentStock())
                .daysOfStock(s.getDaysOfStock())
                .urgency(s.getUrgency())
                .acknowledged(Boolean.TRUE.equals(s.getAcknowledged()))
                .acknowledgedAt(s.getAcknowledgedAt())
                .generatedAt(s.getGeneratedAt())
                .build();
    }
}
