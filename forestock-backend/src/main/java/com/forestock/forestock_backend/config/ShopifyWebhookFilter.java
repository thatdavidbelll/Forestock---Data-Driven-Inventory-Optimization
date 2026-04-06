package com.forestock.forestock_backend.config;

import com.forestock.forestock_backend.service.ShopifyHmacService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Slf4j
@Component
@Order(5)
@RequiredArgsConstructor
public class ShopifyWebhookFilter extends OncePerRequestFilter {

    private static final String WEBHOOK_PATH_PREFIX = "/api/webhooks/shopify";
    private static final String HMAC_HEADER = "X-Shopify-Hmac-Sha256";
    private static final String SHOP_DOMAIN_HEADER = "X-Shopify-Shop-Domain";
    private static final String TOPIC_HEADER = "X-Shopify-Topic";

    private final ShopifyHmacService hmacService;
    private final ShopifyProperties shopifyProperties;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith(WEBHOOK_PATH_PREFIX);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        if (!shopifyProperties.isEnabled()) {
            log.warn("Shopify integration is disabled, rejecting webhook");
            sendError(response, HttpServletResponse.SC_SERVICE_UNAVAILABLE, "Shopify integration is disabled");
            return;
        }

        CachedBodyHttpServletRequest cachedRequest = new CachedBodyHttpServletRequest(request);
        String hmacHeader = cachedRequest.getHeader(HMAC_HEADER);
        String shopDomain = cachedRequest.getHeader(SHOP_DOMAIN_HEADER);
        String topic = cachedRequest.getHeader(TOPIC_HEADER);

        log.debug("Shopify webhook received: topic={}, domain={}", topic, shopDomain);

        if (!hmacService.verifyHmac(cachedRequest.getCachedBody(), hmacHeader, shopDomain)) {
            log.warn("Shopify HMAC verification failed for domain: {}", shopDomain);
            sendError(response, HttpServletResponse.SC_UNAUTHORIZED, "Invalid HMAC signature");
            return;
        }

        filterChain.doFilter(cachedRequest, response);
    }

    private void sendError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.getWriter().write(
                String.format("{\"status\":\"error\",\"message\":\"%s\"}", message)
        );
    }
}

