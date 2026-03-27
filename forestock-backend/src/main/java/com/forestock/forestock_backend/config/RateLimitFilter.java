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
            "/api/auth/forgot-password"
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

        boolean allowed;
        synchronized (this) {
            Deque<Long> timestamps = requestLog.computeIfAbsent(ip, k -> new ArrayDeque<>());
            // Drop timestamps older than the window
            while (!timestamps.isEmpty() && (now - timestamps.peekFirst()) > WINDOW_MS) {
                timestamps.pollFirst();
            }
            allowed = timestamps.size() < MAX_REQUESTS;
            if (allowed) timestamps.addLast(now);
        }

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
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
