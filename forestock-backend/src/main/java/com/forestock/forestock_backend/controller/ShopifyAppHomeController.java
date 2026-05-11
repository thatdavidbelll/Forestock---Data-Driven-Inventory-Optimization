package com.forestock.forestock_backend.controller;

import com.forestock.forestock_backend.config.ShopifyProperties;
import com.forestock.forestock_backend.domain.enums.StorePlanTier;
import com.forestock.forestock_backend.dto.request.ShopifyPurchaseOrderRequest;
import com.forestock.forestock_backend.dto.request.UpdateStoreConfigRequest;
import com.forestock.forestock_backend.dto.response.ApiResponse;
import com.forestock.forestock_backend.dto.response.StoreConfigurationDto;
import com.forestock.forestock_backend.repository.ShopifyConnectionRepository;
import com.forestock.forestock_backend.service.ForecastOrchestrator;
import com.forestock.forestock_backend.service.ForecastTriggerService;
import com.forestock.forestock_backend.service.ShopifyAppHomeService;
import com.forestock.forestock_backend.service.StorePlanService;
import com.forestock.forestock_backend.service.StoreConfigurationService;
import com.forestock.forestock_backend.service.SuggestionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.NoSuchElementException;

@RestController
@RequestMapping("/api/shopify")
@RequiredArgsConstructor
public class ShopifyAppHomeController {

    private static final String PROVISIONING_HEADER = "X-Forestock-Shopify-Secret";

    private final ShopifyAppHomeService shopifyAppHomeService;
    private final ShopifyConnectionRepository shopifyConnectionRepository;
    private final ForecastOrchestrator forecastOrchestrator;
    private final ForecastTriggerService forecastTriggerService;
    private final StoreConfigurationService storeConfigurationService;
    private final SuggestionService suggestionService;
    private final ShopifyProperties shopifyProperties;
    private final StorePlanService storePlanService;

