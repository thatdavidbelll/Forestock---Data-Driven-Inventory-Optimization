package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.domain.AppUser;
import com.forestock.forestock_backend.dto.request.ActivateStandaloneAccessRequest;
import com.forestock.forestock_backend.dto.request.RequestStandaloneAccessRequest;
import com.forestock.forestock_backend.dto.response.StandaloneAccessVerificationDto;
import com.forestock.forestock_backend.repository.AppUserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Locale;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class StandaloneAccessService {

    private static final int TOKEN_EXPIRY_HOURS = 48;

    private final AppUserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JavaMailSender mailSender;

    @Value("${forestock.frontend-url:http://localhost:5173}")
    private String frontendUrl;

    @Value("${forestock.mail.from:noreply@forestock.app}")
    private String fromAddress;

    @Transactional
    public void requestStandaloneAccess(RequestStandaloneAccessRequest request) {
        String normalizedEmail = request.getEmail().trim().toLowerCase(Locale.ROOT);
        AppUser user = userRepository.findByEmail(normalizedEmail).orElse(null);
        if (user == null) {
            return;
        }
        if (!"SHOPIFY".equalsIgnoreCase(user.getProvisioningSource())) {
            return;
        }
        if (Boolean.TRUE.equals(user.getStandaloneAccessEnabled())
                && user.getStandaloneAccessActivatedAt() != null) {
            return;
        }

        user.setStandaloneActivationToken(UUID.randomUUID().toString());
        user.setStandaloneActivationSentAt(LocalDateTime.now());
        userRepository.save(user);
        sendStandaloneAccessEmail(user);
    }

    @Transactional(readOnly = true)
    public StandaloneAccessVerificationDto verifyStandaloneAccess(String token) {
        AppUser user = loadActivatableUser(token);
        return StandaloneAccessVerificationDto.builder()
                .email(user.getEmail())
                .username(user.getUsername())
                .storeName(user.getStore() != null ? user.getStore().getName() : null)
                .sentAt(user.getStandaloneActivationSentAt())
                .valid(true)
                .build();
    }

    @Transactional
    public void activateStandaloneAccess(ActivateStandaloneAccessRequest request) {
        AppUser user = loadActivatableUser(request.getToken());
        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        user.setStandaloneAccessEnabled(true);
        user.setStandaloneAccessActivatedAt(LocalDateTime.now());
        user.setStandaloneActivationToken(null);
        user.setStandaloneActivationSentAt(null);
        if (user.getEmail() != null && !user.getEmail().isBlank()) {
            user.setEmailVerified(true);
        }
        userRepository.save(user);
    }

    private AppUser loadActivatableUser(String token) {
        AppUser user = userRepository.findByStandaloneActivationToken(token)
                .orElseThrow(() -> new IllegalArgumentException("Invalid standalone access link."));

        if (!"SHOPIFY".equalsIgnoreCase(user.getProvisioningSource())) {
            throw new IllegalArgumentException("Standalone access activation is not available for this account.");
        }
        if (user.getStandaloneActivationSentAt() == null || LocalDateTime.now().isAfter(user.getStandaloneActivationSentAt().plusHours(TOKEN_EXPIRY_HOURS))) {
            throw new IllegalArgumentException("Standalone access link has expired. Please request a new one.");
        }
        return user;
    }

    private void sendStandaloneAccessEmail(AppUser user) {
        if (user.getEmail() == null || user.getEmail().isBlank()) {
            return;
        }

        String activationLink = frontendUrl + "/activate-standalone-access?token=" + user.getStandaloneActivationToken();
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromAddress);
            message.setTo(user.getEmail());
            message.setSubject("Forestock — Enable web access");
            message.setText("""
                    Hi %s,

                    Your Shopify store is already linked to Forestock.
                    If you also want standalone Forestock web access, set your password here within %d hours:

                    %s

                    If you only plan to use Forestock through Shopify, you can ignore this email.

                    — The Forestock Team
                    """.formatted(user.getUsername(), TOKEN_EXPIRY_HOURS, activationLink));
            mailSender.send(message);
            log.info("Standalone access email sent to: {}", user.getEmail());
        } catch (Exception e) {
            log.warn("Failed to send standalone access email to {}. Activation link (DEV ONLY): {}", user.getEmail(), activationLink);
            log.warn("Email error: {}", e.getMessage());
        }
    }
}
