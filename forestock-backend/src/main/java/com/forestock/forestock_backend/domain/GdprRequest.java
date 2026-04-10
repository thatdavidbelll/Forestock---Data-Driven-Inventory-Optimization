package com.forestock.forestock_backend.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "gdpr_requests")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GdprRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "shop_domain", nullable = false, length = 255)
    private String shopDomain;

    @Column(name = "webhook_topic", nullable = false, length = 100)
    private String webhookTopic;

    @Column(name = "shopify_customer_id")
    private Long shopifyCustomerId;

    @Column(name = "customer_email", length = 255)
    private String customerEmail;

    @Column(name = "received_at", nullable = false)
    private LocalDateTime receivedAt;
}
