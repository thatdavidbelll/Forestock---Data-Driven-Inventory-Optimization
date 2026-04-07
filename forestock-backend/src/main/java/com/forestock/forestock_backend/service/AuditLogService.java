package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.domain.AuditLog;
import com.forestock.forestock_backend.domain.Store;
import com.forestock.forestock_backend.dto.response.AuditLogDto;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.forestock.forestock_backend.repository.AuditLogRepository;
import com.forestock.forestock_backend.repository.StoreRepository;
import com.forestock.forestock_backend.security.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.PrintWriter;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;
    private final StoreRepository storeRepository;
    private final ObjectMapper objectMapper;

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

    @Transactional
    public void logChange(String action, String entityType, String entityId, Object before, Object after, Map<String, Object> extra) {
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("before", before);
        detail.put("after", after);
        if (extra != null) {
            detail.putAll(extra);
        }
        log(action, entityType, entityId, toJson(detail));
    }

    @Transactional(readOnly = true)
    public Page<AuditLogDto> listStoreAuditLogs(String action, String actor, LocalDate from, LocalDate to, Pageable pageable) {
        UUID storeId = TenantContext.getStoreId();
        if (storeId == null) {
            throw new IllegalStateException("No store context");
        }

        LocalDateTime fromDateTime = from != null ? from.atStartOfDay() : null;
        LocalDateTime toDateTime = to != null ? to.plusDays(1).atStartOfDay().minusNanos(1) : null;
        String normalizedAction = normalize(action);
        String normalizedActor = normalize(actor);

        if (normalizedAction == null && normalizedActor == null && fromDateTime == null && toDateTime == null) {
            List<AuditLogDto> content = auditLogRepository.findByStoreIdOrderByOccurredAtDesc(storeId, pageable)
                    .stream()
                    .map(this::toDto)
                    .toList();
            long total = auditLogRepository.countByStoreId(storeId);
            return new PageImpl<>(content, pageable, total);
        }

        String actorPattern = normalizeLikePattern(normalizedActor);
        return auditLogRepository.findByStoreFiltered(storeId, normalizedAction, actorPattern, fromDateTime, toDateTime, pageable)
                .map(this::toDto);
    }

    @Transactional(readOnly = true)
    public byte[] exportStoreAuditLogsCsv(String action, String actor, LocalDate from, LocalDate to) {
        UUID storeId = TenantContext.getStoreId();
        if (storeId == null) {
            throw new IllegalStateException("No store context");
        }

        LocalDateTime fromDateTime = from != null ? from.atStartOfDay() : null;
        LocalDateTime toDateTime = to != null ? to.plusDays(1).atStartOfDay().minusNanos(1) : null;
        String actorPattern = normalizeLikePattern(actor);
        List<AuditLog> logs = auditLogRepository.findAllByStoreFiltered(storeId, normalize(action), actorPattern, fromDateTime, toDateTime);

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        PrintWriter writer = new PrintWriter(out);
        writer.println("occurred_at,actor,action,entity_type,entity_id,detail");
        for (AuditLog log : logs) {
            writer.println(csv(
                    log.getOccurredAt(),
                    log.getActorUsername(),
                    log.getAction(),
                    log.getEntityType(),
                    log.getEntityId(),
                    log.getDetail()
            ));
        }
        writer.flush();
        return out.toByteArray();
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

    private String normalizeLikePattern(String value) {
        String normalized = normalize(value);
        return normalized == null ? null : "%" + normalized.toLowerCase() + "%";
    }

    private String toJson(Object detail) {
        try {
            return objectMapper.writeValueAsString(detail);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize audit detail", e);
        }
    }

    private String csv(Object... values) {
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < values.length; i++) {
            if (i > 0) builder.append(',');
            String value = values[i] == null ? "" : values[i].toString();
            builder.append('"').append(value.replace("\"", "\"\"")).append('"');
        }
        return builder.toString();
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
