package com.forestock.forestock_backend.controller;

import com.forestock.forestock_backend.config.ShopifyProperties;
import com.forestock.forestock_backend.service.ShopifyProvisioningService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.mockito.Mockito.mock;

class ShopifyProvisioningControllerTest {

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        ShopifyProvisioningService provisioningService = mock(ShopifyProvisioningService.class);
        ShopifyProperties shopifyProperties = new ShopifyProperties();
        shopifyProperties.setProvisioningSecret("expected-secret");

        mockMvc = MockMvcBuilders.standaloneSetup(
                        new ShopifyProvisioningController(provisioningService, shopifyProperties))
                .setControllerAdvice(new ApiExceptionHandler())
                .build();
    }

    @Test
    void provisionShop_returnsForbidden_forPaddedSecret() throws Exception {
        mockMvc.perform(post("/api/shopify/provision")
                        .header("X-Forestock-Shopify-Secret", "expected-secret-extra")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"shopDomain":"test-shop.myshopify.com","shopName":"Test Shop","email":"merchant@example.com"}
                                """))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Invalid provisioning secret"));
    }
}
