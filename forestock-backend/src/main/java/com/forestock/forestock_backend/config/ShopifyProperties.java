package com.forestock.forestock_backend.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "forestock.shopify")
public class ShopifyProperties {
    private String webhookSecret;
    private boolean enabled = false;
    private boolean autoForecastOnWebhook = true;
    private boolean dailyAggregation = true;
}

