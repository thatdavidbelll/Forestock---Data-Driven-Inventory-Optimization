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
import com.forestock.forestock_backend.service.TokenBlacklistService;
import com.forestock.forestock_backend.service.EmailVerificationService;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationServiceException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.InternalAuthenticationServiceException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final UserDetailsService userDetailsService;
    private final AppUserRepository userRepository;
    private final JwtService jwtService;
    private final TokenBlacklistService tokenBlacklistService;
    private final EmailVerificationService emailVerificationService;
    private final PasswordResetService passwordResetService;

    /** Authenticates a user and returns access + refresh tokens. */
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(@Valid @RequestBody LoginRequest request) {
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.getUsername(), request.getPassword()));
        } catch (DisabledException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(ApiResponse.error(e.getMessage()));
        } catch (InternalAuthenticationServiceException e) {
            String disabledMessage = extractDisabledMessage(e);
            if (disabledMessage != null) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(ApiResponse.error(disabledMessage));
            }
            log.error("Authentication service unavailable for user '{}': {}", request.getUsername(), e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(ApiResponse.error("Authentication service unavailable. Please try again shortly."));
        } catch (BadCredentialsException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error("Invalid username or password"));
        } catch (AuthenticationServiceException e) {
            String disabledMessage = extractDisabledMessage(e);
            if (disabledMessage != null) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(ApiResponse.error(disabledMessage));
            }
            log.error("Authentication service unavailable for user '{}': {}", request.getUsername(), e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(ApiResponse.error("Authentication service unavailable. Please try again shortly."));
        } catch (AuthenticationException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error(e.getMessage()));
        } catch (Exception e) {
            log.error("Unexpected login failure for user '{}': {}", request.getUsername(), e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(ApiResponse.error("Authentication service unavailable. Please try again shortly."));
        }

        try {
            UserDetails userDetails = userDetailsService.loadUserByUsername(request.getUsername());
            AppUser user = userRepository.findWithStoreByUsername(request.getUsername()).orElseThrow();
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
        } catch (DisabledException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(ApiResponse.error(e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to finalize login for user '{}': {}", request.getUsername(), e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(ApiResponse.error("Authentication service unavailable. Please try again shortly."));
        }
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

            AppUser user = userRepository.findWithStoreByUsername(username).orElseThrow();
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

        } catch (DisabledException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(ApiResponse.error(e.getMessage()));
        } catch (JwtException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error("Invalid token: " + e.getMessage()));
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(HttpServletRequest request) {
        String token = extractBearer(request);
        if (token != null) {
            String jti = jwtService.extractJti(token);
            Duration remaining = jwtService.getRemainingTtl(token);
            tokenBlacklistService.blacklist(jti, remaining);
        }
        return ResponseEntity.ok(ApiResponse.success("Logged out", null));
    }

    @GetMapping("/verify-email")
    public ResponseEntity<ApiResponse<Void>> verifyEmail(@RequestParam String token) {
        try {
            emailVerificationService.verifyEmail(token);
            return ResponseEntity.ok(ApiResponse.success("Email verified successfully.", null));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ApiResponse.error(e.getMessage()));
        }
    }

    @PostMapping("/resend-verification")
    public ResponseEntity<ApiResponse<Void>> resendVerification(@RequestBody Map<String, String> body) {
        emailVerificationService.resendVerification(body);
        return ResponseEntity.ok(ApiResponse.success(
                "If the account exists and still needs verification, a new email has been sent.", null));
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

    private String extractBearer(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return null;
        }
        return authHeader.substring(7);
    }

    private String extractDisabledMessage(Throwable throwable) {
        Throwable current = throwable;
        while (current != null) {
            if (current instanceof DisabledException) {
                return current.getMessage();
            }
            current = current.getCause();
        }
        return null;
    }
}
