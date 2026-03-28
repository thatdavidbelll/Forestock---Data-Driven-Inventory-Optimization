package com.forestock.forestock_backend.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.time.Duration;
import java.util.Date;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;

@Service
public class JwtService {

    @Value("${forestock.jwt.secret}")
    private String secret;

    @Value("${forestock.jwt.access-token-expiry-hours}")
    private long accessTokenExpiryHours;

    @Value("${forestock.jwt.refresh-token-expiry-days}")
    private long refreshTokenExpiryDays;

    public String generateAccessToken(UserDetails userDetails, String role, UUID storeId) {
        return buildToken(userDetails.getUsername(), role, storeId,
                accessTokenExpiryHours * 60 * 60 * 1000L, "ACCESS");
    }

    public String generateRefreshToken(UserDetails userDetails, String role, UUID storeId) {
        return buildToken(userDetails.getUsername(), role, storeId,
                refreshTokenExpiryDays * 24 * 60 * 60 * 1000L, "REFRESH");
    }

    private String buildToken(String subject, String role, UUID storeId, long expiryMs, String tokenType) {
        return Jwts.builder()
                .id(UUID.randomUUID().toString())
                .subject(subject)
                .claims(Map.of(
                        "role", role,
                        "type", tokenType,
                        "storeId", storeId != null ? storeId.toString() : ""
                ))
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expiryMs))
                .signWith(getSigningKey())
                .compact();
    }

    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    public String extractRole(String token) {
        return extractClaim(token, claims -> claims.get("role", String.class));
    }

    public String extractTokenType(String token) {
        return extractClaim(token, claims -> claims.get("type", String.class));
    }

    public String extractJti(String token) {
        return extractClaim(token, Claims::getId);
    }

    public UUID extractStoreId(String token) {
        String raw = extractClaim(token, claims -> claims.get("storeId", String.class));
        if (raw == null || raw.isBlank()) return null;
        return UUID.fromString(raw);
    }

    public Duration getRemainingTtl(String token) {
        Date expiration = extractClaim(token, Claims::getExpiration);
        long remainingMs = expiration.getTime() - System.currentTimeMillis();
        return remainingMs > 0 ? Duration.ofMillis(remainingMs) : Duration.ZERO;
    }

    public boolean isTokenValid(String token, UserDetails userDetails) {
        return extractUsername(token).equals(userDetails.getUsername()) && !isTokenExpired(token);
    }

    public boolean isRefreshToken(String token) {
        return "REFRESH".equals(extractTokenType(token));
    }

    private boolean isTokenExpired(String token) {
        return extractClaim(token, Claims::getExpiration).before(new Date());
    }

    private <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        return claimsResolver.apply(extractAllClaims(token));
    }

    private Claims extractAllClaims(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(Decoders.BASE64.decode(secret));
    }
}
