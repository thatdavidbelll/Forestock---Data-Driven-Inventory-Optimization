package com.forestock.forestock_backend;

import com.forestock.forestock_backend.domain.AppUser;
import com.forestock.forestock_backend.domain.Store;
import com.forestock.forestock_backend.repository.AppUserRepository;
import com.forestock.forestock_backend.repository.StoreRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Creates a default store and admin user on first startup if no users exist.
 * Default credentials: admin / admin123
 * IMPORTANT: Change this password immediately in production.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements ApplicationRunner {

    private final AppUserRepository userRepository;
    private final StoreRepository storeRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (userRepository.count() == 0) {
            Store defaultStore = Store.builder()
                    .name("Default Store")
                    .slug("default")
                    .active(true)
                    .build();
            defaultStore = storeRepository.save(defaultStore);

            AppUser admin = AppUser.builder()
                    .username("admin")
                    .passwordHash(passwordEncoder.encode("admin123"))
                    .role("ROLE_ADMIN")
                    .store(defaultStore)
                    .active(true)
                    .build();
            userRepository.save(admin);
            log.warn("Default store + admin user created (username: admin, password: admin123). Change this password immediately!");
        }
    }
}
