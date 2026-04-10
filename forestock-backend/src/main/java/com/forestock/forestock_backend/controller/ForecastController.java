package com.forestock.forestock_backend.controller;

import com.forestock.forestock_backend.dto.response.ApiResponse;
import com.forestock.forestock_backend.dto.response.ForecastRunDto;
import com.forestock.forestock_backend.domain.enums.ForecastStatus;
import com.forestock.forestock_backend.repository.ForecastRunRepository;
import com.forestock.forestock_backend.security.TenantContext;
import com.forestock.forestock_backend.service.ForecastOrchestrator;
import com.forestock.forestock_backend.service.ForecastService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;


@RestController
@RequestMapping("/api/forecast")
@RequiredArgsConstructor
public class ForecastController {

    private final ForecastOrchestrator forecastOrchestrator;
    private final ForecastService forecastService;
    private final ForecastRunRepository forecastRunRepository;

    /** Manually triggers a full forecast cycle (async). */
    @PostMapping("/run")
    public ResponseEntity<ApiResponse<String>> triggerRun() {
        UUID storeId = TenantContext.getStoreId();
        if (forecastRunRepository.existsByStoreIdAndStatus(storeId, ForecastStatus.RUNNING)) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(ApiResponse.error("A forecast is already running for this store"));
        }
        forecastOrchestrator.runForecast(storeId, "MANUAL");
        return ResponseEntity.accepted()
                .body(ApiResponse.success("Forecast started in background"));
    }

    /** Returns the history of all runs, ordered by start time descending. */
    @GetMapping("/runs")
    public ResponseEntity<ApiResponse<List<ForecastRunDto>>> getAllRuns() {
        return ResponseEntity.ok(ApiResponse.success(forecastService.getAllRuns()));
    }

    /** Returns details for a specific run. */
    @GetMapping("/runs/{id}")
    public ResponseEntity<ApiResponse<ForecastRunDto>> getRunById(@PathVariable UUID id) {
        try {
            return ResponseEntity.ok(ApiResponse.success(forecastService.getRunById(id)));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error("Forecast run not found"));
        }
    }

    /** Returns the most recently completed run. */
    @GetMapping("/latest")
    public ResponseEntity<ApiResponse<ForecastRunDto>> getLatest() {
        try {
            return ResponseEntity.ok(ApiResponse.success(forecastService.getLatestCompletedRun()));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error(e.getMessage()));
        }
    }
}
