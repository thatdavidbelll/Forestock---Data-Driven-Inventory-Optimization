package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.domain.AppUser;
import com.forestock.forestock_backend.dto.request.ForgotPasswordRequest;
import com.forestock.forestock_backend.dto.request.ResetPasswordRequest;
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
import java.util.UUID;

/**
 * Handles the forgot-password / reset-password flow.
 *
 * Email sending is best-effort: if mail is not configured, the failure is
 * logged at WARN level so developers can diagnose local setup issues.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PasswordResetService {

    private final AppUserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JavaMailSender mailSender;

    @Value("${forestock.frontend-url:http://localhost:5173}")
    private String frontendUrl;

    @Value("${forestock.mail.from:noreply@forestock.app}")
    private String fromAddress;

    /** Token validity in hours. */
    private static final int TOKEN_EXPIRY_HOURS = 1;

    /**
     * Issues a password-reset token and emails a link to the user.
     * Always returns without revealing whether the email exists (prevents enumeration).
     */
    @Transactional
    public void requestReset(ForgotPasswordRequest request) {
        userRepository.findByEmail(request.getEmail()).ifPresent(user -> {
            String token = UUID.randomUUID().toString();
            user.setPasswordResetToken(token);
            user.setPasswordResetExpiresAt(LocalDateTime.now().plusHours(TOKEN_EXPIRY_HOURS));
            userRepository.save(user);

            String resetLink = frontendUrl + "/reset-password?token=" + token;
            sendResetEmail(user.getEmail(), user.getUsername(), resetLink);
        });
    }

    /**
     * Validates the token and sets the new password.
     *
     * @throws IllegalArgumentException if the token is invalid or expired.
     */
    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        AppUser user = userRepository.findByPasswordResetToken(request.getToken())
                .orElseThrow(() -> new IllegalArgumentException("Invalid or expired reset token."));

        if (user.getPasswordResetExpiresAt() == null ||
                LocalDateTime.now().isAfter(user.getPasswordResetExpiresAt())) {
            throw new IllegalArgumentException("Reset token has expired. Please request a new one.");
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        user.setPasswordResetToken(null);
        user.setPasswordResetExpiresAt(null);
        userRepository.save(user);

        log.info("Password reset successfully for user: {}", user.getUsername());
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private void sendResetEmail(String toEmail, String username, String resetLink) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromAddress);
            message.setTo(toEmail);
            message.setSubject("Forestock — Reset your password");
            message.setText("""
                    Hi %s,

                    You requested a password reset for your Forestock account.
                    Click the link below to set a new password (valid for %d hour):

                    %s

                    If you didn't request this, you can safely ignore this email.

                    — The Forestock Team
                    """.formatted(username, TOKEN_EXPIRY_HOURS, resetLink));
            mailSender.send(message);
            log.info("Password reset email sent to: {}", toEmail);
        } catch (Exception e) {
            // Mail not configured or send failed — log enough detail for diagnosis without exposing the token
            log.warn("Failed to send reset email to {}: {}", toEmail, e.getMessage());
            log.warn("Email error: {}", e.getMessage());
        }
    }
}
