package com.forestock.forestock_backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class RegisterRequest {

    @NotBlank
    @Size(min = 2, max = 255)
    private String storeName;

    /** URL-friendly identifier, e.g. "my-shop". Must be unique across all stores. */
    @NotBlank
    @Size(min = 2, max = 100)
    private String storeSlug;

    @NotBlank
    @Size(min = 3, max = 100)
    private String username;

    @NotBlank
    @Size(min = 8, max = 100)
    private String password;
}
