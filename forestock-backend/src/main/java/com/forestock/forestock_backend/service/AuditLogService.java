package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.domain.AuditLog;
import com.forestock.forestock_backend.domain.Store;
import com.forestock.forestock_backend.dto.response.AuditLogDto;
import com.forestock.forestock_backend.repository.AuditLogRepository;
import com.forestock.forestock_backend.repository.StoreRepository;
import com.forestock.forestock_backend.security.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;
    private final StoreRepository storeRepository;

    @Transactional
    public void log(String action, String entityType, String entityId, String detail) {
        UUID storeId = TenantContext.getStoreId();
        Store store = storeId == null
                ? null
                : storeRepository.findById(storeId).orElse(null);

        auditLogRepository.save(AuditLog.builder()
                .store(store)
                .actorUsername(resolveActorUsername())
                .action(action)
                .entityType(entityType)
                .entityId(entityId)
                .detail(detail)
                .build());
    }

    @Transactional(readOnly = true)
    public Page<AuditLogDto> listStoreAuditLogs(String action, LocalDate from, LocalDate to, Pageable pageable) {
        UUID storeId = TenantContext.getStoreId();
        if (storeId == null) {
            throw new IllegalStateException("No store context");
        }

        LocalDateTime fromDateTime = from != null ? from.atStartOfDay() : null;
        LocalDateTime toDateTime = to != null ? to.plusDays(1).atStartOfDay().minusNanos(1) : null;

        return auditLogRepository.findByStoreFiltered(storeId, normalize(action), fromDateTime, toDateTime, pageable)
                .map(this::toDto);
    }

    private String resolveActorUsername() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null || authentication.getName().isBlank()) {
            return "system";
        }
        return authentication.getName();
    }

    private String normalize(String action) {
        return action == null || action.isBlank() ? null : action.trim();
    }

    private AuditLogDto toDto(AuditLog log) {
        return AuditLogDto.builder()
                .id(log.getId())
                .actorUsername(log.getActorUsername())
                .action(log.getAction())
                .entityType(log.getEntityType())
                .entityId(log.getEntityId())
                .detail(log.getDetail())
                .occurredAt(log.getOccurredAt())
                .build();
    }
}
