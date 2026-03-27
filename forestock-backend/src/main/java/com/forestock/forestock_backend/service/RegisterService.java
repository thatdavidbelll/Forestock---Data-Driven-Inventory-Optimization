package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.domain.AppUser;
import com.forestock.forestock_backend.domain.Store;
import com.forestock.forestock_backend.dto.request.RegisterRequest;
import com.forestock.forestock_backend.dto.response.AuthResponse;
import com.forestock.forestock_backend.repository.AppUserRepository;
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
    private final AppUserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;

    /**
     * Creates a new store and its first admin user atomically.
     * Returns tokens so the user is logged in immediately after registration.
     */
    @Transactional
    public AuthResponse register(RegisterRequest request) {
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

        AppUser admin = userRepository.save(AppUser.builder()
                .username(request.getUsername())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role("ROLE_ADMIN")
                .store(store)
                .active(true)
                .build());

        log.info("New store registered: slug={}, owner={}", store.getSlug(), admin.getUsername());

        UserDetails userDetails = userDetailsService.loadUserByUsername(admin.getUsername());
        String accessToken = jwtService.generateAccessToken(userDetails, admin.getRole(), store.getId());
        String refreshToken = jwtService.generateRefreshToken(userDetails, admin.getRole(), store.getId());

        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .tokenType("Bearer")
                .expiresInSeconds(8 * 3600L)
                .username(admin.getUsername())
                .role(admin.getRole())
                .build();
    }
}
