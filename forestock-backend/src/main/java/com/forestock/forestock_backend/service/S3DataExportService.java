package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.domain.SalesTransaction;
import com.forestock.forestock_backend.service.ForecastingEngine.ForecastResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Uploads sales data backup and forecast results to S3 for audit trail.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class S3DataExportService {

    private final S3Client s3Client;

    @Value("${aws.s3.bucket-name}")
    private String bucketName;

    @Value("${aws.s3.input-prefix}")
    private String inputPrefix;

    @Value("${aws.s3.reports-prefix}")
    private String reportsPrefix;

    /**
     * Backs up raw sales transactions to S3 input/{runId}/sales.csv
     */
    public void backupSalesData(List<SalesTransaction> sales, UUID forecastRunId) {
        StringBuilder csv = new StringBuilder("sku,sale_date,quantity_sold\n");
        for (SalesTransaction s : sales) {
            csv.append(s.getProduct().getSku()).append(",")
               .append(s.getSaleDate()).append(",")
               .append(s.getQuantitySold()).append("\n");
        }

        String key = inputPrefix + forecastRunId + "/sales.csv";
        upload(key, csv.toString(), "text/csv");
        log.info("Backed up {} sales records to s3://{}/{}", sales.size(), bucketName, key);
    }

    /**
     * Uploads forecast results to S3 reports/{runId}/forecast.json
     */
    public void uploadForecastResults(Map<UUID, ForecastResult> results, Map<UUID, String> forecastModels, UUID forecastRunId) {
        StringBuilder json = new StringBuilder("{\n  \"forecastRunId\": \"").append(forecastRunId).append("\",\n");
        json.append("  \"results\": [\n");

        boolean first = true;
        for (Map.Entry<UUID, ForecastResult> entry : results.entrySet()) {
            if (!first) json.append(",\n");
            ForecastResult r = entry.getValue();
            json.append("    {\"productId\": \"").append(entry.getKey()).append("\"")
                .append(", \"model\": \"").append(forecastModels.getOrDefault(entry.getKey(), "UNKNOWN")).append("\"")
                .append(", \"p50Total\": ").append(String.format("%.2f", r.p50Total()))
                .append(", \"p90Total\": ").append(String.format("%.2f", r.p90Total()))
                .append("}");
            first = false;
        }
        json.append("\n  ]\n}");

        String key = reportsPrefix + forecastRunId + "/forecast.json";
        upload(key, json.toString(), "application/json");
        log.info("Uploaded forecast results for {} products to s3://{}/{}", results.size(), bucketName, key);
    }

    private void upload(String key, String content, String contentType) {
        try {
            byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
            s3Client.putObject(
                    PutObjectRequest.builder()
                            .bucket(bucketName)
                            .key(key)
                            .contentType(contentType)
                            .contentLength((long) bytes.length)
                            .build(),
                    RequestBody.fromBytes(bytes));
        } catch (Exception e) {
            log.warn("S3 upload failed for key {}: {}", key, e.getMessage());
            // Non-fatal — a backup failure does not abort the forecast cycle
        }
    }
}
