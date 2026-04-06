package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.domain.ShopifyConnection;
import com.forestock.forestock_backend.domain.Store;
import com.forestock.forestock_backend.repository.ShopifyConnectionRepository;
import com.forestock.forestock_backend.repository.StoreRepository;
import com.forestock.forestock_backend.security.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ShopifyConnectionService {

    private final ShopifyConnectionRepository connectionRepository;
    private final StoreRepository storeRepository;
    private final AuditLogService auditLogService;

    @Transactional(readOnly = true)
    public Optional<ShopifyConnection> getConnectionForCurrentStore() {
        return connectionRepository.findByStoreId(requireStoreContext());
    }

    @Transactional
    public ShopifyConnection createConnection(String shopDomain, String webhookSecret) {
        UUID storeId = requireStoreContext();

        if (connectionRepository.existsByStoreId(storeId)) {
            throw new IllegalStateException("Store already has a Shopify connection. Delete it first.");
        }
        if (connectionRepository.existsByShopDomain(shopDomain)) {
            throw new IllegalStateException("Shop domain '" + shopDomain + "' is already connected to another store.");
        }

        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new NoSuchElementException("Store not found"));

        ShopifyConnection connection = connectionRepository.save(ShopifyConnection.builder()
                .store(store)
                .shopDomain(shopDomain)
                .webhookSecret(webhookSecret)
                .active(true)
                .build());

        auditLogService.log("SHOPIFY_CONNECTED", "ShopifyConnection", connection.getId().toString(),
                "Connected Shopify domain: " + shopDomain);
        log.info("Created Shopify connection for store {} -> {}", storeId, shopDomain);
        return connection;
    }

    @Transactional
    public void deleteConnection() {
        UUID storeId = requireStoreContext();
        ShopifyConnection connection = connectionRepository.findByStoreId(storeId)
                .orElseThrow(() -> new NoSuchElementException("No Shopify connection found for this store"));

        connectionRepository.delete(connection);
        auditLogService.log("SHOPIFY_DISCONNECTED", "ShopifyConnection", connection.getId().toString(),
                "Disconnected Shopify domain: " + connection.getShopDomain());
        log.info("Deleted Shopify connection for store {}", storeId);
    }

    @Transactional
    public ShopifyConnection toggleActive(boolean active) {
        ShopifyConnection connection = connectionRepository.findByStoreId(requireStoreContext())
                .orElseThrow(() -> new NoSuchElementException("No Shopify connection found"));

        connection.setActive(active);
        ShopifyConnection saved = connectionRepository.save(connection);
        auditLogService.log(active ? "SHOPIFY_ACTIVATED" : "SHOPIFY_DEACTIVATED",
                "ShopifyConnection", saved.getId().toString(),
                "Shopify connection " + (active ? "activated" : "deactivated"));
        return saved;
    }

    private UUID requireStoreContext() {
        UUID storeId = TenantContext.getStoreId();
        if (storeId == null) {
            throw new IllegalStateException("No store context");
        }
        return storeId;
    }
}

