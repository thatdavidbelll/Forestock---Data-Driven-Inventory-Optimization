package com.forestock.forestock_backend.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class UserDto {
    private UUID id;
    private String username;
    private String email;
    private String role;
    private Boolean active;
    private LocalDateTime createdAt;
}
