package com.forestock.forestock_backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.forestock.forestock_backend.domain.AuditLog;
import com.forestock.forestock_backend.domain.Store;
import com.forestock.forestock_backend.repository.AuditLogRepository;
import com.forestock.forestock_backend.repository.StoreRepository;
import com.forestock.forestock_backend.security.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuditLogServiceTest {

    @Mock private AuditLogRepository auditLogRepository;
    @Mock private StoreRepository storeRepository;

    private AuditLogService auditLogService;

    @org.junit.jupiter.api.BeforeEach
    void setUp() {
        auditLogService = new AuditLogService(auditLogRepository, storeRepository, new ObjectMapper());
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void listStoreAuditLogs_withoutFilters_usesStoreScopedPagedQuery() {
        UUID storeId = UUID.randomUUID();
        PageRequest pageable = PageRequest.of(0, 20);
        AuditLog log = AuditLog.builder()
                .id(UUID.randomUUID())
                .store(Store.builder().id(storeId).name("Smoke Store").build())
                .actorUsername("storeadmin")
                .action("INVENTORY_UPDATED")
                .entityType("Product")
                .entityId(UUID.randomUUID().toString())
                .detail("{\"after\":{\"quantity\":25}}")
                .occurredAt(LocalDateTime.now())
                .build();

        TenantContext.setStoreId(storeId);
        when(auditLogRepository.findByStoreIdOrderByOccurredAtDesc(storeId, pageable)).thenReturn(List.of(log));
        when(auditLogRepository.countByStoreId(storeId)).thenReturn(1L);

        var result = auditLogService.listStoreAuditLogs(null, null, null, null, pageable);

        assertThat(result.getContent()).hasSize(1);
        assertThat(result.getContent().getFirst().getAction()).isEqualTo("INVENTORY_UPDATED");
        assertThat(result.getTotalElements()).isEqualTo(1L);
        verify(auditLogRepository).findByStoreIdOrderByOccurredAtDesc(storeId, pageable);
        verify(auditLogRepository).countByStoreId(storeId);
    }

    @Test
    void listStoreAuditLogs_withActorFilter_usesFilteredQuery() {
        UUID storeId = UUID.randomUUID();
        PageRequest pageable = PageRequest.of(0, 20);

        TenantContext.setStoreId(storeId);
        when(auditLogRepository.findByStoreFiltered(storeId, null, "%storeadmin%", null, null, pageable))
                .thenReturn(org.springframework.data.domain.Page.empty(pageable));

        var result = auditLogService.listStoreAuditLogs(null, "storeadmin", null, null, pageable);

        assertThat(result.getContent()).isEmpty();
        verify(auditLogRepository).findByStoreFiltered(storeId, null, "%storeadmin%", null, null, pageable);
    }
}
