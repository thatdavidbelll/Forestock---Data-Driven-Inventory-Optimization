package com.forestock.forestock_backend.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Builder
public class AuditLogDto {

    private UUID id;
    private String actorUsername;
    private String action;
    private String entityType;
    private String entityId;
    private String detail;
    private LocalDateTime occurredAt;
}
