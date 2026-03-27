package com.forestock.forestock_backend.controller;

import com.forestock.forestock_backend.domain.AppUser;
import com.forestock.forestock_backend.domain.Store;
import com.forestock.forestock_backend.dto.request.RegisterRequest;
import com.forestock.forestock_backend.dto.response.ApiResponse;
import com.forestock.forestock_backend.dto.response.AuthResponse;
import com.forestock.forestock_backend.dto.response.StoreDto;
import com.forestock.forestock_backend.repository.AppUserRepository;
import com.forestock.forestock_backend.repository.StoreRepository;
import com.forestock.forestock_backend.security.TenantContext;
import com.forestock.forestock_backend.service.RegisterService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.NoSuchElementException;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class StoreController {

    private final RegisterService registerService;
    private final StoreRepository storeRepository;
    private final AppUserRepository userRepository;

    /** Public endpoint — registers a new store + admin user. */
    @PostMapping("/api/register")
    public ResponseEntity<ApiResponse<AuthResponse>> register(@Valid @RequestBody RegisterRequest request) {
        try {
            AuthResponse response = registerService.register(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(ApiResponse.error(e.getMessage()));
        }
    }

    /** Returns the current user's store details. */
    @GetMapping("/api/store")
    public ResponseEntity<ApiResponse<StoreDto>> getStore() {
        UUID storeId = TenantContext.getStoreId();
        if (storeId == null) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error("No store context"));
        }
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new NoSuchElementException("Store not found"));
        return ResponseEntity.ok(ApiResponse.success(toDto(store)));
    }

    /** Updates the current store's name. */
    @PutMapping("/api/store")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<StoreDto>> updateStore(@RequestBody StoreDto request) {
        UUID storeId = TenantContext.getStoreId();
        if (storeId == null) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error("No store context"));
        }
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new NoSuchElementException("Store not found"));
        if (request.getName() != null && !request.getName().isBlank()) {
            store.setName(request.getName());
        }
        return ResponseEntity.ok(ApiResponse.success(toDto(storeRepository.save(store))));
    }

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
