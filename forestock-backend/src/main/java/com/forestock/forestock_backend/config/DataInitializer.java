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
 * Seeds the platform super-admin account on first startup if none exists.
 *
 * Configure via environment variables:
 *   SUPER_ADMIN_USERNAME  (default: superadmin)
 *   SUPER_ADMIN_PASSWORD  (default: Admin@12345 — CHANGE IN PRODUCTION)
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements ApplicationRunner {

    private final AppUserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${forestock.super-admin.username:superadmin}")
    private String superAdminUsername;

    @Value("${forestock.super-admin.password:Admin@12345}")
    private String superAdminPassword;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (userRepository.existsByRole("ROLE_SUPER_ADMIN")) {
            log.debug("Super admin already exists — skipping seed.");
            return;
        }

        AppUser superAdmin = AppUser.builder()
                .username(superAdminUsername)
                .passwordHash(passwordEncoder.encode(superAdminPassword))
                .role("ROLE_SUPER_ADMIN")
                .store(null)   // not tied to any store
                .active(true)
                .build();

        userRepository.save(superAdmin);

        log.warn("=============================================================");
        log.warn("  Super admin created: username='{}' password='{}'",
                superAdminUsername, superAdminPassword);
        log.warn("  CHANGE THE PASSWORD IMMEDIATELY in production!");
        log.warn("  Set SUPER_ADMIN_USERNAME and SUPER_ADMIN_PASSWORD env vars.");
        log.warn("=============================================================");
    }
}
