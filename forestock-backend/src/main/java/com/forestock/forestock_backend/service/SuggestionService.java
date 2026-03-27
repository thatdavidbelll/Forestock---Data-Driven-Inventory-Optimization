package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.domain.ForecastRun;
import com.forestock.forestock_backend.domain.OrderSuggestion;
import com.forestock.forestock_backend.domain.enums.ForecastStatus;
import com.forestock.forestock_backend.domain.enums.Urgency;
import com.forestock.forestock_backend.dto.response.SuggestionDto;
import com.forestock.forestock_backend.repository.ForecastRunRepository;
import com.forestock.forestock_backend.repository.OrderSuggestionRepository;
import com.forestock.forestock_backend.security.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SuggestionService {

    private final OrderSuggestionRepository suggestionRepository;
    private final ForecastRunRepository forecastRunRepository;

    @Transactional(readOnly = true)
    public List<SuggestionDto> getSuggestions(String urgencyFilter, String categoryFilter) {
        UUID storeId = TenantContext.getStoreId();

        ForecastRun latestRun = (storeId != null
                ? forecastRunRepository.findTopByStoreIdAndStatusOrderByFinishedAtDesc(storeId, ForecastStatus.COMPLETED)
                : forecastRunRepository.findTopByStatusOrderByFinishedAtDesc(ForecastStatus.COMPLETED))
                .orElseThrow(() -> new NoSuchElementException("No completed forecast run found"));

        List<OrderSuggestion> suggestions;

        if (urgencyFilter != null && !urgencyFilter.isBlank()) {
            Urgency urgency = Urgency.valueOf(urgencyFilter.toUpperCase());
            suggestions = suggestionRepository
                    .findByForecastRunIdAndUrgencyOrderByDaysOfStockAsc(latestRun.getId(), urgency);
        } else if (categoryFilter != null && !categoryFilter.isBlank()) {
            suggestions = suggestionRepository
                    .findByForecastRunIdAndProductCategoryOrderByUrgencyAscDaysOfStockAsc(
                            latestRun.getId(), categoryFilter);
        } else {
            suggestions = suggestionRepository
                    .findByForecastRunIdOrderByUrgencyAscDaysOfStockAsc(latestRun.getId());
        }

        return suggestions.stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public SuggestionDto getSuggestionById(UUID id) {
        return suggestionRepository.findById(id)
                .map(this::toDto)
                .orElseThrow(() -> new NoSuchElementException("Suggestion not found: " + id));
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
                .generatedAt(s.getGeneratedAt())
                .build();
    }
}
