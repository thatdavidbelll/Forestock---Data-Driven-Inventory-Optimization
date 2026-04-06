package com.forestock.forestock_backend.config;

import com.forestock.forestock_backend.security.TenantContext;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class CorrelationIdFilter extends OncePerRequestFilter {

    private static final String CORRELATION_ID = "correlationId";
    private static final String STORE_ID = "storeId";

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        try {
            MDC.put(CORRELATION_ID, UUID.randomUUID().toString().substring(0, 8));
            UUID storeId = TenantContext.getStoreId();
            if (storeId != null) {
                MDC.put(STORE_ID, storeId.toString().substring(0, 8));
            }
            filterChain.doFilter(request, response);
        } finally {
            MDC.clear();
        }
    }
}
