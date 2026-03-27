package com.forestock.forestock_backend.dto.response;

import com.forestock.forestock_backend.domain.enums.ForecastStatus;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class ForecastRunDto {
    private UUID id;
    private ForecastStatus status;
    private LocalDateTime startedAt;
    private LocalDateTime finishedAt;
    private Integer horizonDays;
    private String triggeredBy;
    private String errorMessage;
    private Long durationSeconds;
}
