package com.forestock.forestock_backend.dto.request;

import com.forestock.forestock_backend.validation.StrongPassword;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class AcceptInviteRequest {

    @NotBlank
    private String token;

    @NotBlank
    @Size(min = 3, max = 100)
    private String username;

    @NotBlank
    @Size(min = 8, max = 100)
    @StrongPassword
    private String password;
}
