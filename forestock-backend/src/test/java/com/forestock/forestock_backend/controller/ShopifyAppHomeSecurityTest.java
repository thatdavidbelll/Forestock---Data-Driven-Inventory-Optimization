package com.forestock.forestock_backend.controller;

import com.forestock.forestock_backend.config.SecurityConfig;
import com.forestock.forestock_backend.config.ShopifyProperties;
import com.forestock.forestock_backend.domain.enums.StorePlanTier;
import com.forestock.forestock_backend.repository.ShopifyConnectionRepository;
import com.forestock.forestock_backend.security.JwtAuthFilter;
import com.forestock.forestock_backend.security.UserDetailsServiceImpl;
import com.forestock.forestock_backend.service.ForecastOrchestrator;
import com.forestock.forestock_backend.service.ForecastTriggerService;
import com.forestock.forestock_backend.service.JwtService;
import com.forestock.forestock_backend.service.ShopifyAppHomeService;
import com.forestock.forestock_backend.service.StoreConfigurationService;
import com.forestock.forestock_backend.service.StorePlanService;
import com.forestock.forestock_backend.service.SuggestionService;
import com.forestock.forestock_backend.service.TokenBlacklistService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.support.StaticApplicationContext;
import org.springframework.security.config.ObjectPostProcessor;
import org.springframework.security.config.annotation.authentication.builders.AuthenticationManagerBuilder;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.http.MediaType;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.HashMap;
import java.util.Map;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ShopifyAppHomeSecurityTest {

    private MockMvc mockMvc;
    private StorePlanService storePlanService;

    @BeforeEach
    void setUp() throws Exception {
        storePlanService = mock(StorePlanService.class);
        ShopifyAppHomeService shopifyAppHomeService = mock(ShopifyAppHomeService.class);
        ShopifyConnectionRepository shopifyConnectionRepository = mock(ShopifyConnectionRepository.class);
        ForecastOrchestrator forecastOrchestrator = mock(ForecastOrchestrator.class);
        ForecastTriggerService forecastTriggerService = mock(ForecastTriggerService.class);
        StoreConfigurationService storeConfigurationService = mock(StoreConfigurationService.class);
        SuggestionService suggestionService = mock(SuggestionService.class);
        ShopifyProperties shopifyProperties = new ShopifyProperties();
        shopifyProperties.setProvisioningSecret("test-secret");

        ShopifyAppHomeController controller = new ShopifyAppHomeController(
                shopifyAppHomeService,
                shopifyConnectionRepository,
                forecastOrchestrator,
                forecastTriggerService,
                storeConfigurationService,
                suggestionService,
                shopifyProperties,
                storePlanService
        );

        UserDetailsServiceImpl userDetailsService = mock(UserDetailsServiceImpl.class);
        JwtAuthFilter jwtAuthFilter = new JwtAuthFilter(
                mock(JwtService.class),
                mock(TokenBlacklistService.class),
                userDetailsService
        );

        SecurityConfig securityConfig = new SecurityConfig(jwtAuthFilter, userDetailsService);
        ReflectionTestUtils.setField(securityConfig, "frontendUrl", "http://localhost:5173");

        HttpSecurity httpSecurity = new HttpSecurity(
                objectPostProcessor(),
                new AuthenticationManagerBuilder(objectPostProcessor()),
                new HashMap<>()
        );
        httpSecurity.setSharedObject(org.springframework.context.ApplicationContext.class, new StaticApplicationContext());

        SecurityFilterChain securityFilterChain = securityConfig.filterChain(httpSecurity);

        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new ApiExceptionHandler())
                .addFilters(new FilterChainProxy(securityFilterChain))
                .build();
    }

    private ObjectPostProcessor<Object> objectPostProcessor() {
        return new ObjectPostProcessor<>() {
            @Override
            public <O> O postProcess(O object) {
                return object;
            }
        };
    }

    @Test
    void syncPlan_allowsShopifySecretWithoutJwt() throws Exception {
        when(storePlanService.syncPlanForShop(eq("demo.myshopify.com"), eq(StorePlanTier.PAID)))
                .thenReturn(new StorePlanService.PlanSnapshot(StorePlanTier.PAID, null, 6, null, false, true, null, true));

        mockMvc.perform(put("/api/shopify/plan")
                        .header("X-Forestock-Shopify-Secret", "test-secret")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"shopDomain":"demo.myshopify.com","planTier":"PAID"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.planTier").value("PAID"))
                .andExpect(jsonPath("$.data.planChoiceConfirmed").value(true));
    }

    @Test
    void syncPlan_returnsControllerForbiddenWhenSecretMissing() throws Exception {
        mockMvc.perform(put("/api/shopify/plan")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"shopDomain":"demo.myshopify.com","planTier":"PAID"}
                                """))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Invalid provisioning secret"));
    }

    @Test
    void confirmFreePlanChoice_allowsShopifySecretWithoutJwt() throws Exception {
        when(storePlanService.confirmFreePlanChoiceForShop(eq("demo.myshopify.com")))
                .thenReturn(new StorePlanService.PlanSnapshot(StorePlanTier.FREE, 15, 6, 9, false, true, null, true));

        mockMvc.perform(post("/api/shopify/plan-choice/free")
                        .header("X-Forestock-Shopify-Secret", "test-secret")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"shopDomain":"demo.myshopify.com"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.planTier").value("FREE"))
                .andExpect(jsonPath("$.data.planChoiceConfirmed").value(true));
    }

    @Test
    void confirmFreePlanChoice_returnsControllerForbiddenWhenSecretMissing() throws Exception {
        mockMvc.perform(post("/api/shopify/plan-choice/free")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"shopDomain":"demo.myshopify.com"}
                                """))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Invalid provisioning secret"));
    }
}
