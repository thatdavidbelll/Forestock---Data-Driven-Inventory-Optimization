package com.forestock.forestock_backend.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RequestStandaloneAccessRequest {

    @NotBlank(message = "Email is required")
    @Email(message = "Email must be valid")
    private String email;
}
