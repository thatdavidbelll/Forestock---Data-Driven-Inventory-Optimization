package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.config.ShopifyProperties;
import com.forestock.forestock_backend.repository.ShopifyConnectionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ShopifyHmacServiceTest {

    @Mock
    private ShopifyConnectionRepository connectionRepository;

    private ShopifyProperties properties;
    private ShopifyHmacService hmacService;

    private static final String SECRET = "test-webhook-secret";

    @BeforeEach
    void setUp() {
        properties = new ShopifyProperties();
        properties.setWebhookSecret(SECRET);
        hmacService = new ShopifyHmacService(properties, connectionRepository);
    }

    @Test
    void validHmac_returnsTrue() throws Exception {
        String body = "{\"id\":123,\"name\":\"#1001\"}";
        String hmac = computeHmac(body, SECRET);

        when(connectionRepository.findByShopDomainAndActiveTrue("test.myshopify.com"))
                .thenReturn(Optional.empty());

        assertThat(hmacService.verifyHmac(
                body.getBytes(StandardCharsets.UTF_8), hmac, "test.myshopify.com")).isTrue();
    }

    @Test
    void invalidHmac_returnsFalse() {
        String body = "{\"id\":123}";

        when(connectionRepository.findByShopDomainAndActiveTrue("test.myshopify.com"))
                .thenReturn(Optional.empty());

        assertThat(hmacService.verifyHmac(
                body.getBytes(StandardCharsets.UTF_8), "wrong-hmac", "test.myshopify.com")).isFalse();
    }

    @Test
    void nullHmacHeader_returnsFalse() {
        assertThat(hmacService.verifyHmac("body".getBytes(StandardCharsets.UTF_8), null, "shop.myshopify.com")).isFalse();
    }

    @Test
    void emptySecret_returnsFalse() {
        properties.setWebhookSecret("");

        when(connectionRepository.findByShopDomainAndActiveTrue("test.myshopify.com"))
                .thenReturn(Optional.empty());

        assertThat(hmacService.verifyHmac(
                "body".getBytes(StandardCharsets.UTF_8), "hmac", "test.myshopify.com")).isFalse();
    }

    private String computeHmac(String body, String secret) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return Base64.getEncoder().encodeToString(mac.doFinal(body.getBytes(StandardCharsets.UTF_8)));
    }
}

