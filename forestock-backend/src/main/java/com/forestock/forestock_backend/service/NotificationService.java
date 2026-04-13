package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.domain.AppUser;
import com.forestock.forestock_backend.domain.ForecastRun;
import com.forestock.forestock_backend.domain.Store;
import com.forestock.forestock_backend.repository.AppUserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.sns.SnsClient;
import software.amazon.awssdk.services.sns.model.PublishRequest;

import java.util.List;

/**
 * Sends email notifications via AWS SNS when a forecast run completes.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final SnsClient snsClient;
    private final JavaMailSender mailSender;
    private final AppUserRepository appUserRepository;

    @Value("${aws.sns.topic-arn:}")
    private String topicArn;

    @Value("${forestock.notifications.alert-email}")
    private String alertEmail;

    @Value("${forestock.frontend-url:http://localhost:5173}")
    private String frontendUrl;

    @Value("${forestock.mail.from:noreply@forestock.app}")
    private String fromAddress;

    public void sendForecastComplete(ForecastRun run, long criticalCount) {
        if (topicArn == null || topicArn.isBlank()) {
            log.info("SNS topic ARN not configured — skipping notification");
            return;
        }

        String subject = criticalCount > 0
                ? "[Forestock] Forecast complete — " + criticalCount + " CRITICAL products"
                : "[Forestock] Forecast complete";

        String message = String.format("""
                Forestock — Forecast run completed

                Run ID:              %s
                Products processed:  %d
                CRITICAL suggestions:%d
                Duration:            %s → %s

                Open the dashboard to review all suggestions.
                """,
                run.getId(),
                run.getProductsProcessed(),
                criticalCount,
                run.getStartedAt(),
                run.getFinishedAt());

        try {
            snsClient.publish(PublishRequest.builder()
                    .topicArn(topicArn)
                    .subject(subject)
                    .message(message)
                    .build());
            log.info("Notification sent to SNS topic for run {}", run.getId());
        } catch (Exception e) {
            log.warn("Failed to send SNS notification: {}", e.getMessage());
            // Non-fatal
        }
    }

    public void sendForecastFailed(ForecastRun run) {
        if (topicArn == null || topicArn.isBlank()) return;

        try {
            snsClient.publish(PublishRequest.builder()
                    .topicArn(topicArn)
                    .subject("[Forestock] ERROR — Forecast job failed")
                    .message("Run ID: " + run.getId() + "\nError: " + run.getErrorMessage())
                    .build());
        } catch (Exception e) {
            log.warn("Failed to send failure notification: {}", e.getMessage());
        }
    }

    public void sendMerchantDigest(Store store, long criticalCount, long highCount) {
        if (criticalCount == 0 && highCount == 0) return;
        List<AppUser> admins = appUserRepository.findByStoreIdAndRoleAndActiveTrue(
                store.getId(), "ROLE_ADMIN");
        for (AppUser admin : admins) {
            if (admin.getEmail() == null || admin.getEmail().isBlank()) continue;
            try {
                SimpleMailMessage msg = new SimpleMailMessage();
                msg.setFrom(fromAddress);
                msg.setTo(admin.getEmail());
                msg.setSubject(String.format("[Forestock] %d CRITICAL, %d HIGH alerts — %s",
                        criticalCount, highCount, store.getName()));
                msg.setText(String.format("""
                        Hi,

                        Your latest Forestock forecast is ready.

                        CRITICAL (reorder urgently): %d products
                        HIGH (reorder soon):         %d products

                        Review your recommendations:
                        %s/suggestions

                        — Forestock
                        """, criticalCount, highCount, frontendUrl));
                mailSender.send(msg);
                log.info("Digest email sent to {} for store {}", admin.getEmail(), store.getName());
            } catch (Exception e) {
                log.warn("Failed to send digest to {}: {}", admin.getEmail(), e.getMessage());
            }
        }
    }
}
