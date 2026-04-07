package com.forestock.forestock_backend.controller;

import com.forestock.forestock_backend.domain.Product;
import com.forestock.forestock_backend.domain.SalesTransaction;
import com.forestock.forestock_backend.domain.Store;
import com.forestock.forestock_backend.service.ForecastOrchestrator;
import com.forestock.forestock_backend.service.SalesIngestionService;
import com.forestock.forestock_backend.service.StoreConfigurationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class SalesControllerTest {

    private MockMvc mockMvc;
    private SalesIngestionService salesIngestionService;

    @BeforeEach
    void setUp() {
        salesIngestionService = mock(SalesIngestionService.class);
        ForecastOrchestrator forecastOrchestrator = mock(ForecastOrchestrator.class);
        StoreConfigurationService storeConfigurationService = mock(StoreConfigurationService.class);

        mockMvc = MockMvcBuilders.standaloneSetup(
                new SalesController(salesIngestionService, forecastOrchestrator, storeConfigurationService))
                .setControllerAdvice(new ApiExceptionHandler())
                .build();
    }

    @Test
    void getDailySales_returnsDtoPayload() throws Exception {
        Store store = Store.builder().id(UUID.randomUUID()).name("Smoke Store").build();
        Product product = Product.builder()
                .id(UUID.randomUUID())
                .store(store)
                .sku("SKU-001")
                .name("Test Product")
                .unit("pcs")
                .active(true)
                .build();
        SalesTransaction sale = SalesTransaction.builder()
                .id(UUID.randomUUID())
                .store(store)
                .product(product)
                .saleDate(LocalDate.of(2026, 4, 7))
                .quantitySold(BigDecimal.valueOf(3))
                .build();

        when(salesIngestionService.getDailySales("SKU-001")).thenReturn(List.of(sale));

        mockMvc.perform(get("/api/sales/SKU-001/daily"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].productSku").value("SKU-001"))
                .andExpect(jsonPath("$.data[0].productName").value("Test Product"))
                .andExpect(jsonPath("$.data[0].quantitySold").value(3));
    }
}
