package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.domain.Store;
import com.forestock.forestock_backend.dto.response.StoreDto;
import com.forestock.forestock_backend.repository.StoreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class StoreAdministrationService {

    private final StoreRepository storeRepository;
    private final AuditLogService auditLogService;
    private final JdbcTemplate jdbcTemplate;

    @Transactional(readOnly = true)
    public List<StoreDto> listAllStores() {
        return storeRepository.findAll()
                .stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional
    public StoreDto deactivateStore(UUID id) {
        Store store = storeRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Store not found: " + id));
        store.setActive(false);
        Store saved = storeRepository.save(store);
        auditLogService.log("STORE_DEACTIVATED", "Store", saved.getId().toString(),
                "Deactivated store '" + saved.getName() + "'");
        return toDto(saved);
    }

    @Transactional
    public StoreDto activateStore(UUID id) {
        Store store = storeRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Store not found: " + id));
        store.setActive(true);
        Store saved = storeRepository.save(store);
        auditLogService.log("STORE_ACTIVATED", "Store", saved.getId().toString(),
                "Activated store '" + saved.getName() + "'");
        return toDto(saved);
    }

    @Transactional
    public void deleteStore(UUID id) {
        Store store = storeRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Store not found: " + id));

        auditLogService.log("STORE_DELETED", "Store", store.getId().toString(),
                "Deleted store '" + store.getName() + "' and all associated data");

        // Delete dependents both by store_id and by FK relationship so legacy cross-linked
        // rows cannot block store deletion with referential integrity errors.
        jdbcTemplate.update("""
                DELETE FROM order_suggestions
                WHERE store_id = ?
                   OR product_id IN (SELECT id FROM products WHERE store_id = ?)
                   OR forecast_run_id IN (SELECT id FROM forecast_runs WHERE store_id = ?)
                """, id, id, id);
        jdbcTemplate.update("DELETE FROM audit_logs WHERE store_id = ?", id);
        jdbcTemplate.update("DELETE FROM forecast_runs WHERE store_id = ?", id);
        jdbcTemplate.update("""
                DELETE FROM sales_transactions
                WHERE store_id = ?
                   OR product_id IN (SELECT id FROM products WHERE store_id = ?)
                """, id, id);
        jdbcTemplate.update("""
                DELETE FROM inventory
                WHERE store_id = ?
                   OR product_id IN (SELECT id FROM products WHERE store_id = ?)
                """, id, id);
        jdbcTemplate.update("DELETE FROM users WHERE store_id = ?", id);
        jdbcTemplate.update("DELETE FROM products WHERE store_id = ?", id);
        jdbcTemplate.update("DELETE FROM stores WHERE id = ?", id);
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
