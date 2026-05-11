package com.forestock.forestock_backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.forestock.forestock_backend.config.ShopifyProperties;
import com.forestock.forestock_backend.domain.enums.StorePlanTier;
import com.forestock.forestock_backend.service.ShopifyAppHomeService;
import com.forestock.forestock_backend.service.StorePlanService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.Map;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ShopifyAppHomeControllerTest {

    private MockMvc mockMvc;
    private StorePlanService storePlanService;

    @BeforeEach
    void setUp() {
        storePlanService = mock(StorePlanService.class);
        ShopifyAppHomeService shopifyAppHomeService = mock(ShopifyAppHomeService.class);
        ShopifyProperties shopifyProperties = new ShopifyProperties();
        shopifyProperties.setProvisioningSecret("test-secret");

        ShopifyAppHomeController controller = new ShopifyAppHomeController(
                shopifyAppHomeService,
                null,
                null,
                null,
                null,
                null,
                shopifyProperties,
                storePlanService
        );

        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new ApiExceptionHandler())
                .build();
    }

    @Test
    void syncPlan_updatesShopPlanTier() throws Exception {
        when(storePlanService.syncPlanForShop(eq("demo.myshopify.com"), eq(StorePlanTier.PAID)))
                .thenReturn(new StorePlanService.PlanSnapshot(StorePlanTier.PAID, null, 6, null, false, true, null, true));

        mockMvc.perform(put("/api/shopify/plan")
                        .header("X-Forestock-Shopify-Secret", "test-secret")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(new ObjectMapper().writeValueAsString(
                                Map.of("shopDomain", "demo.myshopify.com", "planTier", "PAID"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.planTier").value("PAID"))
                .andExpect(jsonPath("$.data.productLimit").isEmpty())
                .andExpect(jsonPath("$.data.planChoiceConfirmed").value(true));
    }

    @Test
    void confirmFreePlanChoice_marksMerchantChoiceConfirmed() throws Exception {
        when(storePlanService.confirmFreePlanChoiceForShop(eq("demo.myshopify.com")))
                .thenReturn(new StorePlanService.PlanSnapshot(StorePlanTier.FREE, 15, 6, 9, false, true, null, true));

        mockMvc.perform(post("/api/shopify/plan-choice/free")
                        .header("X-Forestock-Shopify-Secret", "test-secret")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(new ObjectMapper().writeValueAsString(
                                Map.of("shopDomain", "demo.myshopify.com"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.planTier").value("FREE"))
                .andExpect(jsonPath("$.data.planChoiceConfirmed").value(true));
    }
}
