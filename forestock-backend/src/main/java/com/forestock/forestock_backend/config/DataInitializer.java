package com.forestock.forestock_backend.config;

import com.forestock.forestock_backend.domain.AppUser;
import com.forestock.forestock_backend.repository.AppUserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Ensures the configured platform super-admin account exists on startup.
 *
 * Configure via environment variables:
 *   SUPER_ADMIN_USERNAME
 *   SUPER_ADMIN_PASSWORD
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements ApplicationRunner {

    private final AppUserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${forestock.super-admin.username:superadmin}")
    private String superAdminUsername;

    @Value("${forestock.super-admin.password}")
    private String superAdminPassword;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (superAdminPassword == null || superAdminPassword.isBlank()) {
            throw new IllegalStateException("SUPER_ADMIN_PASSWORD environment variable must be set");
        }

        AppUser superAdmin = userRepository.findByUsername(superAdminUsername)
                .map(existing -> {
                    existing.setPasswordHash(passwordEncoder.encode(superAdminPassword));
                    existing.setRole("ROLE_SUPER_ADMIN");
                    existing.setStore(null);
                    existing.setActive(true);
                    return existing;
                })
                .orElseGet(() -> AppUser.builder()
                        .username(superAdminUsername)
                        .passwordHash(passwordEncoder.encode(superAdminPassword))
                        .role("ROLE_SUPER_ADMIN")
                        .store(null)
                        .active(true)
                        .build());

        boolean existingUser = superAdmin.getId() != null;
        userRepository.save(superAdmin);

        if (existingUser) {
            log.warn("Configured super admin refreshed: username='{}'", superAdminUsername);
        } else {
            log.warn("Configured super admin created: username='{}'", superAdminUsername);
        }
    }
}
