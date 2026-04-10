package com.forestock.forestock_backend.dto.request;

import com.forestock.forestock_backend.validation.StrongPassword;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ActivateStandaloneAccessRequest {

    @NotBlank(message = "Activation token is required")
    private String token;

    @NotBlank(message = "New password is required")
    @Size(min = 8, message = "Password must be at least 8 characters")
    @StrongPassword
    private String newPassword;
}
