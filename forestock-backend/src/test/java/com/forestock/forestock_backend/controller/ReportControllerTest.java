package com.forestock.forestock_backend.controller;

import com.forestock.forestock_backend.service.ReportService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.LocalDate;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ReportControllerTest {

    private MockMvc mockMvc;
    private ReportService reportService;

    @BeforeEach
    void setUp() throws Exception {
        reportService = mock(ReportService.class);
        when(reportService.generateSalesReport(any(), any(), any(), eq("excel"))).thenReturn(new byte[]{1, 2, 3});
        when(reportService.generateInventoryValuationReport(any(), eq("excel"))).thenReturn(new byte[]{1, 2, 3});
        when(reportService.generateSlowMoversReport(any(), eq(30), eq("excel"))).thenReturn(new byte[]{1, 2, 3});

        mockMvc = MockMvcBuilders.standaloneSetup(new ReportController(reportService))
                .setControllerAdvice(new ApiExceptionHandler())
                .build();
    }

    @Test
    void salesReport_defaultsDateRangeWhenParamsAreMissing() throws Exception {
        mockMvc.perform(get("/api/reports/sales"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString("sales-performance-")));

        LocalDate expectedTo = LocalDate.now();
        LocalDate expectedFrom = expectedTo.minusDays(29);
        verify(reportService).generateSalesReport(any(), eq(expectedFrom), eq(expectedTo), eq("excel"));
    }
}
