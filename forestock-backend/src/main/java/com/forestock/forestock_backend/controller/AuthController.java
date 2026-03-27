package com.forestock.forestock_backend.controller;

import com.forestock.forestock_backend.domain.AppUser;
import com.forestock.forestock_backend.dto.request.ForgotPasswordRequest;
import com.forestock.forestock_backend.dto.request.LoginRequest;
import com.forestock.forestock_backend.dto.request.ResetPasswordRequest;
import java.util.UUID;
import com.forestock.forestock_backend.dto.response.ApiResponse;
import com.forestock.forestock_backend.dto.response.AuthResponse;
import com.forestock.forestock_backend.repository.AppUserRepository;
import com.forestock.forestock_backend.service.JwtService;
import com.forestock.forestock_backend.service.PasswordResetService;
import io.jsonwebtoken.JwtException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final UserDetailsService userDetailsService;
    private final AppUserRepository userRepository;
    private final JwtService jwtService;
    private final PasswordResetService passwordResetService;

    /** Authenticates a user and returns access + refresh tokens. */
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(@Valid @RequestBody LoginRequest request) {
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.getUsername(), request.getPassword()));
        } catch (BadCredentialsException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error("Invalid username or password"));
        }

        UserDetails userDetails = userDetailsService.loadUserByUsername(request.getUsername());
        AppUser user = userRepository.findByUsername(request.getUsername()).orElseThrow();
        String role = user.getRole();
        UUID storeId = user.getStore() != null ? user.getStore().getId() : null;

        String accessToken = jwtService.generateAccessToken(userDetails, role, storeId);
        String refreshToken = jwtService.generateRefreshToken(userDetails, role, storeId);

        return ResponseEntity.ok(ApiResponse.success(AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .tokenType("Bearer")
                .expiresInSeconds(8 * 3600L)
                .username(user.getUsername())
                .role(role)
                .build()));
    }

    /** Issues a new access token given a valid refresh token. */
    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<AuthResponse>> refresh(
            @RequestHeader("Authorization") String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error("Missing or malformed Authorization header"));
        }

        String refreshToken = authHeader.substring(7);
        try {
            if (!jwtService.isRefreshToken(refreshToken)) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(ApiResponse.error("Token is not a refresh token"));
            }

            String username = jwtService.extractUsername(refreshToken);
            UserDetails userDetails = userDetailsService.loadUserByUsername(username);

            if (!jwtService.isTokenValid(refreshToken, userDetails)) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(ApiResponse.error("Refresh token is expired or invalid"));
            }

            AppUser user = userRepository.findByUsername(username).orElseThrow();
            UUID storeIdForRefresh = user.getStore() != null ? user.getStore().getId() : null;
            String newAccessToken = jwtService.generateAccessToken(userDetails, user.getRole(), storeIdForRefresh);

            return ResponseEntity.ok(ApiResponse.success(AuthResponse.builder()
                    .accessToken(newAccessToken)
                    .refreshToken(refreshToken)
                    .tokenType("Bearer")
                    .expiresInSeconds(8 * 3600L)
                    .username(username)
                    .role(user.getRole())
                    .build()));

        } catch (JwtException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error("Invalid token: " + e.getMessage()));
        }
    }

    /**
     * Sends a password-reset link to the user's email.
     * Always returns 200 to prevent email enumeration.
     */
    @PostMapping("/forgot-password")
    public ResponseEntity<ApiResponse<Void>> forgotPassword(
            @Valid @RequestBody ForgotPasswordRequest request) {
        passwordResetService.requestReset(request);
        return ResponseEntity.ok(ApiResponse.success(
                "If an account with that email exists, a reset link has been sent.", null));
    }

    /**
     * Resets the password using a valid reset token.
     */
    @PostMapping("/reset-password")
    public ResponseEntity<ApiResponse<Void>> resetPassword(
            @Valid @RequestBody ResetPasswordRequest request) {
        try {
            passwordResetService.resetPassword(request);
            return ResponseEntity.ok(ApiResponse.success("Password reset successfully.", null));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ApiResponse.error(e.getMessage()));
        }
    }
}
