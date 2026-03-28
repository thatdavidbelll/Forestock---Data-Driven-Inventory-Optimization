package com.forestock.forestock_backend.controller;

import com.forestock.forestock_backend.dto.request.AcknowledgeSuggestionRequest;
import com.forestock.forestock_backend.dto.request.BulkAcknowledgeSuggestionsRequest;
import com.forestock.forestock_backend.dto.response.ApiResponse;
import com.forestock.forestock_backend.dto.response.SuggestionDto;
import com.forestock.forestock_backend.service.ReportService;
import com.forestock.forestock_backend.service.SuggestionService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.time.LocalDate;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/suggestions")
@RequiredArgsConstructor
public class SuggestionController {

    private final SuggestionService suggestionService;
    private final ReportService reportService;

    /**
     * Returns suggestions from the most recent completed run.
     * Optional filters: urgency (CRITICAL/HIGH/MEDIUM/LOW) or category.
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<SuggestionDto>>> getSuggestions(
            @RequestParam(required = false) String urgency,
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "false") boolean includeAcknowledged) {
        try {
            return ResponseEntity.ok(ApiResponse.success(
                    suggestionService.getSuggestions(urgency, category, includeAcknowledged)));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error(e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Invalid urgency: " + e.getMessage()));
        }
    }

    /** Returns details for a specific suggestion. */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<SuggestionDto>> getSuggestionById(@PathVariable UUID id) {
        try {
            return ResponseEntity.ok(ApiResponse.success(suggestionService.getSuggestionById(id)));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error(e.getMessage()));
        }
    }

    @PatchMapping("/{id}/acknowledge")
    public ResponseEntity<ApiResponse<SuggestionDto>> acknowledge(
            @PathVariable UUID id,
            @RequestBody(required = false) AcknowledgeSuggestionRequest request) {
        try {
            return ResponseEntity.ok(ApiResponse.success(suggestionService.acknowledge(
                    id,
                    request != null ? request : new AcknowledgeSuggestionRequest()
            )));
        } catch (EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error(e.getMessage()));
        }
    }

    @PostMapping("/acknowledge-bulk")
    public ResponseEntity<ApiResponse<List<SuggestionDto>>> acknowledgeBulk(
            @RequestBody BulkAcknowledgeSuggestionsRequest request) {
        try {
            return ResponseEntity.ok(ApiResponse.success(suggestionService.acknowledgeBulk(request)));
        } catch (EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error(e.getMessage()));
        }
    }

    /** Downloads an Excel (.xlsx) report of suggestions from the latest run. */
    @GetMapping("/export/excel")
    public ResponseEntity<byte[]> exportExcel(
            @RequestParam(required = false) String urgency,
            @RequestParam(required = false) String category) {
        try {
            List<SuggestionDto> suggestions = suggestionService.getSuggestions(urgency, category);
            byte[] bytes = reportService.generateExcel(suggestions);
            String filename = "forestock-suggestions-" + LocalDate.now() + ".xlsx";
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                    .header(HttpHeaders.CONTENT_DISPOSITION,
                            ContentDisposition.attachment().filename(filename).build().toString())
                    .body(bytes);
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        } catch (IOException e) {
            log.error("Excel generation failed: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /** Downloads a PDF report of suggestions from the latest run. */
    @GetMapping("/export/pdf")
    public ResponseEntity<byte[]> exportPdf(
            @RequestParam(required = false) String urgency,
            @RequestParam(required = false) String category) {
        try {
            List<SuggestionDto> suggestions = suggestionService.getSuggestions(urgency, category);
            byte[] bytes = reportService.generatePdf(suggestions);
            String filename = "forestock-suggestions-" + LocalDate.now() + ".pdf";
            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_PDF)
                    .header(HttpHeaders.CONTENT_DISPOSITION,
                            ContentDisposition.attachment().filename(filename).build().toString())
                    .body(bytes);
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        } catch (IOException e) {
            log.error("PDF generation failed: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}
