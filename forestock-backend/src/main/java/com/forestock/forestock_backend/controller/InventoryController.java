package com.forestock.forestock_backend.controller;

import com.forestock.forestock_backend.dto.request.InventoryUpdateRequest;
import com.forestock.forestock_backend.dto.response.ApiResponse;
import com.forestock.forestock_backend.dto.response.InventoryDto;
import com.forestock.forestock_backend.dto.response.SlowMoverDto;
import com.forestock.forestock_backend.security.TenantContext;
import com.forestock.forestock_backend.service.ForecastTriggerService;
import com.forestock.forestock_backend.service.InventoryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;

@RestController
@RequestMapping("/api/inventory")
@RequiredArgsConstructor
@Slf4j
public class InventoryController {

    private final InventoryService inventoryService;
    private final ForecastTriggerService forecastTriggerService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<InventoryDto>>> getCurrentStock() {
        return ResponseEntity.ok(ApiResponse.success(inventoryService.getCurrentStock()));
    }

    @GetMapping("/alerts")
    public ResponseEntity<ApiResponse<List<InventoryDto>>> getAlerts() {
        return ResponseEntity.ok(ApiResponse.success(inventoryService.getAlerts()));
    }

    @GetMapping("/slow-movers")
    public ResponseEntity<ApiResponse<List<SlowMoverDto>>> getSlowMovers(
            @RequestParam(defaultValue = "30") int inactiveDays) {
        return ResponseEntity.ok(ApiResponse.success(inventoryService.getSlowMovers(inactiveDays)));
    }

    @PutMapping("/{productId}")
    public ResponseEntity<ApiResponse<InventoryDto>> updateStock(
            @PathVariable UUID productId,
            @Valid @RequestBody InventoryUpdateRequest request) {
        try {
            InventoryDto result = inventoryService.updateStock(
                    productId,
                    request.getQuantity(),
                    request.getAdjustmentReason(),
                    request.getAdjustmentNote()
            );
            forecastTriggerService.triggerForStore(TenantContext.getStoreId(), "inventory-updated");
            return ResponseEntity.ok(ApiResponse.success("Stock updated", result));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error(e.getMessage()));
        }
    }

    @GetMapping("/{productId}/history")
    public ResponseEntity<ApiResponse<List<InventoryDto>>> getHistory(@PathVariable UUID productId) {
        try {
            return ResponseEntity.ok(ApiResponse.success(inventoryService.getHistory(productId)));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error(e.getMessage()));
        }
    }
}
