package com.forestock.forestock_backend.controller;

import com.forestock.forestock_backend.security.TenantContext;
import com.forestock.forestock_backend.service.ReportService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.time.LocalDate;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;

    @GetMapping("/inventory-valuation")
    public ResponseEntity<byte[]> inventoryValuation(@RequestParam(defaultValue = "excel") String format) throws IOException {
        UUID storeId = TenantContext.getStoreId();
        byte[] bytes = reportService.generateInventoryValuationReport(storeId, format);
        return buildResponse(bytes, "inventory-valuation-" + LocalDate.now(), format);
    }

    @GetMapping("/sales")
    public ResponseEntity<byte[]> salesPerformance(
            @RequestParam LocalDate from,
            @RequestParam LocalDate to,
            @RequestParam(defaultValue = "excel") String format) throws IOException {
        UUID storeId = TenantContext.getStoreId();
        byte[] bytes = reportService.generateSalesReport(storeId, from, to, format);
        return buildResponse(bytes, "sales-performance-" + LocalDate.now(), format);
    }

    @GetMapping("/slow-movers")
    public ResponseEntity<byte[]> slowMovers(
            @RequestParam(defaultValue = "30") int inactiveDays,
            @RequestParam(defaultValue = "excel") String format) throws IOException {
        UUID storeId = TenantContext.getStoreId();
        byte[] bytes = reportService.generateSlowMoversReport(storeId, inactiveDays, format);
        return buildResponse(bytes, "slow-movers-" + LocalDate.now(), format);
    }

    private ResponseEntity<byte[]> buildResponse(byte[] bytes, String baseName, String format) {
        boolean pdf = "pdf".equalsIgnoreCase(format);
        return ResponseEntity.ok()
                .contentType(pdf ? MediaType.APPLICATION_PDF : MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(baseName + (pdf ? ".pdf" : ".xlsx")).build().toString())
                .body(bytes);
    }
}
