package com.forestock.forestock_backend.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class StandaloneAccessVerificationDto {
    private String email;
    private String username;
    private String storeName;
    private LocalDateTime sentAt;
    private boolean valid;
}
