package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.domain.AppUser;
import com.forestock.forestock_backend.domain.Store;
import com.forestock.forestock_backend.dto.request.ActivateStandaloneAccessRequest;
import com.forestock.forestock_backend.dto.request.RequestStandaloneAccessRequest;
import com.forestock.forestock_backend.repository.AppUserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StandaloneAccessServiceTest {

    @Mock
    private AppUserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JavaMailSender mailSender;

    @InjectMocks
    private StandaloneAccessService standaloneAccessService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(standaloneAccessService, "frontendUrl", "http://localhost:5173");
        ReflectionTestUtils.setField(standaloneAccessService, "fromAddress", "noreply@forestock.app");
    }

    @Test
    void requestStandaloneAccess_generatesTokenForEligibleShopifyUser() {
        AppUser user = AppUser.builder()
                .id(UUID.randomUUID())
                .username("shopify-admin")
                .email("merchant@example.com")
                .passwordHash("hash")
                .role("ROLE_ADMIN")
                .provisioningSource("SHOPIFY")
                .standaloneAccessEnabled(false)
                .emailVerified(true)
                .active(true)
                .build();

        when(userRepository.findByEmail("merchant@example.com")).thenReturn(Optional.of(user));
        when(userRepository.save(any(AppUser.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RequestStandaloneAccessRequest request = new RequestStandaloneAccessRequest();
        request.setEmail("merchant@example.com");

        standaloneAccessService.requestStandaloneAccess(request);

        ArgumentCaptor<AppUser> captor = ArgumentCaptor.forClass(AppUser.class);
        verify(userRepository).save(captor.capture());
        AppUser saved = captor.getValue();
        assertThat(saved.getStandaloneActivationToken()).isNotBlank();
        assertThat(saved.getStandaloneActivationSentAt()).isNotNull();
    }

    @Test
    void activateStandaloneAccess_enablesAndSetsPassword() {
        Store store = Store.builder().id(UUID.randomUUID()).name("Merchant Store").slug("merchant-store").active(true).build();
        AppUser user = AppUser.builder()
                .id(UUID.randomUUID())
                .username("shopify-admin")
                .email("merchant@example.com")
                .passwordHash("old-hash")
                .role("ROLE_ADMIN")
                .store(store)
                .provisioningSource("SHOPIFY")
                .standaloneAccessEnabled(false)
                .standaloneActivationToken("token-123")
                .standaloneActivationSentAt(LocalDateTime.now())
                .emailVerified(false)
                .active(true)
                .build();

        when(userRepository.findByStandaloneActivationToken("token-123")).thenReturn(Optional.of(user));
        when(passwordEncoder.encode("NewPassword123!")).thenReturn("encoded");
        when(userRepository.save(any(AppUser.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ActivateStandaloneAccessRequest request = new ActivateStandaloneAccessRequest();
        request.setToken("token-123");
        request.setNewPassword("NewPassword123!");

        standaloneAccessService.activateStandaloneAccess(request);

        assertThat(user.getStandaloneAccessEnabled()).isTrue();
        assertThat(user.getStandaloneAccessActivatedAt()).isNotNull();
        assertThat(user.getStandaloneActivationToken()).isNull();
        assertThat(user.getStandaloneActivationSentAt()).isNull();
        assertThat(user.getPasswordHash()).isEqualTo("encoded");
        assertThat(user.getEmailVerified()).isTrue();
    }

    @Test
    void verifyStandaloneAccess_rejectsExpiredToken() {
        AppUser user = AppUser.builder()
                .id(UUID.randomUUID())
                .username("shopify-admin")
                .email("merchant@example.com")
                .passwordHash("hash")
                .role("ROLE_ADMIN")
                .provisioningSource("SHOPIFY")
                .standaloneAccessEnabled(false)
                .standaloneActivationToken("expired-token")
                .standaloneActivationSentAt(LocalDateTime.now().minusHours(49))
                .active(true)
                .build();

        when(userRepository.findByStandaloneActivationToken("expired-token")).thenReturn(Optional.of(user));

        assertThrows(IllegalArgumentException.class,
                () -> standaloneAccessService.verifyStandaloneAccess("expired-token"));
        verify(userRepository, never()).save(any());
    }
}
