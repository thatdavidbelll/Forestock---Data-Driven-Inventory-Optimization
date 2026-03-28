package com.forestock.forestock_backend.controller;

import com.forestock.forestock_backend.domain.Store;
import com.forestock.forestock_backend.dto.response.ApiResponse;
import com.forestock.forestock_backend.dto.response.StoreDto;
import com.forestock.forestock_backend.service.StoreAdministrationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;

/**
 * Platform-level admin endpoints — restricted to ROLE_SUPER_ADMIN (enforced in SecurityConfig).
 *
 * POST /api/register (in StoreController) is used to create stores — it is now also SUPER_ADMIN only.
 * This controller adds: list all stores + deactivate a store.
 */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class PlatformAdminController {

    private final StoreAdministrationService storeAdministrationService;

    /** List all stores on the platform. */
    @GetMapping("/stores")
    public ResponseEntity<ApiResponse<List<StoreDto>>> listAllStores() {
        return ResponseEntity.ok(ApiResponse.success(storeAdministrationService.listAllStores()));
    }

    /** Deactivate a store (soft delete — all data is preserved). */
    @PutMapping("/stores/{id}/deactivate")
    public ResponseEntity<ApiResponse<StoreDto>> deactivateStore(@PathVariable UUID id) {
        try {
            return ResponseEntity.ok(ApiResponse.success("Store deactivated", storeAdministrationService.deactivateStore(id)));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error(e.getMessage()));
        }
    }

    /** Reactivate a previously deactivated store. */
    @PutMapping("/stores/{id}/activate")
    public ResponseEntity<ApiResponse<StoreDto>> activateStore(@PathVariable UUID id) {
        try {
            return ResponseEntity.ok(ApiResponse.success("Store activated", storeAdministrationService.activateStore(id)));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error(e.getMessage()));
        }
    }

    /** Permanently delete a store and all tenant-scoped data. */
    @DeleteMapping("/stores/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteStore(@PathVariable UUID id) {
        try {
            storeAdministrationService.deleteStore(id);
            return ResponseEntity.ok(ApiResponse.success("Store deleted", null));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error(e.getMessage()));
        }
    }
}
