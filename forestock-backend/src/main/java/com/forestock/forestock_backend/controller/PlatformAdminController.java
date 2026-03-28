package com.forestock.forestock_backend.controller;

import com.forestock.forestock_backend.domain.Store;
import com.forestock.forestock_backend.dto.response.ApiResponse;
import com.forestock.forestock_backend.dto.response.StoreDto;
import com.forestock.forestock_backend.repository.StoreRepository;
import com.forestock.forestock_backend.service.AuditLogService;
import lombok.RequiredArgsConstructor;
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

    private final StoreRepository storeRepository;
    private final AuditLogService auditLogService;

    /** List all stores on the platform. */
    @GetMapping("/stores")
    public ResponseEntity<ApiResponse<List<StoreDto>>> listAllStores() {
        List<StoreDto> stores = storeRepository.findAll()
                .stream()
                .map(this::toDto)
                .toList();
        return ResponseEntity.ok(ApiResponse.success(stores));
    }

    /** Deactivate a store (soft delete — all data is preserved). */
    @PutMapping("/stores/{id}/deactivate")
    public ResponseEntity<ApiResponse<StoreDto>> deactivateStore(@PathVariable UUID id) {
        Store store = storeRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Store not found: " + id));
        store.setActive(false);
        Store saved = storeRepository.save(store);
        auditLogService.log("STORE_DEACTIVATED", "Store", saved.getId().toString(),
                "Deactivated store '" + saved.getName() + "'");
        return ResponseEntity.ok(ApiResponse.success("Store deactivated", toDto(saved)));
    }

    /** Reactivate a previously deactivated store. */
    @PutMapping("/stores/{id}/activate")
    public ResponseEntity<ApiResponse<StoreDto>> activateStore(@PathVariable UUID id) {
        Store store = storeRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Store not found: " + id));
        store.setActive(true);
        Store saved = storeRepository.save(store);
        auditLogService.log("STORE_ACTIVATED", "Store", saved.getId().toString(),
                "Activated store '" + saved.getName() + "'");
        return ResponseEntity.ok(ApiResponse.success("Store activated", toDto(saved)));
    }

    // ── Mapping ───────────────────────────────────────────────────────────────

    private StoreDto toDto(Store s) {
        return StoreDto.builder()
                .id(s.getId())
                .name(s.getName())
                .slug(s.getSlug())
                .active(s.getActive())
                .createdAt(s.getCreatedAt())
                .build();
    }
}
