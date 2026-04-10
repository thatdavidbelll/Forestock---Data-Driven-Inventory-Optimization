package com.forestock.forestock_backend.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Sliding-window rate limiter — 10 requests per minute per IP address.
 * Applied to sensitive auth endpoints to protect against brute-force attacks.
 *
 * Uses a ConcurrentHashMap of per-IP request-timestamp queues.
 * No third-party dependency required.
 */
@Slf4j
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final int MAX_REQUESTS  = 10;
    private static final long WINDOW_MS    = 60_000L; // 1 minute

    private static final String[] RATE_LIMITED_PATHS = {
            "/api/auth/login",
            "/api/auth/forgot-password",
            "/api/auth/refresh",
            "/api/auth/verify-email",
            "/api/auth/resend-verification",
            "/api/auth/reset-password"
    };

    /** Per-IP sliding window of request timestamps. */
    private final ConcurrentHashMap<String, Deque<Long>> requestLog = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        if (!isRateLimited(request.getRequestURI())) {
            filterChain.doFilter(request, response);
            return;
        }

        String ip = extractClientIp(request);
        long now = Instant.now().toEpochMilli();

        final boolean[] allowedRef = {false};
        requestLog.compute(ip, (key, existing) -> {
            Deque<Long> queue = existing != null ? existing : new ArrayDeque<>();
            while (!queue.isEmpty() && (now - queue.peekFirst()) > WINDOW_MS) {
                queue.pollFirst();
            }
            if (queue.isEmpty() && existing != null) {
                return null;
            }
            if (queue.size() >= MAX_REQUESTS) {
                return queue;
            }
            queue.addLast(now);
            allowedRef[0] = true;
            return queue;
        });
        boolean allowed = allowedRef[0];

        if (allowed) {
            filterChain.doFilter(request, response);
        } else {
            log.warn("Rate limit exceeded for IP {} on {}", ip, request.getRequestURI());
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write(
                    "{\"status\":\"error\",\"message\":\"Too many requests — please wait a minute and try again.\"}"
            );
        }
    }

    private boolean isRateLimited(String uri) {
        for (String path : RATE_LIMITED_PATHS) {
            if (uri.equals(path)) return true;
        }
        return false;
    }

    private String extractClientIp(HttpServletRequest request) {
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }
        return request.getRemoteAddr();
    }
}
