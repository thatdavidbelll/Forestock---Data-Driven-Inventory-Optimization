package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.domain.ForecastRun;
import com.forestock.forestock_backend.domain.OrderSuggestion;
import com.forestock.forestock_backend.domain.Product;
import com.forestock.forestock_backend.domain.enums.ForecastStatus;
import com.forestock.forestock_backend.domain.enums.Urgency;
import com.forestock.forestock_backend.dto.request.AcknowledgeSuggestionRequest;
import com.forestock.forestock_backend.dto.request.BulkAcknowledgeSuggestionsRequest;
import com.forestock.forestock_backend.dto.response.SuggestionDto;
import com.forestock.forestock_backend.repository.ForecastRunRepository;
import com.forestock.forestock_backend.repository.OrderSuggestionRepository;
import com.forestock.forestock_backend.security.TenantContext;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.util.List;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
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
        return acknowledge(id, new AcknowledgeSuggestionRequest());
    }

    @Transactional
    public SuggestionDto acknowledge(UUID id, AcknowledgeSuggestionRequest request) {
        UUID storeId = TenantContext.getStoreId();
        OrderSuggestion suggestion = suggestionRepository.findByIdAndStoreId(id, storeId)
                .orElseThrow(() -> new EntityNotFoundException("Suggestion not found"));

        applyAcknowledgement(suggestion, request);

        return toDto(suggestionRepository.save(suggestion));
    }

    @Transactional
    public List<SuggestionDto> acknowledgeBulk(BulkAcknowledgeSuggestionsRequest request) {
        UUID storeId = TenantContext.getStoreId();
        if (request.getSuggestionIds() == null || request.getSuggestionIds().isEmpty()) {
            return List.of();
        }

        return request.getSuggestionIds().stream()
                .map(id -> suggestionRepository.findByIdAndStoreId(id, storeId)
                        .orElseThrow(() -> new EntityNotFoundException("Suggestion not found")))
                .peek(suggestion -> applyAcknowledgement(suggestion, request))
                .map(suggestionRepository::save)
                .map(this::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public byte[] generatePurchaseOrderPdf(List<UUID> suggestionIds) {
        UUID storeId = TenantContext.getStoreId();
        if (storeId == null || suggestionIds == null || suggestionIds.isEmpty()) {
            throw new EntityNotFoundException("No suggestions selected");
        }

        List<OrderSuggestion> suggestions = suggestionIds.stream()
                .map(id -> suggestionRepository.findByIdAndStoreId(id, storeId)
                        .orElseThrow(() -> new EntityNotFoundException("Suggestion not found")))
                .toList();

        LocalDateTime generatedAt = LocalDateTime.now();
        DateTimeFormatter dateFormatter = DateTimeFormatter.ofPattern("MMM d, yyyy HH:mm");
        BigDecimal totalEstimatedValue = suggestions.stream()
                .map(OrderSuggestion::getEstimatedOrderValue)
                .filter(value -> value != null)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PDPage page = new PDPage(PDRectangle.LETTER);
            document.addPage(page);

            PDType1Font headingFont = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
            PDType1Font bodyFont = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
            float margin = 40f;
            float y = page.getMediaBox().getHeight() - margin;

            try (PDPageContentStream content = new PDPageContentStream(document, page)) {
                y = writeLine(content, headingFont, 18, margin, y, "Purchase Order");
                y = writeLine(content, bodyFont, 11, margin, y - 8, "Store: " + suggestions.getFirst().getStore().getName());
                y = writeLine(content, bodyFont, 11, margin, y - 2, "Generated: " + generatedAt.format(dateFormatter));

                float[] columns = {margin, 180f, 255f, 350f, 430f, 485f, 545f};
                y -= 22;
                String[] headers = {"Product", "SKU", "Supplier", "Unit Cost", "Suggested Qty", "Estimated Value"};
                for (int i = 0; i < headers.length; i++) {
                    writeCell(content, headingFont, 9, columns[i], y, headers[i]);
                }

                y -= 14;
                content.moveTo(margin, y);
                content.lineTo(page.getMediaBox().getWidth() - margin, y);
                content.stroke();
                y -= 12;

                for (OrderSuggestion suggestion : suggestions) {
                    Product product = suggestion.getProduct();
                    writeCell(content, bodyFont, 9, columns[0], y, valueOrDash(product.getName(), 24));
                    writeCell(content, bodyFont, 9, columns[1], y, valueOrDash(product.getSku(), 12));
                    writeCell(content, bodyFont, 9, columns[2], y, valueOrDash(product.getSupplierName(), 14));
                    writeCell(content, bodyFont, 9, columns[3], y, formatMoney(product.getUnitCost()));
                    writeCell(content, bodyFont, 9, columns[4], y, formatQuantity(suggestion.getSuggestedQty()));
                    writeCell(content, bodyFont, 9, columns[5], y, formatMoney(suggestion.getEstimatedOrderValue()));
                    y -= 14;
                }

                y -= 6;
                content.moveTo(margin, y);
                content.lineTo(page.getMediaBox().getWidth() - margin, y);
                content.stroke();
                y -= 14;

                writeCell(content, headingFont, 10, columns[4], y, "Total");
                writeCell(content, headingFont, 10, columns[5], y, formatMoney(totalEstimatedValue));

                writeLine(content, bodyFont, 10, margin, 45f, "Generated by Forestock · " + generatedAt.format(dateFormatter));
            }

            document.save(output);
            return output.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("Failed to generate purchase order", e);
        }
    }

    private void applyAcknowledgement(OrderSuggestion suggestion, AcknowledgeSuggestionRequest request) {
        suggestion.setAcknowledged(true);
        suggestion.setAcknowledgedAt(LocalDateTime.now());
        suggestion.setAcknowledgedReason(request.getAcknowledgedReason());
        suggestion.setQuantityOrdered(request.getQuantityOrdered());
        suggestion.setExpectedDelivery(request.getExpectedDelivery());
        suggestion.setOrderReference(request.getOrderReference());
    }

    private void applyAcknowledgement(OrderSuggestion suggestion, BulkAcknowledgeSuggestionsRequest request) {
        suggestion.setAcknowledged(true);
        suggestion.setAcknowledgedAt(LocalDateTime.now());
        suggestion.setAcknowledgedReason(request.getAcknowledgedReason());
        suggestion.setQuantityOrdered(request.getQuantityOrdered());
        suggestion.setExpectedDelivery(request.getExpectedDelivery());
        suggestion.setOrderReference(request.getOrderReference());
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
                .leadTimeDaysAtGeneration(s.getLeadTimeDaysAtGeneration())
                .moqApplied(s.getMoqApplied())
                .estimatedOrderValue(s.getEstimatedOrderValue())
                .supplierName(s.getProduct().getSupplierName())
                .lowConfidence(Boolean.TRUE.equals(s.getLowConfidence()))
                .forecastModel(s.getForecastModel())
                .historyDaysAtGeneration(s.getHistoryDaysAtGeneration())
                .urgency(s.getUrgency())
                .acknowledged(Boolean.TRUE.equals(s.getAcknowledged()))
                .acknowledgedAt(s.getAcknowledgedAt())
                .acknowledgedReason(s.getAcknowledgedReason())
                .quantityOrdered(s.getQuantityOrdered())
                .expectedDelivery(s.getExpectedDelivery())
                .orderReference(s.getOrderReference())
                .generatedAt(s.getGeneratedAt())
                .build();
    }

    private float writeLine(PDPageContentStream content, PDType1Font font, float fontSize, float x, float y, String text) throws IOException {
        content.beginText();
        content.setFont(font, fontSize);
        content.newLineAtOffset(x, y);
        content.showText(text);
        content.endText();
        return y - fontSize - 2;
    }

    private void writeCell(PDPageContentStream content, PDType1Font font, float fontSize, float x, float y, String text) throws IOException {
        content.beginText();
        content.setFont(font, fontSize);
        content.newLineAtOffset(x, y);
        content.showText(text);
        content.endText();
    }

    private String formatMoney(BigDecimal value) {
        if (value == null) {
            return "—";
        }
        return value.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString();
    }

    private String formatQuantity(BigDecimal value) {
        if (value == null) {
            return "—";
        }
        return value.stripTrailingZeros().toPlainString();
    }

    private String valueOrDash(String value, int maxLength) {
        if (value == null || value.isBlank()) {
            return "—";
        }
        return value.length() > maxLength ? value.substring(0, maxLength - 1) + "…" : value;
    }
}
