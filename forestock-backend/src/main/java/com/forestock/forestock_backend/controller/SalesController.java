package com.forestock.forestock_backend.controller;

import com.forestock.forestock_backend.domain.SalesTransaction;
import com.forestock.forestock_backend.dto.response.ApiResponse;
import com.forestock.forestock_backend.dto.response.SalesImportPreviewDto;
import com.forestock.forestock_backend.dto.response.SalesTransactionDto;
import com.forestock.forestock_backend.security.TenantContext;
import com.forestock.forestock_backend.service.ForecastTriggerService;
import com.forestock.forestock_backend.service.SalesIngestionService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.UUID;

@RestController
@RequestMapping("/api/sales")
@RequiredArgsConstructor
public class SalesController {

    private final SalesIngestionService salesIngestionService;
    private final ForecastTriggerService forecastTriggerService;

    // ── Import ────────────────────────────────────────────────────────────────

    /**
     * POST /api/sales/import
     * Uploads a CSV file of sales transactions.
     * Optional param: overwriteExisting (default false)
     */
    @PostMapping("/import")
    public ResponseEntity<ApiResponse<Map<String, Object>>> importCsv(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "overwriteExisting", defaultValue = "false") boolean overwriteExisting) {

        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("CSV file is empty"));
        }

        String filename = file.getOriginalFilename();
        if (filename == null || !filename.toLowerCase().endsWith(".csv")) {
            return ResponseEntity.badRequest().body(ApiResponse.error("File must be a CSV"));
        }

        try {
            SalesIngestionService.ImportResult result = salesIngestionService.importCsv(file, overwriteExisting);
            if (result.imported() > 0) {
                forecastTriggerService.triggerForCurrentStore("sales-import");
            }
            Map<String, Object> data = Map.of(
                    "imported", result.imported(),
                    "skipped",  result.skipped(),
                    "errors",   result.errors(),
                    "rowErrors", result.rowErrors()
            );
            String message = String.format("Import complete: %d imported, %d skipped, %d errors",
                    result.imported(), result.skipped(), result.errors().size());
            return ResponseEntity.ok(ApiResponse.success(message, data));
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("Error reading file: " + e.getMessage()));
        }
    }

    @PostMapping("/import/preview")
    public ResponseEntity<ApiResponse<SalesImportPreviewDto>> previewImport(
            @RequestParam("file") MultipartFile file) {

        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("CSV file is empty"));
        }

        String filename = file.getOriginalFilename();
        if (filename == null || !filename.toLowerCase().endsWith(".csv")) {
            return ResponseEntity.badRequest().body(ApiResponse.error("File must be a CSV"));
        }

        try {
            return ResponseEntity.ok(ApiResponse.success(salesIngestionService.previewCsv(file)));
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("Error reading file: " + e.getMessage()));
        }
    }

    @GetMapping("/import/template/{type}")
    public ResponseEntity<byte[]> downloadImportTemplate(@PathVariable String type) {
        String template = switch (type) {
            case "sales" -> """
                    sku,sale_date,quantity_sold
                    PROD-001,2026-03-01,42
                    PROD-002,2026-03-01,18
                    PROD-003,2026-03-02,7
                    """;
            case "products" -> """
                    sku,name,category,unit,reorder_point,max_stock,lead_time_days,minimum_order_qty,unit_cost,supplier_name
                    PROD-001,Blue T-Shirt,Apparel,pcs,20,100,14,10,12.50,Main Supplier
                    PROD-002,Ceramic Mug,Home,pcs,15,80,10,12,6.20,Kitchen Wholesale
                    """;
            case "inventory" -> """
                    sku,snapshot_date,quantity_on_hand
                    PROD-001,2026-03-01,58
                    PROD-002,2026-03-01,31
                    PROD-003,2026-03-01,12
                    """;
            default -> null;
        };

        if (template == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(("Unknown import template type: " + type).getBytes(StandardCharsets.UTF_8));
        }

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"forestock-" + type + "-template.csv\"")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(template.getBytes(StandardCharsets.UTF_8));
    }

    // ── Read ─────────────────────────────────────────────────────────────────

    /**
     * GET /api/sales?sku=&from=yyyy-MM-dd&to=yyyy-MM-dd&page=0&size=50
     * Paginated list of transactions, filterable by SKU and/or date range.
     */
    @GetMapping
    public ResponseEntity<ApiResponse<Page<SalesTransactionDto>>> listTransactions(
            @RequestParam(required = false) String sku,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "50") int size) {

        try {
            Pageable pageable = PageRequest.of(page, Math.min(size, 500));
            return ResponseEntity.ok(ApiResponse.success(
                    salesIngestionService.listTransactions(sku, from, to, pageable)));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error(e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error(e.getMessage()));
        }
    }

    /**
     * GET /api/sales/summary?days=30
     * Returns a sales summary for the last N days (default 30).
     */
    @GetMapping("/summary")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getSummary(
            @RequestParam(defaultValue = "30") int days) {
        if (days < 1 || days > 365) {
            return ResponseEntity.badRequest().body(ApiResponse.error("days must be between 1 and 365"));
        }
        SalesIngestionService.SalesSummary summary = salesIngestionService.getSummary(days);
        Map<String, Object> data = Map.of(
                "days",          summary.days(),
                "transactions",  summary.transactions(),
                "totalQuantity", summary.totalQuantity()
        );
        return ResponseEntity.ok(ApiResponse.success(data));
    }

    /**
     * GET /api/sales/{sku}/daily
     * Returns daily sales for a product (for charting).
     */
    @GetMapping("/{sku}/daily")
    public ResponseEntity<ApiResponse<List<SalesTransactionDto>>> getDailySales(@PathVariable String sku) {
        try {
            List<SalesTransactionDto> data = salesIngestionService.getDailySales(sku).stream()
                    .map(s -> new SalesTransactionDto(
                            s.getId(),
                            s.getProduct().getSku(),
                            s.getProduct().getName(),
                            s.getSaleDate(),
                            s.getQuantitySold()))
                    .toList();
            return ResponseEntity.ok(ApiResponse.success(data));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error(e.getMessage()));
        }
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    /**
     * DELETE /api/sales/product/{sku}
     * Deletes ALL transactions for a product SKU.
     */
    @DeleteMapping("/product/{sku}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> deleteBySku(@PathVariable String sku) {
        try {
            SalesIngestionService.DeleteResult result = salesIngestionService.deleteBySku(sku);
            if (result.deleted() > 0) {
                forecastTriggerService.triggerForCurrentStore("sales-delete-by-sku");
            }
            return ResponseEntity.ok(ApiResponse.success(
                    "Deleted all transactions for SKU '" + sku + "'",
                    Map.of("deleted", result.deleted())));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error(e.getMessage()));
        }
    }

    /**
     * DELETE /api/sales/range?from=yyyy-MM-dd&to=yyyy-MM-dd
     * Deletes all transactions in a date range for the current store.
     */
    @DeleteMapping("/range")
    public ResponseEntity<ApiResponse<Map<String, Object>>> deleteByRange(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {

        if (from.isAfter(to)) {
            return ResponseEntity.badRequest().body(ApiResponse.error("'from' must be before 'to'"));
        }
        try {
            SalesIngestionService.DeleteResult result = salesIngestionService.deleteByDateRange(from, to);
            if (result.deleted() > 0) {
                forecastTriggerService.triggerForCurrentStore("sales-delete-by-range");
            }
            return ResponseEntity.ok(ApiResponse.success(
                    String.format("Deleted transactions between %s and %s", from, to),
                    Map.of("deleted", result.deleted())));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error(e.getMessage()));
        }
    }

    /**
     * DELETE /api/sales/product/{sku}/range?from=yyyy-MM-dd&to=yyyy-MM-dd
     * Deletes transactions for a specific SKU within a date range.
     */
    @DeleteMapping("/product/{sku}/range")
    public ResponseEntity<ApiResponse<Map<String, Object>>> deleteBySkuAndRange(
            @PathVariable String sku,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {

        if (from.isAfter(to)) {
            return ResponseEntity.badRequest().body(ApiResponse.error("'from' must be before 'to'"));
        }
        try {
            SalesIngestionService.DeleteResult result = salesIngestionService.deleteBySkuAndDateRange(sku, from, to);
            if (result.deleted() > 0) {
                forecastTriggerService.triggerForCurrentStore("sales-delete-by-sku-range");
            }
            return ResponseEntity.ok(ApiResponse.success(
                    String.format("Deleted %d transactions for SKU '%s' between %s and %s",
                            result.deleted(), sku, from, to),
                    Map.of("deleted", result.deleted())));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error(e.getMessage()));
        }
    }

    /**
     * DELETE /api/sales/all
     * Deletes ALL transactions for the current store (nuclear reset).
     * Use with caution — this cannot be undone.
     */
    @DeleteMapping("/all")
    public ResponseEntity<ApiResponse<Map<String, Object>>> deleteAll() {
        try {
            SalesIngestionService.DeleteResult result = salesIngestionService.deleteAllForStore();
            if (result.deleted() > 0) {
                forecastTriggerService.triggerForCurrentStore("sales-delete-all");
            }
            return ResponseEntity.ok(ApiResponse.success(
                    "All transactions deleted for this store",
                    Map.of("deleted", result.deleted())));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error(e.getMessage()));
        }
    }
}
