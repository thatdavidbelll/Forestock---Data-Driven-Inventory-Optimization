package com.forestock.forestock_backend.controller;

import com.forestock.forestock_backend.dto.response.ApiResponse;
import com.forestock.forestock_backend.dto.response.DashboardDto;
import com.forestock.forestock_backend.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    /** KPI-uri principale pentru dashboard. */
    @GetMapping
    public ResponseEntity<ApiResponse<DashboardDto>> getDashboard() {
        return ResponseEntity.ok(ApiResponse.success(dashboardService.getDashboard()));
    }

    @GetMapping("/alert-trend")
    public ResponseEntity<ApiResponse<List<DashboardDto.AlertTrendPoint>>> getAlertTrend() {
        return ResponseEntity.ok(ApiResponse.success(
                dashboardService.getAlertTrend(com.forestock.forestock_backend.security.TenantContext.getStoreId())));
    }

    @GetMapping("/sales-velocity")
    public ResponseEntity<ApiResponse<List<DashboardDto.SalesVelocityPoint>>> getSalesVelocityTrend() {
        return ResponseEntity.ok(ApiResponse.success(
                dashboardService.getSalesVelocityTrend(com.forestock.forestock_backend.security.TenantContext.getStoreId())));
    }

    @GetMapping("/data-quality-warnings")
    public ResponseEntity<ApiResponse<List<String>>> getDataQualityWarnings() {
        return ResponseEntity.ok(ApiResponse.success(
                dashboardService.getDataQualityWarnings(com.forestock.forestock_backend.security.TenantContext.getStoreId())));
    }

    /** Breakdown pe categorii de produse. */
    @GetMapping("/categories")
    public ResponseEntity<ApiResponse<List<DashboardDto.CategorySummary>>> getCategories() {
        return ResponseEntity.ok(ApiResponse.success(dashboardService.getCategorySummaries()));
    }
}
