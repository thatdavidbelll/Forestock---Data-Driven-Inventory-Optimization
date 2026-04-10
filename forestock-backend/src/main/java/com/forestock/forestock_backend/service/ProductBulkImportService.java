package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.domain.Product;
import com.forestock.forestock_backend.domain.Store;
import com.forestock.forestock_backend.dto.response.ProductDto;
import com.forestock.forestock_backend.repository.ProductRepository;
import com.forestock.forestock_backend.repository.StoreRepository;
import com.forestock.forestock_backend.security.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVPrinter;
import org.apache.commons.csv.CSVRecord;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.StringWriter;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProductBulkImportService {

    private static final String[] HEADERS = {
            "sku", "name", "category", "unit", "reorder_point", "max_stock",
            "lead_time_days", "minimum_order_qty", "unit_cost", "supplier_name"
    };

    private final ProductRepository productRepository;
    private final StoreRepository storeRepository;
    private final AuditLogService auditLogService;
    private final ForecastTriggerService forecastTriggerService;

    public record ImportResult(int imported, int skipped, List<String> errors) {}

    @Transactional
    public ImportResult importCsv(MultipartFile file, boolean updateExisting) throws IOException {
        UUID storeId = TenantContext.getStoreId();
        if (storeId == null) {
            throw new IllegalStateException("No store context");
        }

        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new NoSuchElementException("Store not found"));
        Map<String, Product> existingBySku = new HashMap<>();
        for (Product product : productRepository.findByStoreId(storeId)) {
            existingBySku.put(product.getSku(), product);
        }

        List<String> errors = new ArrayList<>();
        int imported = 0;
        int skipped = 0;

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8));
             CSVParser parser = CSVFormat.DEFAULT.builder()
                     .setHeader()
                     .setSkipHeaderRecord(true)
                     .setTrim(true)
                     .setIgnoreEmptyLines(true)
                     .build()
                     .parse(reader)) {

            List<String> detectedHeaders = parser.getHeaderNames();
            if (!List.of(HEADERS).equals(detectedHeaders)) {
                return new ImportResult(0, 0, List.of("Invalid CSV headers. Expected: " + String.join(",", HEADERS)));
            }

            for (CSVRecord record : parser) {
                long line = record.getRecordNumber() + 1;
                String sku = read(record, "sku");
                String name = read(record, "name");
                String unit = read(record, "unit");

                List<String> rowErrors = new ArrayList<>();
                if (sku == null || sku.isBlank()) rowErrors.add("SKU is required");
                if (name == null || name.isBlank()) rowErrors.add("Name is required");
                if (unit == null || unit.isBlank()) rowErrors.add("Unit is required");

                Integer leadTimeDays = parseInteger(read(record, "lead_time_days"), "lead_time_days", rowErrors);
                BigDecimal reorderPoint = parseDecimal(read(record, "reorder_point"), "reorder_point", rowErrors);
                BigDecimal maxStock = parseDecimal(read(record, "max_stock"), "max_stock", rowErrors);
                BigDecimal minimumOrderQty = parseDecimal(read(record, "minimum_order_qty"), "minimum_order_qty", rowErrors);
                BigDecimal unitCost = parseDecimal(read(record, "unit_cost"), "unit_cost", rowErrors);

                if (!rowErrors.isEmpty()) {
                    errors.add("Row " + line + ": " + String.join("; ", rowErrors));
                    skipped++;
                    continue;
                }

                Product existing = existingBySku.get(sku);
                if (existing != null && !updateExisting) {
                    skipped++;
                    continue;
                }

                Product product = existing != null ? existing : Product.builder().store(store).sku(sku.trim()).active(true).build();
                product.setName(name.trim());
                product.setCategory(blankToNull(read(record, "category")));
                product.setUnit(unit.trim());
                product.setReorderPoint(reorderPoint);
                product.setMaxStock(maxStock);
                product.setLeadTimeDays(leadTimeDays);
                product.setMinimumOrderQty(minimumOrderQty);
                product.setUnitCost(unitCost);
                product.setSupplierName(blankToNull(read(record, "supplier_name")));

                Product saved = productRepository.save(product);
                existingBySku.put(saved.getSku(), saved);
                imported++;
            }
        }

        auditLogService.log(
                "PRODUCTS_IMPORTED",
                "Product",
                null,
                "Imported " + imported + " products, skipped " + skipped + ", errors=" + errors.size() + ", updateExisting=" + updateExisting
        );
        if (imported > 0) {
            forecastTriggerService.triggerForStore(storeId, "product-bulk-import");
        }
        log.info("Product import complete: imported={}, skipped={}, errors={}", imported, skipped, errors.size());
        return new ImportResult(imported, skipped, errors);
    }

    @Transactional(readOnly = true)
    public byte[] exportCsv(boolean templateOnly) throws IOException {
        UUID storeId = TenantContext.getStoreId();
        List<Product> products = templateOnly
                ? List.of()
                : (storeId != null ? productRepository.findByStoreIdAndActiveTrue(storeId) : productRepository.findByActiveTrue());

        StringWriter writer = new StringWriter();
        try (CSVPrinter printer = new CSVPrinter(writer, CSVFormat.DEFAULT.builder().setHeader(HEADERS).build())) {
            for (Product product : products) {
                printer.printRecord(
                        product.getSku(),
                        product.getName(),
                        defaultString(product.getCategory()),
                        product.getUnit(),
                        decimalString(product.getReorderPoint()),
                        decimalString(product.getMaxStock()),
                        product.getLeadTimeDays(),
                        decimalString(product.getMinimumOrderQty()),
                        decimalString(product.getUnitCost()),
                        defaultString(product.getSupplierName())
                );
            }
        }
        return writer.toString().getBytes(StandardCharsets.UTF_8);
    }

    private String read(CSVRecord record, String column) {
        try {
            return record.isMapped(column) ? record.get(column) : "";
        } catch (IllegalArgumentException ex) {
            return "";
        }
    }

    private Integer parseInteger(String value, String field, List<String> errors) {
        if (value == null || value.isBlank()) return null;
        try {
            return Integer.valueOf(value.trim());
        } catch (NumberFormatException ex) {
            errors.add(field + " must be a whole number");
            return null;
        }
    }

    private BigDecimal parseDecimal(String value, String field, List<String> errors) {
        if (value == null || value.isBlank()) return null;
        try {
            return new BigDecimal(value.trim());
        } catch (NumberFormatException ex) {
            errors.add(field + " must be numeric");
            return null;
        }
    }

    private String blankToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String decimalString(BigDecimal value) {
        return value == null ? "" : value.stripTrailingZeros().toPlainString();
    }

    private String defaultString(String value) {
        return value == null ? "" : value;
    }
}
