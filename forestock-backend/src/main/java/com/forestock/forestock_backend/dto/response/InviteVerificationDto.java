package com.forestock.forestock_backend.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class InviteVerificationDto {
    private String email;
    private String role;
    private String storeName;
    private LocalDateTime expiresAt;
    private boolean valid;
}
