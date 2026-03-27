package com.forestock.forestock_backend.security;

import java.util.UUID;

/**
 * Holds the current tenant (store) ID for the duration of the HTTP request.
 * Set by JwtAuthFilter, cleared automatically after the request completes.
 */
public final class TenantContext {

    private static final ThreadLocal<UUID> CURRENT_STORE = new ThreadLocal<>();

    private TenantContext() {}

    public static void setStoreId(UUID storeId) {
        CURRENT_STORE.set(storeId);
    }

    public static UUID getStoreId() {
        return CURRENT_STORE.get();
    }

    public static void clear() {
        CURRENT_STORE.remove();
    }
}
