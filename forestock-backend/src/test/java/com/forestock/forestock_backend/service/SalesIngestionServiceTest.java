package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.domain.Product;
import com.forestock.forestock_backend.domain.SalesTransaction;
import com.forestock.forestock_backend.repository.ProductRepository;
import com.forestock.forestock_backend.repository.SalesTransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SalesIngestionServiceTest {

    @Mock
    private SalesTransactionRepository salesTransactionRepository;

    @Mock
    private ProductRepository productRepository;

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

    @Test
    void importCsv_valid_data_imports_all_rows() throws IOException {
        String csv = "sku,sale_date,quantity_sold\n" +
                     "MILK-001,2026-03-01,10\n" +
                     "MILK-001,2026-03-02,15\n";
        MockMultipartFile file = new MockMultipartFile("file", "sales.csv",
                "text/csv", csv.getBytes());

        when(productRepository.findBySku("MILK-001")).thenReturn(Optional.of(testProduct));
        when(salesTransactionRepository.findByProductIdAndSaleDate(any(), any()))
                .thenReturn(Optional.empty());
        when(salesTransactionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        SalesIngestionService.ImportResult result = salesIngestionService.importCsv(file, false);

        assertThat(result.imported()).isEqualTo(2);
        assertThat(result.skipped()).isEqualTo(0);
        assertThat(result.errors()).isEmpty();
        verify(salesTransactionRepository, times(2)).save(any());
    }

    @Test
    void importCsv_unknown_sku_adds_error() throws IOException {
        String csv = "sku,sale_date,quantity_sold\n" +
                     "UNKNOWN-SKU,2026-03-01,10\n";
        MockMultipartFile file = new MockMultipartFile("file", "sales.csv",
                "text/csv", csv.getBytes());

        when(productRepository.findBySku("UNKNOWN-SKU")).thenReturn(Optional.empty());

        SalesIngestionService.ImportResult result = salesIngestionService.importCsv(file, false);

        assertThat(result.imported()).isEqualTo(0);
        assertThat(result.errors()).hasSize(1);
        assertThat(result.errors().get(0)).contains("UNKNOWN-SKU");
    }

    @Test
    void importCsv_invalid_date_format_adds_error() throws IOException {
        String csv = "sku,sale_date,quantity_sold\n" +
                     "MILK-001,01/03/2026,10\n";
        MockMultipartFile file = new MockMultipartFile("file", "sales.csv",
                "text/csv", csv.getBytes());

        when(productRepository.findBySku("MILK-001")).thenReturn(Optional.of(testProduct));

        SalesIngestionService.ImportResult result = salesIngestionService.importCsv(file, false);

        assertThat(result.imported()).isEqualTo(0);
        assertThat(result.errors()).hasSize(1);
        assertThat(result.errors().get(0)).containsIgnoringCase("date");
    }

    @Test
    void importCsv_negative_quantity_adds_error() throws IOException {
        String csv = "sku,sale_date,quantity_sold\n" +
                     "MILK-001,2026-03-01,-5\n";
        MockMultipartFile file = new MockMultipartFile("file", "sales.csv",
                "text/csv", csv.getBytes());

        when(productRepository.findBySku("MILK-001")).thenReturn(Optional.of(testProduct));

        SalesIngestionService.ImportResult result = salesIngestionService.importCsv(file, false);

        assertThat(result.imported()).isEqualTo(0);
        assertThat(result.errors()).hasSize(1);
    }

    @Test
    void importCsv_existing_record_skipped_when_overwrite_false() throws IOException {
        String csv = "sku,sale_date,quantity_sold\n" +
                     "MILK-001,2026-03-01,10\n";
        MockMultipartFile file = new MockMultipartFile("file", "sales.csv",
                "text/csv", csv.getBytes());

        SalesTransaction existing = SalesTransaction.builder()
                .id(UUID.randomUUID())
                .product(testProduct)
                .saleDate(LocalDate.of(2026, 3, 1))
                .quantitySold(BigDecimal.TEN)
                .build();

        when(productRepository.findBySku("MILK-001")).thenReturn(Optional.of(testProduct));
        when(salesTransactionRepository.findByProductIdAndSaleDate(any(), any()))
                .thenReturn(Optional.of(existing));

        SalesIngestionService.ImportResult result = salesIngestionService.importCsv(file, false);

        assertThat(result.imported()).isEqualTo(0);
        assertThat(result.skipped()).isEqualTo(1);
        verify(salesTransactionRepository, never()).save(any());
    }

    @Test
    void importCsv_existing_record_overwritten_when_overwrite_true() throws IOException {
        String csv = "sku,sale_date,quantity_sold\n" +
                     "MILK-001,2026-03-01,20\n";
        MockMultipartFile file = new MockMultipartFile("file", "sales.csv",
                "text/csv", csv.getBytes());

        SalesTransaction existing = SalesTransaction.builder()
                .id(UUID.randomUUID())
                .product(testProduct)
                .saleDate(LocalDate.of(2026, 3, 1))
                .quantitySold(BigDecimal.TEN)
                .build();

        when(productRepository.findBySku("MILK-001")).thenReturn(Optional.of(testProduct));
        when(salesTransactionRepository.findByProductIdAndSaleDate(any(), any()))
                .thenReturn(Optional.of(existing));
        when(salesTransactionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        SalesIngestionService.ImportResult result = salesIngestionService.importCsv(file, true);

        assertThat(result.imported()).isEqualTo(1);
        assertThat(result.skipped()).isEqualTo(0);
        verify(salesTransactionRepository, times(1)).save(any());
    }
}
