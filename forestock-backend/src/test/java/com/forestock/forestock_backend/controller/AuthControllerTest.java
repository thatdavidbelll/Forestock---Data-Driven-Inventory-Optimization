package com.forestock.forestock_backend.controller;

import com.forestock.forestock_backend.domain.AppUser;
import com.forestock.forestock_backend.dto.response.ApiResponse;
import com.forestock.forestock_backend.dto.response.AuthResponse;
import com.forestock.forestock_backend.repository.AppUserRepository;
import com.forestock.forestock_backend.service.EmailVerificationService;
import com.forestock.forestock_backend.service.JwtService;
import com.forestock.forestock_backend.service.PasswordResetService;
import com.forestock.forestock_backend.service.StandaloneAccessService;
import com.forestock.forestock_backend.service.TokenBlacklistService;
import com.forestock.forestock_backend.service.UserInviteService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;

import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class AuthControllerTest {

    private JwtService jwtService;
    private TokenBlacklistService tokenBlacklistService;
    private UserDetailsService userDetailsService;
    private AppUserRepository userRepository;
    private AuthController authController;

    @BeforeEach
    void setUp() {
        AuthenticationManager authenticationManager = mock(AuthenticationManager.class);
        userDetailsService = mock(UserDetailsService.class);
        userRepository = mock(AppUserRepository.class);
        jwtService = mock(JwtService.class);
        tokenBlacklistService = mock(TokenBlacklistService.class);
        EmailVerificationService emailVerificationService = mock(EmailVerificationService.class);
        PasswordResetService passwordResetService = mock(PasswordResetService.class);
        UserInviteService userInviteService = mock(UserInviteService.class);
        StandaloneAccessService standaloneAccessService = mock(StandaloneAccessService.class);

        authController = new AuthController(
                authenticationManager,
                userDetailsService,
                userRepository,
                jwtService,
                tokenBlacklistService,
                emailVerificationService,
                passwordResetService,
                userInviteService,
                standaloneAccessService
        );
    }

    @Test
    void logout_blacklistsAccessAndRefreshTokens() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer access-token");

        when(jwtService.extractJti("access-token")).thenReturn("access-jti");
        when(jwtService.getRemainingTtl("access-token")).thenReturn(Duration.ofMinutes(10));
        when(jwtService.isRefreshToken("refresh-token")).thenReturn(true);
        when(jwtService.extractJti("refresh-token")).thenReturn("refresh-jti");
        when(jwtService.getRemainingTtl("refresh-token")).thenReturn(Duration.ofDays(5));

        ResponseEntity<ApiResponse<Void>> response = authController.logout(request, Map.of("refreshToken", "refresh-token"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(tokenBlacklistService).blacklist("access-jti", Duration.ofMinutes(10));
        verify(tokenBlacklistService).blacklist("refresh-jti", Duration.ofDays(5));
    }

    @Test
    void refresh_returnsUnauthorized_whenRefreshTokenIsBlacklisted() {
        UserDetails userDetails = User.withUsername("merchant").password("pw").authorities("ROLE_ADMIN").build();

        when(jwtService.isRefreshToken("refresh-token")).thenReturn(true);
        when(jwtService.extractUsername("refresh-token")).thenReturn("merchant");
        when(userDetailsService.loadUserByUsername("merchant")).thenReturn(userDetails);
        when(jwtService.isTokenValid("refresh-token", userDetails)).thenReturn(true);
        when(jwtService.extractJti("refresh-token")).thenReturn("refresh-jti");
        when(tokenBlacklistService.isBlacklisted("refresh-jti")).thenReturn(true);

        ResponseEntity<ApiResponse<AuthResponse>> response = authController.refresh("Bearer refresh-token");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getMessage()).isEqualTo("Refresh token has been revoked");
        verifyNoInteractions(userRepository);
    }
}
