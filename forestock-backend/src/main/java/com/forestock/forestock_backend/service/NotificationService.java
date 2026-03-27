package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.domain.ForecastRun;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.sns.SnsClient;
import software.amazon.awssdk.services.sns.model.PublishRequest;

/**
 * Sends email notifications via AWS SNS when a forecast run completes.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final SnsClient snsClient;

    @Value("${aws.sns.topic-arn:}")
    private String topicArn;

    @Value("${forestock.notifications.alert-email}")
    private String alertEmail;

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
}
