package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.domain.AppUser;
import com.forestock.forestock_backend.repository.AppUserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailVerificationService {

    private static final int TOKEN_EXPIRY_HOURS = 48;

    private final AppUserRepository userRepository;
    private final JavaMailSender mailSender;

    @Value("${forestock.frontend-url:http://localhost:5173}")
    private String frontendUrl;

    @Value("${forestock.mail.from:noreply@forestock.app}")
    private String fromAddress;

    @Transactional
    public void sendVerificationEmail(AppUser user) {
        if (user.getEmail() == null || user.getEmail().isBlank()) {
            log.warn("Skipping verification email for user '{}' because no email is set", user.getUsername());
            return;
        }

        String token = UUID.randomUUID().toString();
        user.setEmailVerified(false);
        user.setEmailVerificationToken(token);
        user.setEmailVerificationSentAt(LocalDateTime.now());
        userRepository.save(user);

        String verificationLink = frontendUrl + "/verify-email?token=" + token;
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromAddress);
            message.setTo(user.getEmail());
            message.setSubject("Forestock — Verify your email");
            message.setText("""
                    Hi %s,

                    Verify your Forestock account by clicking the link below within %d hours:

                    %s

                    If you didn't expect this email, you can ignore it.

                    — The Forestock Team
                    """.formatted(user.getUsername(), TOKEN_EXPIRY_HOURS, verificationLink));
            mailSender.send(message);
            log.info("Verification email sent to: {}", user.getEmail());
        } catch (Exception e) {
            log.warn("Failed to send verification email to {}. Verification link (DEV ONLY): {}", user.getEmail(), verificationLink);
            log.warn("Email error: {}", e.getMessage());
        }
    }

    @Transactional
    public void verifyEmail(String token) {
        AppUser user = userRepository.findByEmailVerificationToken(token)
                .orElseThrow(() -> new IllegalArgumentException("Invalid or expired verification link."));

        if (user.getEmailVerificationSentAt() == null ||
                LocalDateTime.now().isAfter(user.getEmailVerificationSentAt().plusHours(TOKEN_EXPIRY_HOURS))) {
            throw new IllegalArgumentException("Verification link has expired. Please request a new one.");
        }

        user.setEmailVerified(true);
        user.setEmailVerificationToken(null);
        user.setEmailVerificationSentAt(null);
        userRepository.save(user);
        log.info("Email verified for user: {}", user.getUsername());
    }

    @Transactional
    public void resendVerification(Map<String, String> body) {
        String username = valueOrNull(body.get("username"));
        String email = valueOrNull(body.get("email"));

        AppUser user = null;
        if (username != null) {
            user = userRepository.findByUsername(username).orElse(null);
        }
        if (user == null && email != null) {
            user = userRepository.findByEmail(email).orElse(null);
        }

        if (user == null || user.getEmail() == null || Boolean.TRUE.equals(user.getEmailVerified())) {
            return;
        }

        sendVerificationEmail(user);
    }

    private String valueOrNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
