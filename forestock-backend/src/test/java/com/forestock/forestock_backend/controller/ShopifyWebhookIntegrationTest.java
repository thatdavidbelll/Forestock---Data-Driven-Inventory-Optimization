package com.forestock.forestock_backend.controller;

import com.forestock.forestock_backend.config.ShopifyProperties;
import com.forestock.forestock_backend.config.ShopifyWebhookFilter;
import com.forestock.forestock_backend.service.ShopifyHmacService;
import com.forestock.forestock_backend.service.ShopifyIngestionResult;
import com.forestock.forestock_backend.service.ShopifyOrderIngestionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ShopifyWebhookIntegrationTest {

    private static final String WEBHOOK_SECRET = "dev-test-secret";

    private MockMvc mockMvc;
    private ShopifyOrderIngestionService ingestionService;

    @BeforeEach
    void setUp() {
        ShopifyProperties properties = new ShopifyProperties();
        properties.setEnabled(true);
        properties.setWebhookSecret(WEBHOOK_SECRET);

        ShopifyHmacService hmacService = mock(ShopifyHmacService.class);
        ingestionService = mock(ShopifyOrderIngestionService.class);

        when(hmacService.verifyHmac(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.any()))
                .thenReturn(true);
        when(hmacService.verifyHmac(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.eq("invalid-hmac"), org.mockito.ArgumentMatchers.any()))
                .thenReturn(false);

        mockMvc = MockMvcBuilders.standaloneSetup(new ShopifyWebhookController(ingestionService))
                .addFilters(new ShopifyWebhookFilter(hmacService, properties))
                .build();
    }

    @Test
    void webhook_withValidHmac_returns200() throws Exception {
        String body = """
                {"id":12345,"name":"#1001","created_at":"2026-04-06T10:00:00+00:00",
                 "financial_status":"paid","total_price":"10.00","currency":"GBP",
                 "line_items":[{"id":1,"sku":"SKU-1","title":"Test","quantity":1,"price":"10.00"}]}
                """;
        String hmac = computeHmac(body, WEBHOOK_SECRET);

        when(ingestionService.processOrder("test.myshopify.com", body))
                .thenReturn(ShopifyIngestionResult.duplicate(12345L));

        mockMvc.perform(post("/api/webhooks/shopify/orders")
                        .contentType(APPLICATION_JSON)
                        .content(body)
                        .header("X-Shopify-Hmac-Sha256", hmac)
                        .header("X-Shopify-Shop-Domain", "test.myshopify.com")
                        .header("X-Shopify-Topic", "orders/create"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Order already processed"));
    }

    @Test
    void webhook_withInvalidHmac_returns401() throws Exception {
        mockMvc.perform(post("/api/webhooks/shopify/orders")
                        .contentType(APPLICATION_JSON)
                        .content("{\"id\":12345}")
                        .header("X-Shopify-Hmac-Sha256", "invalid-hmac")
                        .header("X-Shopify-Shop-Domain", "test.myshopify.com")
                        .header("X-Shopify-Topic", "orders/create"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid HMAC signature"));
    }

    @Test
    void webhook_withNoHmac_returns401() throws Exception {
        mockMvc.perform(post("/api/webhooks/shopify/orders")
                        .contentType(APPLICATION_JSON)
                        .content("{\"id\":12345}")
                        .header("X-Shopify-Shop-Domain", "test.myshopify.com"))
                .andExpect(status().isUnauthorized());
    }

    private String computeHmac(String body, String secret) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return Base64.getEncoder().encodeToString(mac.doFinal(body.getBytes(StandardCharsets.UTF_8)));
    }
}
