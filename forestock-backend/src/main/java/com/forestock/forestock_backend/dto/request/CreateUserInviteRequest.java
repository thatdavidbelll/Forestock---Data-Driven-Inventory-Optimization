package com.forestock.forestock_backend.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateUserInviteRequest {

    @NotBlank
    @Email
    @Size(max = 255)
    private String email;

    @NotBlank
    @Pattern(regexp = "ROLE_MANAGER|ROLE_VIEWER",
            message = "Role must be ROLE_MANAGER or ROLE_VIEWER")
    private String role;
}
