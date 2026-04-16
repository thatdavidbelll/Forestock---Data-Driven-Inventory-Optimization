package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.domain.AppUser;
import com.forestock.forestock_backend.domain.ShopifyConnection;
import com.forestock.forestock_backend.domain.Store;
import com.forestock.forestock_backend.domain.StoreConfiguration;
import com.forestock.forestock_backend.repository.AppUserRepository;
import com.forestock.forestock_backend.repository.ShopifyConnectionRepository;
import com.forestock.forestock_backend.repository.StoreConfigurationRepository;
import com.forestock.forestock_backend.repository.StoreRepository;
import lombok.Builder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ShopifyProvisioningService {

    private final ShopifyConnectionRepository shopifyConnectionRepository;
    private final StoreRepository storeRepository;
    private final StoreConfigurationRepository storeConfigurationRepository;
    private final AppUserRepository appUserRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public ProvisioningResult provisionShop(ProvisioningRequest request) {
        String normalizedShopDomain = normalizeShopDomain(request.shopDomain());
        if (normalizedShopDomain == null) {
            throw new IllegalArgumentException("Shop domain is required");
        }

        Optional<ShopifyConnection> existingConnection = shopifyConnectionRepository.findByShopDomain(normalizedShopDomain);
        if (existingConnection.isPresent()) {
            ShopifyConnection connection = existingConnection.get();
            Store store = connection.getStore();
            String resolvedStoreName = resolveStoreName(request, normalizedShopDomain);
            if (!store.getName().equals(resolvedStoreName)) {
                store.setName(resolvedStoreName);
                storeRepository.save(store);
            }
            boolean createdAdmin = ensureAdminUser(store, request).created();
            ensureStoreConfiguration(store, request);

            if (!connection.isActive()) {
                connection.setActive(true);
                shopifyConnectionRepository.save(connection);
            }

            return ProvisioningResult.builder()
                    .storeId(store.getId())
                    .storeName(store.getName())
                    .storeSlug(store.getSlug())
                    .shopDomain(connection.getShopDomain())
                    .adminUsername(resolveAdminUsername(store).orElse(null))
                    .createdStore(false)
                    .createdAdminUser(createdAdmin)
                    .build();
        }

        Store store = storeRepository.save(Store.builder()
                .name(resolveStoreName(request, normalizedShopDomain))
                .slug(generateUniqueSlug(request.shopName(), normalizedShopDomain))
                .active(true)
                .build());

        ensureStoreConfiguration(store, request);

        ShopifyConnection connection = shopifyConnectionRepository.save(ShopifyConnection.builder()
                .store(store)
                .shopDomain(normalizedShopDomain)
                .webhookSecret(null)
                .active(true)
                .build());

        AdminUserResult admin = ensureAdminUser(store, request);

        log.info("Provisioned Shopify store {} for domain {}", store.getId(), normalizedShopDomain);
        return ProvisioningResult.builder()
                .storeId(store.getId())
                .storeName(store.getName())
                .storeSlug(store.getSlug())
                .shopDomain(connection.getShopDomain())
                .adminUsername(admin.username())
                .createdStore(true)
                .createdAdminUser(admin.created())
                .build();
    }

    private void ensureStoreConfiguration(Store store, ProvisioningRequest request) {
        StoreConfiguration storeConfig = storeConfigurationRepository.findByStoreId(store.getId())
                .orElseGet(() -> StoreConfiguration.builder().store(store).build());
        if (request.currencyCode() != null && !request.currencyCode().isBlank()) {
            storeConfig.setCurrencySymbol(symbolFromCurrencyCode(request.currencyCode()));
        }
        storeConfigurationRepository.save(storeConfig);
    }

    private String symbolFromCurrencyCode(String code) {
        return switch (code.toUpperCase(Locale.ROOT)) {
            case "USD" -> "$";
            case "EUR" -> "€";
            case "GBP" -> "£";
            case "CAD" -> "CA$";
            case "AUD" -> "A$";
            case "JPY" -> "¥";
            case "SEK", "NOK", "DKK" -> "kr";
            case "CHF" -> "Fr";
            default -> code;
        };
    }

    private AdminUserResult ensureAdminUser(Store store, ProvisioningRequest request) {
        List<AppUser> users = appUserRepository.findByStoreId(store.getId());
        Optional<AppUser> existingAdmin = users.stream()
                .filter(user -> "ROLE_ADMIN".equals(user.getRole()))
                .findFirst();

        if (existingAdmin.isPresent()) {
            AppUser admin = existingAdmin.get();
            if ((admin.getEmail() == null || admin.getEmail().isBlank()) && request.email() != null && !request.email().isBlank()) {
                admin.setEmail(request.email().trim().toLowerCase(Locale.ROOT));
                appUserRepository.save(admin);
            }
            return new AdminUserResult(false, admin.getUsername());
        }

        String username = generateUniqueUsername(store.getSlug());
        String email = normalizeEmailForNewUser(request.email());
        AppUser admin = appUserRepository.save(AppUser.builder()
                .username(username)
                .passwordHash(passwordEncoder.encode(UUID.randomUUID().toString()))
                .role("ROLE_ADMIN")
                .email(email)
                .provisioningSource("SHOPIFY")
                .standaloneAccessEnabled(false)
                .standaloneAccessActivatedAt(null)
                .emailVerified(email != null)
                .store(store)
                .active(true)
                .build());

        return new AdminUserResult(true, admin.getUsername());
    }

    private String normalizeEmailForNewUser(String email) {
        if (email == null || email.isBlank()) {
            return null;
        }
        String normalized = email.trim().toLowerCase(Locale.ROOT);
        return appUserRepository.existsByEmail(normalized) ? null : normalized;
    }

    private Optional<String> resolveAdminUsername(Store store) {
        return appUserRepository.findByStoreId(store.getId()).stream()
                .filter(user -> "ROLE_ADMIN".equals(user.getRole()))
                .map(AppUser::getUsername)
                .findFirst();
    }

    private String normalizeShopDomain(String shopDomain) {
        if (shopDomain == null || shopDomain.isBlank()) {
            return null;
        }
        return shopDomain.trim().toLowerCase(Locale.ROOT);
    }

    private String resolveStoreName(ProvisioningRequest request, String shopDomain) {
        if (request.shopName() != null && !request.shopName().isBlank()) {
            return request.shopName().trim();
        }
        String subdomain = shopDomain.split("\\.")[0];
        return capitalizeWords(subdomain.replace('-', ' '));
    }

    private String generateUniqueSlug(String shopName, String shopDomain) {
        String preferredBase = slugify(shopName);
        if (preferredBase == null || preferredBase.isBlank()) {
            preferredBase = slugify(shopDomain.replace(".myshopify.com", ""));
        }
        if (preferredBase == null || preferredBase.isBlank()) {
            preferredBase = "shopify-store";
        }

        String candidate = truncate(preferredBase, 50);
        int suffix = 2;
        while (storeRepository.existsBySlug(candidate)) {
            String next = preferredBase + "-" + suffix++;
            candidate = truncate(next, 50);
        }
        return candidate;
    }

    private String generateUniqueUsername(String storeSlug) {
        String base = truncate(storeSlug + "-admin", 100);
        String candidate = base;
        int suffix = 2;
        while (appUserRepository.existsByUsername(candidate)) {
            String next = storeSlug + "-admin-" + suffix++;
            candidate = truncate(next, 100);
        }
        return candidate;
    }

    private String slugify(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalized = Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-+", "")
                .replaceAll("-+$", "");
        if (normalized.length() < 3) {
            normalized = normalized + "-shop";
        }
        return normalized;
    }

    private String truncate(String value, int maxLength) {
        if (value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength).replaceAll("-+$", "");
    }

    private String capitalizeWords(String value) {
        String[] parts = value.trim().split("\\s+");
        StringBuilder builder = new StringBuilder();
        for (String part : parts) {
            if (part.isBlank()) {
                continue;
            }
            if (builder.length() > 0) {
                builder.append(' ');
            }
            builder.append(part.substring(0, 1).toUpperCase(Locale.ROOT))
                    .append(part.substring(1).toLowerCase(Locale.ROOT));
        }
        return builder.toString();
    }

    public record ProvisioningRequest(
            String shopDomain,
            String shopName,
            String email,
            String currencyCode,
            String currencySymbol
    ) {
    }

    @Builder
    public record ProvisioningResult(
            UUID storeId,
            String storeName,
            String storeSlug,
            String shopDomain,
            String adminUsername,
            boolean createdStore,
            boolean createdAdminUser
    ) {
    }

    private record AdminUserResult(boolean created, String username) {
    }
}
