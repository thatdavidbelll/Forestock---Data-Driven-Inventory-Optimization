package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.domain.AppUser;
import com.forestock.forestock_backend.domain.Store;
import com.forestock.forestock_backend.domain.StoreConfiguration;
import com.forestock.forestock_backend.dto.request.RegisterRequest;
import com.forestock.forestock_backend.dto.response.AuthResponse;
import com.forestock.forestock_backend.repository.AppUserRepository;
import com.forestock.forestock_backend.repository.StoreConfigurationRepository;
import com.forestock.forestock_backend.repository.StoreRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class RegisterService {

    private final StoreRepository storeRepository;
    private final StoreConfigurationRepository storeConfigurationRepository;
    private final AppUserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;
    private final EmailVerificationService emailVerificationService;

    /**
     * Creates a new store and its first admin user atomically.
     * Returns tokens so the user is logged in immediately after registration.
     */
    private static final java.util.regex.Pattern SLUG_PATTERN =
            java.util.regex.Pattern.compile("^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$");

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (!SLUG_PATTERN.matcher(request.getStoreSlug()).matches()) {
            throw new IllegalArgumentException(
                    "Slug must be 3–50 chars, lowercase letters/numbers/hyphens, cannot start or end with a hyphen.");
        }
        if (storeRepository.existsBySlug(request.getStoreSlug())) {
            throw new IllegalArgumentException("Store slug already taken: " + request.getStoreSlug());
        }
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new IllegalArgumentException("Username already taken: " + request.getUsername());
        }

        Store store = storeRepository.save(Store.builder()
                .name(request.getStoreName())
                .slug(request.getStoreSlug())
                .active(true)
                .build());
        storeConfigurationRepository.save(StoreConfiguration.builder().store(store).build());

        AppUser admin = userRepository.save(AppUser.builder()
                .username(request.getUsername())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role("ROLE_ADMIN")
                .email(request.getEmail())
                .provisioningSource("DIRECT")
                .standaloneAccessEnabled(true)
                .standaloneAccessActivatedAt(java.time.LocalDateTime.now())
                .store(store)
                .active(true)
                .build());

        emailVerificationService.sendVerificationEmail(admin);
        log.info("New store registered: slug={}, owner={}", store.getSlug(), admin.getUsername());

        return AuthResponse.builder()
                .username(admin.getUsername())
                .role(admin.getRole())
                .build();
    }
}
