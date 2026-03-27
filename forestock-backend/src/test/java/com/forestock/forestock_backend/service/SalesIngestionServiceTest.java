package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.domain.Product;
import com.forestock.forestock_backend.repository.ProductRepository;
import com.forestock.forestock_backend.repository.SalesTransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;

import java.io.IOException;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for SalesIngestionService.importCsv().
 *
 * The current implementation uses JDBC batch UPSERT (not JPA save()), so:
 * - Products are loaded once via findByActiveTrue() (TenantContext returns null in unit tests)
 * - Rows are written via jdbcTemplate.batchUpdate(), not salesTransactionRepository.save()
 * - imported = batch.size() (rows that passed validation); skipped is always 0
 *   because DO NOTHING vs DO UPDATE is indistinguishable at the JDBC level
 */
@ExtendWith(MockitoExtension.class)
class SalesIngestionServiceTest {

    @Mock private SalesTransactionRepository salesTransactionRepository;
    @Mock private ProductRepository productRepository;
    @Mock private JdbcTemplate jdbcTemplate;

    @InjectMocks
    private SalesIngestionService salesIngestionService;

    private Product testProduct;

    @BeforeEach
    void setUp() {
        testProduct = Product.builder()
                .id(UUID.randomUUID())
                .sku("MILK-001")
                .name("UHT Milk 1L")
                .unit("unit")
                .active(true)
                .build();
    }

    // ── Happy path ────────────────────────────────────────────────────────────

    @Test
    void importCsv_valid_data_imports_all_rows() throws IOException {
        String csv = "sku,sale_date,quantity_sold\n" +
                     "MILK-001,2026-03-01,10\n" +
                     "MILK-001,2026-03-02,15\n";
        MockMultipartFile file = csvFile(csv);

        when(productRepository.findByActiveTrue()).thenReturn(List.of(testProduct));

        SalesIngestionService.ImportResult result = salesIngestionService.importCsv(file, false);

        assertThat(result.imported()).isEqualTo(2);
        assertThat(result.skipped()).isEqualTo(0);
        assertThat(result.errors()).isEmpty();
        // Verify JDBC batch was called with the correct number of rows
        verify(jdbcTemplate, atLeastOnce()).batchUpdate(anyString(), anyList());
    }

    @Test
    void importCsv_uses_upsert_sql_when_overwrite_true() throws IOException {
        String csv = "sku,sale_date,quantity_sold\nMILK-001,2026-03-01,20\n";
        MockMultipartFile file = csvFile(csv);

        when(productRepository.findByActiveTrue()).thenReturn(List.of(testProduct));

        salesIngestionService.importCsv(file, true);

        // Capture the SQL used — must contain DO UPDATE (UPSERT)
        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate).batchUpdate(sqlCaptor.capture(), anyList());
        assertThat(sqlCaptor.getValue()).containsIgnoringCase("DO UPDATE");
    }

    @Test
    void importCsv_uses_insert_only_sql_when_overwrite_false() throws IOException {
        String csv = "sku,sale_date,quantity_sold\nMILK-001,2026-03-01,20\n";
        MockMultipartFile file = csvFile(csv);

        when(productRepository.findByActiveTrue()).thenReturn(List.of(testProduct));

        salesIngestionService.importCsv(file, false);

        // Capture the SQL — must contain DO NOTHING
        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate).batchUpdate(sqlCaptor.capture(), anyList());
        assertThat(sqlCaptor.getValue()).containsIgnoringCase("DO NOTHING");
    }

    // ── Validation errors ─────────────────────────────────────────────────────

    @Test
    void importCsv_unknown_sku_adds_error() throws IOException {
        String csv = "sku,sale_date,quantity_sold\nUNKNOWN-SKU,2026-03-01,10\n";
        MockMultipartFile file = csvFile(csv);

        // No products — UNKNOWN-SKU won't be in the map
        when(productRepository.findByActiveTrue()).thenReturn(Collections.emptyList());

        SalesIngestionService.ImportResult result = salesIngestionService.importCsv(file, false);

        assertThat(result.imported()).isEqualTo(0);
        assertThat(result.errors()).hasSize(1);
        assertThat(result.errors().get(0)).contains("UNKNOWN-SKU");
        verify(jdbcTemplate, never()).batchUpdate(anyString(), anyList());
    }

    @Test
    void importCsv_invalid_date_format_adds_error() throws IOException {
        String csv = "sku,sale_date,quantity_sold\nMILK-001,01/03/2026,10\n";
        MockMultipartFile file = csvFile(csv);

        when(productRepository.findByActiveTrue()).thenReturn(List.of(testProduct));

        SalesIngestionService.ImportResult result = salesIngestionService.importCsv(file, false);

        assertThat(result.imported()).isEqualTo(0);
        assertThat(result.errors()).hasSize(1);
        assertThat(result.errors().get(0)).containsIgnoringCase("date");
        verify(jdbcTemplate, never()).batchUpdate(anyString(), anyList());
    }

    @Test
    void importCsv_negative_quantity_adds_error() throws IOException {
        String csv = "sku,sale_date,quantity_sold\nMILK-001,2026-03-01,-5\n";
        MockMultipartFile file = csvFile(csv);

        when(productRepository.findByActiveTrue()).thenReturn(List.of(testProduct));

        SalesIngestionService.ImportResult result = salesIngestionService.importCsv(file, false);

        assertThat(result.imported()).isEqualTo(0);
        assertThat(result.errors()).hasSize(1);
        assertThat(result.errors().get(0)).containsIgnoringCase("negative");
        verify(jdbcTemplate, never()).batchUpdate(anyString(), anyList());
    }

    @Test
    void importCsv_empty_file_returns_zero_results() throws IOException {
        String csv = "sku,sale_date,quantity_sold\n";
        MockMultipartFile file = csvFile(csv);

        when(productRepository.findByActiveTrue()).thenReturn(List.of(testProduct));

        SalesIngestionService.ImportResult result = salesIngestionService.importCsv(file, false);

        assertThat(result.imported()).isEqualTo(0);
        assertThat(result.errors()).isEmpty();
        verify(jdbcTemplate, never()).batchUpdate(anyString(), anyList());
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private static MockMultipartFile csvFile(String content) {
        return new MockMultipartFile("file", "sales.csv", "text/csv", content.getBytes());
    }
}
