package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.domain.Product;
import com.forestock.forestock_backend.domain.SalesTransaction;
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

    public record ImportResult(int imported, int skipped, List<String> errors) {}

    /**
     * Parses and imports a CSV file using JDBC batch UPSERT for performance.
     */
    @Transactional
    public ImportResult importCsv(MultipartFile file, boolean overwriteExisting) throws IOException {
        List<String> errors = new ArrayList<>();
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

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8));
             CSVParser parser = CSVFormat.DEFAULT
                     .builder()
                     .setHeader(EXPECTED_HEADERS)
                     .setSkipHeaderRecord(true)
                     .setTrim(true)
                     .setIgnoreEmptyLines(true)
                     .build()
                     .parse(reader)) {

            for (CSVRecord record : parser) {
                long lineNumber = record.getRecordNumber() + 1;
                try {
                    String sku     = record.get("sku");
                    String dateStr = record.get("sale_date");
                    String qtyStr  = record.get("quantity_sold");

                    if (sku == null || sku.isBlank()) {
                        errors.add("Line " + lineNumber + ": missing SKU");
                        continue;
                    }
                    Product product = productBySku.get(sku);
                    if (product == null) {
                        errors.add("Line " + lineNumber + ": unknown SKU '" + sku + "'");
                        continue;
                    }

                    LocalDate saleDate;
                    try {
                        saleDate = LocalDate.parse(dateStr);
                    } catch (DateTimeParseException e) {
                        errors.add("Line " + lineNumber + ": invalid date '" + dateStr + "' (expected: yyyy-MM-dd)");
                        continue;
                    }

                    BigDecimal qty;
                    try {
                        qty = new BigDecimal(qtyStr);
                        if (qty.compareTo(BigDecimal.ZERO) < 0) {
                            errors.add("Line " + lineNumber + ": negative quantity");
                            continue;
                        }
                    } catch (NumberFormatException e) {
                        errors.add("Line " + lineNumber + ": invalid quantity '" + qtyStr + "'");
                        continue;
                    }

                    UUID productStoreId = product.getStore() != null ? product.getStore().getId() : storeId;
                    batch.add(new Object[]{productStoreId, product.getId(), Date.valueOf(saleDate), qty});

                } catch (Exception e) {
                    errors.add("Line " + lineNumber + ": unexpected error — " + e.getMessage());
                }
            }
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
        int skipped  = 0;

        log.info("CSV import complete: imported={}, skipped={}, errors={}", imported, skipped, errors.size());
        return new ImportResult(imported, skipped, errors);
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