    @GetMapping("/app-home")
    public ResponseEntity<ApiResponse<ShopifyAppHomeService.AppHomeOverview>> getAppHome(
            @RequestHeader(name = PROVISIONING_HEADER, required = false) String provisioningSecret,
            @RequestParam String shopDomain) {
        if (!isValidSecret(provisioningSecret)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error("Invalid provisioning secret"));
        }
        return ResponseEntity.ok(ApiResponse.success(shopifyAppHomeService.getOverview(shopDomain)));
    }

    @GetMapping("/recommendations")
    public ResponseEntity<ApiResponse<ShopifyAppHomeService.RecommendationsPayload>> getRecommendations(
            @RequestHeader(name = PROVISIONING_HEADER, required = false) String provisioningSecret,
            @RequestParam String shopDomain) {
        if (!isValidSecret(provisioningSecret)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error("Invalid provisioning secret"));
        }
        return ResponseEntity.ok(ApiResponse.success(shopifyAppHomeService.getRecommendations(shopDomain)));
    }

    @PutMapping("/plan")
    public ResponseEntity<ApiResponse<StorePlanService.PlanSnapshot>> syncPlan(
            @RequestHeader(name = PROVISIONING_HEADER, required = false) String provisioningSecret,
            @Valid @RequestBody PlanSyncRequest request) {
        if (!isValidSecret(provisioningSecret)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error("Invalid provisioning secret"));
        }

        StorePlanService.PlanSnapshot snapshot =
                storePlanService.syncPlanForShop(request.shopDomain(), StorePlanTier.valueOf(request.planTier()));
        return ResponseEntity.ok(ApiResponse.success("Plan synced", snapshot));
    }

    @PostMapping("/plan-choice/free")
    public ResponseEntity<ApiResponse<StorePlanService.PlanSnapshot>> confirmFreePlanChoice(
            @RequestHeader(name = PROVISIONING_HEADER, required = false) String provisioningSecret,
            @Valid @RequestBody PlanChoiceRequest request) {
        if (!isValidSecret(provisioningSecret)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error("Invalid provisioning secret"));
        }

        StorePlanService.PlanSnapshot snapshot = storePlanService.confirmFreePlanChoiceForShop(request.shopDomain());
        return ResponseEntity.ok(ApiResponse.success("Free plan choice confirmed", snapshot));
    }

    @GetMapping("/config")
    public ResponseEntity<ApiResponse<StoreConfigurationDto>> getConfig(
            @RequestHeader(name = PROVISIONING_HEADER, required = false) String provisioningSecret,
            @RequestParam String shopDomain) {
        if (!isValidSecret(provisioningSecret)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error("Invalid provisioning secret"));
        }

        var connection = shopifyConnectionRepository.findByShopDomainAndActiveTrue(shopDomain).orElse(null);
        if (connection == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.error("No active Shopify connection found for this shop"));
        }

        return ResponseEntity.ok(
                ApiResponse.success(storeConfigurationService.getConfigDtoForStore(connection.getStore().getId())));
    }

    @PutMapping("/config")
    public ResponseEntity<ApiResponse<StoreConfigurationDto>> updateConfig(
            @RequestHeader(name = PROVISIONING_HEADER, required = false) String provisioningSecret,
            @RequestParam String shopDomain,
            @Valid @RequestBody UpdateStoreConfigRequest request) {
        if (!isValidSecret(provisioningSecret)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error("Invalid provisioning secret"));
        }

        var connection = shopifyConnectionRepository.findByShopDomainAndActiveTrue(shopDomain).orElse(null);
        if (connection == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.error("No active Shopify connection found for this shop"));
        }

        try {
            StoreConfigurationDto updated = storeConfigurationService.updateConfigForStore(connection.getStore().getId(), request);
            forecastTriggerService.triggerForStore(connection.getStore().getId(), "store-config-updated");
            return ResponseEntity.ok(ApiResponse.success(
                    "Store configuration updated",
                    updated));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @PostMapping("/forecast-run")
    public ResponseEntity<ApiResponse<String>> triggerForecastRun(
            @RequestHeader(name = PROVISIONING_HEADER, required = false) String provisioningSecret,
            @RequestParam String shopDomain) {
        if (!isValidSecret(provisioningSecret)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error("Invalid provisioning secret"));
        }

        return shopifyConnectionRepository.findByShopDomainAndActiveTrue(shopDomain)
                .map(connection -> {
                    try {
                        storePlanService.assertForecastAllowed(connection.getStore().getId());
                        forecastOrchestrator.runForecast(connection.getStore().getId(), "SHOPIFY_APP");
                        return ResponseEntity.accepted()
                                .body(ApiResponse.success("Forecast started in background", "Forecast started in background"));
                    } catch (IllegalStateException e) {
                        return ResponseEntity.status(HttpStatus.CONFLICT)
                                .body(ApiResponse.<String>error(e.getMessage()));
                    }
                })
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(ApiResponse.error("No active Shopify connection found for this shop")));
    }

    @PostMapping("/purchase-order")
    public ResponseEntity<?> generatePurchaseOrder(
            @RequestHeader(name = PROVISIONING_HEADER, required = false) String provisioningSecret,
            @RequestBody ShopifyPurchaseOrderRequest request) {
        if (!isValidSecret(provisioningSecret)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error("Invalid provisioning secret"));
        }
        try {
            byte[] pdf = suggestionService.generatePurchaseOrderPdfForShop(
                    request.getShopDomain(), request.getSuggestionIds());
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_PDF);
            headers.setContentDispositionFormData("attachment", "forestock-purchase-order.pdf");
            return ResponseEntity.ok().headers(headers).body(pdf);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error(e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("Failed to generate purchase order"));
        }
    }

    private boolean isValidSecret(String provisioningSecret) {
        String expected = shopifyProperties.getProvisioningSecret();
        return expected != null
                && !expected.isBlank()
                && provisioningSecret != null
                && MessageDigest.isEqual(
                        expected.getBytes(StandardCharsets.UTF_8),
                        provisioningSecret.getBytes(StandardCharsets.UTF_8)
                );
    }

    public record PlanSyncRequest(String shopDomain, String planTier) {
    }

    public record PlanChoiceRequest(String shopDomain) {
    }
}
