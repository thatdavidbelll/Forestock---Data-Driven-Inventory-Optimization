package com.forestock.forestock_backend.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class StoreDto {
    private UUID id;
    private String name;
    private String slug;
    private Boolean active;
    private LocalDateTime createdAt;
}
