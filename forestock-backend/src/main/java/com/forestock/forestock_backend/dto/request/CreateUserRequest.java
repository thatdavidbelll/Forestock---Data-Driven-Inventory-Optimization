package com.forestock.forestock_backend.dto.request;

import com.forestock.forestock_backend.validation.StrongPassword;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateUserRequest {

    @NotBlank
    @Size(min = 3, max = 100)
    private String username;

    @NotBlank
    @Size(min = 8, max = 100)
    @StrongPassword
    private String password;

    /** Allowed roles for store-level users: ROLE_MANAGER or ROLE_VIEWER. */
    @NotBlank
    @Pattern(regexp = "ROLE_MANAGER|ROLE_VIEWER",
             message = "Role must be ROLE_MANAGER or ROLE_VIEWER")
    private String role;

    @Size(max = 255)
    private String email;
}
