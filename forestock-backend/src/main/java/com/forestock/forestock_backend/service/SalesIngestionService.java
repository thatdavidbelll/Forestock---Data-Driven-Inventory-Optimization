package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.domain.Product;
import com.forestock.forestock_backend.domain.SalesTransaction;
import com.forestock.forestock_backend.dto.response.ImportRowError;
import com.forestock.forestock_backend.dto.response.SalesImportPreviewDto;
import com.forestock.forestock_backend.dto.response.SalesTransactionDto;
import com.forestock.forestock_backend.repository.ProductRepository;
import com.forestock.forestock_backend.repository.SalesTransactionRepository;
import com.forestock.forestock_backend.security.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.sql.Date;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.*;

/**
 * Imports sales transactions from CSV files exported by a POS system.
 *
 * Expected CSV format (with header):
 *   sku, sale_date (yyyy-MM-dd), quantity_sold
 *
 * Uses JDBC batch UPSERT for performance on remote databases.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SalesIngestionService {

    private static final String[] EXPECTED_HEADERS = {"sku", "sale_date", "quantity_sold"};
    private static final int JDBC_BATCH_SIZE = 500;
    private static final int MAX_CSV_ROWS = 100_000;

    private static final String UPSERT_SQL = """
            INSERT INTO sales_transactions (id, store_id, product_id, sale_date, quantity_sold)
            VALUES (gen_random_uuid(), ?, ?, ?, ?)
            ON CONFLICT (product_id, sale_date)
            DO UPDATE SET quantity_sold = EXCLUDED.quantity_sold
            """;

    private static final String INSERT_ONLY_SQL = """
            INSERT INTO sales_transactions (id, store_id, product_id, sale_date, quantity_sold)
            VALUES (gen_random_uuid(), ?, ?, ?, ?)
            ON CONFLICT (product_id, sale_date) DO NOTHING
            """;

    private final SalesTransactionRepository salesTransactionRepository;
    private final ProductRepository productRepository;
    private final JdbcTemplate jdbcTemplate;
    private final AuditLogService auditLogService;

    public record ImportResult(int imported, int skipped, List<String> errors, List<ImportRowError> rowErrors) {}
    public record ParsedCsvRow(long rowNumber, String sku, String saleDate, String quantitySold, List<String> errors) {}
    public record ParsedCsvResult(
            List<String> detectedColumns,
            boolean columnMatch,
            List<ParsedCsvRow> rows,
            long totalRowsInFile,
            List<String> structuralErrors,
            String dateFormatDetected) {}

    public ParsedCsvResult parseCsvRows(java.io.InputStream inputStream, int limit) throws IOException {
        List<ParsedCsvRow> rows = new ArrayList<>();
        List<String> structuralErrors = new ArrayList<>();
        List<String> detectedColumns = List.of();
        long totalRows = 0;

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream, StandardCharsets.UTF_8));
             CSVParser parser = CSVFormat.DEFAULT
                     .builder()
                     .setHeader()
                     .setSkipHeaderRecord(true)
                     .setTrim(true)
                     .setIgnoreEmptyLines(true)
                     .build()
                     .parse(reader)) {

            detectedColumns = parser.getHeaderNames();
            boolean columnMatch = List.of(EXPECTED_HEADERS).equals(detectedColumns);
            if (!columnMatch) {
                structuralErrors.add("Column mismatch: expected sku,sale_date,quantity_sold");
            }

            for (CSVRecord record : parser) {
                totalRows++;
                if (record.getRecordNumber() > MAX_CSV_ROWS) {
                    structuralErrors.add("CSV file exceeds maximum of 100000 rows");
                    break;
                }

                if (rows.size() >= limit) {
                    continue;
                }

                List<String> rowErrors = new ArrayList<>();
                String sku = read(record, "sku");
                String saleDate = read(record, "sale_date");
                String quantitySold = read(record, "quantity_sold");

                if (sku == null || sku.isBlank()) {
                    rowErrors.add("SKU is required");
                }
                if (saleDate != null && !saleDate.isBlank()) {
                    try {
                        LocalDate.parse(saleDate);
                    } catch (DateTimeParseException e) {
                        rowErrors.add("Invalid sale_date format, expected yyyy-MM-dd");
                    }
                }
                if (quantitySold != null && !quantitySold.isBlank()) {
                    try {
                        BigDecimal quantity = new BigDecimal(quantitySold);
                        if (quantity.compareTo(BigDecimal.ZERO) <= 0) {
                            rowErrors.add("quantity_sold must be a positive number (got " + quantitySold + ")");
                        }
                    } catch (NumberFormatException e) {
                        rowErrors.add("Invalid quantity_sold value");
                    }
                }

                rows.add(new ParsedCsvRow(
                        record.getRecordNumber() + 1,
                        sku,
                        saleDate,
                        quantitySold,
                        rowErrors
                ));
            }

            return new ParsedCsvResult(
                    detectedColumns,
                    columnMatch,
                    rows,
                    totalRows,
                    structuralErrors,
                    "yyyy-MM-dd"
            );
        }
    }

    @Transactional(readOnly = true)
    public SalesImportPreviewDto previewCsv(MultipartFile file) throws IOException {
        UUID storeId = TenantContext.getStoreId();
        List<Product> allProducts = storeId != null
                ? productRepository.findByStoreIdAndActiveTrue(storeId)
                : productRepository.findByActiveTrue();
        Set<String> knownSkus = new HashSet<>();
        for (Product product : allProducts) {
            knownSkus.add(product.getSku());
        }

        ParsedCsvResult parsed = parseCsvRows(file.getInputStream(), 20);
        Set<String> newSkus = new LinkedHashSet<>();
        int existingSkuMatches = 0;
        List<Map<String, String>> sample = new ArrayList<>();
        List<String> errors = new ArrayList<>(parsed.structuralErrors());

        for (ParsedCsvRow row : parsed.rows()) {
            if (row.sku() != null && !row.sku().isBlank()) {
                if (knownSkus.contains(row.sku())) {
                    existingSkuMatches++;
                } else {
                    newSkus.add(row.sku());
                }
            }

            Map<String, String> sampleRow = new LinkedHashMap<>();
            sampleRow.put("sku", defaultString(row.sku()));
            sampleRow.put("sale_date", defaultString(row.saleDate()));
            sampleRow.put("quantity_sold", defaultString(row.quantitySold()));
            sampleRow.put("errors", String.join("; ", row.errors()));
            sample.add(sampleRow);

            for (String rowError : row.errors()) {
                errors.add("Row " + row.rowNumber() + ": " + rowError);
            }
        }

        return SalesImportPreviewDto.builder()
                .detectedColumns(parsed.detectedColumns())
                .expectedColumns(List.of(EXPECTED_HEADERS))
                .columnMatch(parsed.columnMatch())
                .sample(sample.stream().limit(10).toList())
                .totalRowsInFile(parsed.totalRowsInFile())
                .existingSkuMatches(existingSkuMatches)
                .newSkus(new ArrayList<>(newSkus))
                .dateFormatDetected(parsed.dateFormatDetected())
                .errors(errors)
                .build();
    }

    /**
     * Parses and imports a CSV file using JDBC batch UPSERT for performance.
     */
    @Transactional
    public ImportResult importCsv(MultipartFile file, boolean overwriteExisting) throws IOException {
        List<String> errors = new ArrayList<>();
        int skipped = 0;
        UUID storeId = TenantContext.getStoreId();

        // Cache products by SKU — one query instead of N lookups
        List<Product> allProducts = storeId != null
                ? productRepository.findByStoreIdAndActiveTrue(storeId)
                : productRepository.findByActiveTrue();
        Map<String, Product> productBySku = new HashMap<>();
        for (Product p : allProducts) productBySku.put(p.getSku(), p);

        // Parse CSV into batch rows
        List<Object[]> batch = new ArrayList<>();
        String sql = overwriteExisting ? UPSERT_SQL : INSERT_ONLY_SQL;

        ParsedCsvResult parsed = parseCsvRows(file.getInputStream(), MAX_CSV_ROWS);
        if (!parsed.columnMatch()) {
            return new ImportResult(0, 0, List.of("Invalid CSV headers. Expected: sku,sale_date,quantity_sold"), List.of());
        }
        if (!parsed.structuralErrors().isEmpty()) {
            return new ImportResult(0, 0, parsed.structuralErrors(), List.of());
        }

        List<ImportRowError> rowErrors = new ArrayList<>();
        for (ParsedCsvRow row : parsed.rows()) {
            long rowNumber = row.rowNumber();
            if (!row.errors().isEmpty()) {
                rowErrors.add(new ImportRowError((int) rowNumber, row.sku(), String.join("; ", row.errors())));
                skipped++;
                continue;
            }

            String sku = row.sku();
            Product product = productBySku.get(sku);
            if (product == null) {
                rowErrors.add(new ImportRowError((int) rowNumber, sku, "SKU '" + sku + "' not found in product catalogue"));
                skipped++;
                continue;
            }

            LocalDate saleDate = LocalDate.parse(row.saleDate());
            BigDecimal qty = new BigDecimal(row.quantitySold());
            UUID productStoreId = product.getStore() != null ? product.getStore().getId() : storeId;
            batch.add(new Object[]{productStoreId, product.getId(), Date.valueOf(saleDate), qty});
        }

        // Execute JDBC batch in chunks
        // Note: PostgreSQL JDBC returns -2 (SUCCESS_NO_INFO) for UPSERT statements,
        // so we count processed rows directly from batch size and errors.
        for (int i = 0; i < batch.size(); i += JDBC_BATCH_SIZE) {
            List<Object[]> chunk = batch.subList(i, Math.min(i + JDBC_BATCH_SIZE, batch.size()));
            jdbcTemplate.batchUpdate(sql, chunk);
        }

        // For UPSERT: all batched rows were processed (inserted or updated)
        // For DO NOTHING: we can't distinguish inserts from skips without extra queries — report all as imported
        int imported = batch.size();
        List<ImportRowError> limitedRowErrors = limitRowErrors(rowErrors);
        errors.addAll(formatRowErrors(limitedRowErrors));

        auditLogService.log("SALES_IMPORTED", "SalesTransaction", null,
                "Imported " + imported + " rows, skipped " + skipped + ", errors=" + errors.size()
                        + ", overwriteExisting=" + overwriteExisting);
        log.info("CSV import complete: imported={}, skipped={}, errors={}", imported, skipped, errors.size());
        return new ImportResult(imported, skipped, errors, limitedRowErrors);
    }

    private String read(CSVRecord record, String column) {
        try {
            return record.isMapped(column) ? record.get(column) : "";
        } catch (IllegalArgumentException ex) {
            return "";
        }
    }

    private String defaultString(String value) {
        return value == null ? "" : value;
    }

    private List<String> formatRowErrors(List<ImportRowError> rowErrors) {
        return rowErrors.stream()
                .map(error -> error.rowNumber() > 0
                        ? "Row " + error.rowNumber()
                        + (error.sku() != null ? " (SKU: " + error.sku() + ")" : "")
                        + ": " + error.message()
                        : error.message())
                .toList();
    }

    private List<ImportRowError> limitRowErrors(List<ImportRowError> rowErrors) {
        if (rowErrors.size() <= 50) {
            return rowErrors;
        }
        List<ImportRowError> limited = new ArrayList<>(rowErrors.subList(0, 49));
        limited.add(new ImportRowError(0, null, "... and " + (rowErrors.size() - 49) + " more errors"));
        return limited;
    }

    /**
     * Returns all daily transactions for a product (for charting).
     */
    @Transactional(readOnly = true)
    public List<SalesTransaction> getDailySales(String sku) {
        UUID storeId = TenantContext.getStoreId();
        Product product = (storeId != null
                ? productRepository.findByStoreIdAndSku(storeId, sku)
                : productRepository.findBySku(sku))
                .orElseThrow(() -> new NoSuchElementException("Unknown SKU: " + sku));
        return salesTransactionRepository.findByProductIdOrderBySaleDateAsc(product.getId());
    }

    public record DeleteResult(int deleted) {}

    public record SalesSummary(int days, long transactions, java.math.BigDecimal totalQuantity) {}

    /**
     * Returns a paginated, filterable list of sales transactions for the current store.
     */
    @Transactional(readOnly = true)
    public Page<SalesTransactionDto> listTransactions(String sku, LocalDate from, LocalDate to, Pageable pageable) {
        UUID storeId = TenantContext.getStoreId();
        if (storeId == null) throw new IllegalStateException("No store context");

        UUID productId = null;
        if (sku != null && !sku.isBlank()) {
            productId = productRepository.findByStoreIdAndSku(storeId, sku)
                    .map(Product::getId)
                    .orElseThrow(() -> new NoSuchElementException("Unknown SKU: " + sku));
        }

        return salesTransactionRepository
                .findByStoreFiltered(storeId, productId, from, to, pageable)
                .map(s -> new SalesTransactionDto(
                        s.getId(),
                        s.getProduct().getSku(),
                        s.getProduct().getName(),
                        s.getSaleDate(),
                        s.getQuantitySold()));
    }

    /**
     * Deletes all transactions for a given SKU (store-scoped).
     */
    @Transactional
    public DeleteResult deleteBySku(String sku) {
        UUID storeId = TenantContext.getStoreId();
        Product product = (storeId != null
                ? productRepository.findByStoreIdAndSku(storeId, sku)
                : productRepository.findBySku(sku))
                .orElseThrow(() -> new NoSuchElementException("Unknown SKU: " + sku));
        int deleted = salesTransactionRepository.deleteByProductId(product.getId());
        auditLogService.log("SALES_DELETED_BY_SKU", "SalesTransaction", product.getId().toString(),
                "Deleted " + deleted + " transactions for SKU '" + sku + "'");
        log.info("Deleted {} transactions for SKU '{}' (store={})", deleted, sku, storeId);
        return new DeleteResult(deleted);
    }

    /**
     * Deletes all transactions in a date range for the current store.
     */
    @Transactional
    public DeleteResult deleteByDateRange(LocalDate from, LocalDate to) {
        UUID storeId = TenantContext.getStoreId();
        if (storeId == null) throw new IllegalStateException("No store context");
        int deleted = salesTransactionRepository.deleteByStoreAndDateRange(storeId, from, to);
        auditLogService.log("SALES_DELETED_BY_RANGE", "SalesTransaction", storeId.toString(),
                "Deleted " + deleted + " transactions between " + from + " and " + to);
        log.info("Deleted {} transactions in range [{} – {}] for store={}", deleted, from, to, storeId);
        return new DeleteResult(deleted);
    }

    /**
     * Deletes transactions for a specific SKU within a date range (store-scoped).
     */
    @Transactional
    public DeleteResult deleteBySkuAndDateRange(String sku, LocalDate from, LocalDate to) {
        UUID storeId = TenantContext.getStoreId();
        Product product = (storeId != null
                ? productRepository.findByStoreIdAndSku(storeId, sku)
                : productRepository.findBySku(sku))
                .orElseThrow(() -> new NoSuchElementException("Unknown SKU: " + sku));
        int deleted = salesTransactionRepository.deleteByProductIdAndDateRange(product.getId(), from, to);
        auditLogService.log("SALES_DELETED_BY_SKU_RANGE", "SalesTransaction", product.getId().toString(),
                "Deleted " + deleted + " transactions for SKU '" + sku + "' between " + from + " and " + to);
        log.info("Deleted {} transactions for SKU '{}' in range [{} – {}]", deleted, sku, from, to);
        return new DeleteResult(deleted);
    }

    /**
     * Deletes ALL transactions for the current store (nuclear reset).
     */
    @Transactional
    public DeleteResult deleteAllForStore() {
        UUID storeId = TenantContext.getStoreId();
        if (storeId == null) throw new IllegalStateException("No store context");
        int deleted = salesTransactionRepository.deleteAllByStore(storeId);
        auditLogService.log("SALES_DELETED_ALL", "SalesTransaction", storeId.toString(),
                "Deleted all " + deleted + " transactions for store");
        log.warn("Deleted ALL {} transactions for store={}", deleted, storeId);
        return new DeleteResult(deleted);
    }

    /**
     * Returns a sales summary for the last N days.
     */
    @Transactional(readOnly = true)
    public SalesSummary getSummary(int days) {
        LocalDate from = LocalDate.now().minusDays(days);
        LocalDate to   = LocalDate.now();
        UUID storeId = TenantContext.getStoreId();
        List<SalesTransaction> txs = (storeId != null)
                ? salesTransactionRepository.findBySaleDateBetweenAndStoreId(from, to, storeId)
                : salesTransactionRepository.findBySaleDateBetween(from, to);
        java.math.BigDecimal total = txs.stream()
                .map(SalesTransaction::getQuantitySold)
                .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add);
        return new SalesSummary(days, txs.size(), total);
    }
}
