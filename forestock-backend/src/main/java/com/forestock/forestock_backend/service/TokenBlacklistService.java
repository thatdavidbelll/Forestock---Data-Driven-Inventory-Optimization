package com.forestock.forestock_backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Slf4j
@Service
@RequiredArgsConstructor
public class TokenBlacklistService {

    private static final String PREFIX = "jwt:blacklist:";

    private final StringRedisTemplate redisTemplate;
    @Value("${forestock.security.token-blacklist.enabled:true}")
    private boolean enabled;

    public void blacklist(String jti, Duration ttl) {
        if (!enabled || jti == null || jti.isBlank() || ttl == null || ttl.isZero() || ttl.isNegative()) {
            return;
        }

        try {
        redisTemplate.opsForValue().set(PREFIX + jti, "1", ttl);
        } catch (RuntimeException e) {
            log.warn("Token blacklist write skipped because Redis is unavailable: {}", e.getMessage());
        }
    }

    public boolean isBlacklisted(String jti) {
        if (!enabled || jti == null || jti.isBlank()) {
            return false;
        }

        try {
            return Boolean.TRUE.equals(redisTemplate.hasKey(PREFIX + jti));
        } catch (RuntimeException e) {
            log.warn("Token blacklist check skipped because Redis is unavailable: {}", e.getMessage());
            return false;
        }
    }
}
