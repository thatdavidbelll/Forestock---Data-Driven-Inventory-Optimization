package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.config.ShopifyProperties;
import com.forestock.forestock_backend.domain.ShopifyConnection;
import com.forestock.forestock_backend.repository.ShopifyConnectionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;

@Slf4j
@Service
@RequiredArgsConstructor
public class ShopifyHmacService {

    private final ShopifyProperties shopifyProperties;
    private final ShopifyConnectionRepository connectionRepository;

    public boolean verifyHmac(byte[] rawBody, String hmacHeader, String shopDomain) {
        if (hmacHeader == null || hmacHeader.isBlank()) {
            log.warn("Missing X-Shopify-Hmac-Sha256 header");
            return false;
        }

        String secret = resolveSecret(shopDomain);
        if (secret == null || secret.isBlank()) {
            log.error("No Shopify webhook secret configured for domain: {}", shopDomain);
            return false;
        }

        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec keySpec = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            mac.init(keySpec);
            byte[] computedHash = mac.doFinal(rawBody);
            String computedBase64 = Base64.getEncoder().encodeToString(computedHash);

            return MessageDigest.isEqual(
                    computedBase64.getBytes(StandardCharsets.UTF_8),
                    hmacHeader.getBytes(StandardCharsets.UTF_8)
            );
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            log.error("HMAC verification failed due to crypto error", e);
            return false;
        }
    }

    private String resolveSecret(String shopDomain) {
        if (shopDomain != null && !shopDomain.isBlank()) {
            return connectionRepository.findByShopDomainAndActiveTrue(shopDomain)
                    .map(ShopifyConnection::getWebhookSecret)
                    .filter(secret -> secret != null && !secret.isBlank())
                    .orElse(shopifyProperties.getWebhookSecret());
        }
        return shopifyProperties.getWebhookSecret();
    }
}

