package com.forestock.forestock_backend.dto.request;

import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class UpdateUserRequest {

    /**
     * New role for the user.
     * Only ROLE_MANAGER and ROLE_VIEWER are allowed (cannot promote to ADMIN via this endpoint).
     */
    @Pattern(regexp = "ROLE_ADMIN|ROLE_MANAGER|ROLE_VIEWER",
             message = "Role must be ROLE_ADMIN, ROLE_MANAGER or ROLE_VIEWER")
    private String role;

    /** Set to false to deactivate (soft-delete) the user. */
    private Boolean active;
}
