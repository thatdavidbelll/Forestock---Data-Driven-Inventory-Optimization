package com.forestock.forestock_backend.security;

import com.forestock.forestock_backend.domain.AppUser;
import com.forestock.forestock_backend.domain.Store;
import com.forestock.forestock_backend.repository.AppUserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserDetailsServiceImplTest {

    @Mock
    private AppUserRepository userRepository;

    @InjectMocks
    private UserDetailsServiceImpl userDetailsService;

    @Test
    void loadUserByUsername_blocksShopifyUserWithoutStandaloneActivation() {
        Store store = Store.builder().id(UUID.randomUUID()).name("Shop").slug("shop").active(true).build();
        AppUser user = AppUser.builder()
                .username("shopify-admin")
                .passwordHash("hash")
                .role("ROLE_ADMIN")
                .store(store)
                .active(true)
                .email("merchant@example.com")
                .emailVerified(true)
                .provisioningSource("SHOPIFY")
                .standaloneAccessEnabled(false)
                .standaloneAccessActivatedAt(null)
                .build();

        when(userRepository.findWithStoreByUsername("shopify-admin")).thenReturn(Optional.of(user));

        DisabledException ex = assertThrows(DisabledException.class,
                () -> userDetailsService.loadUserByUsername("shopify-admin"));
        assertThat(ex.getMessage()).contains("Standalone Forestock access has not been activated");
    }

    @Test
    void loadUserByUsername_allowsActivatedShopifyUser() {
        Store store = Store.builder().id(UUID.randomUUID()).name("Shop").slug("shop").active(true).build();
        AppUser user = AppUser.builder()
                .username("shopify-admin")
                .passwordHash("hash")
                .role("ROLE_ADMIN")
                .store(store)
                .active(true)
                .email("merchant@example.com")
                .emailVerified(true)
                .provisioningSource("SHOPIFY")
                .standaloneAccessEnabled(true)
                .standaloneAccessActivatedAt(LocalDateTime.now())
                .build();

        when(userRepository.findWithStoreByUsername("shopify-admin")).thenReturn(Optional.of(user));

        UserDetails details = userDetailsService.loadUserByUsername("shopify-admin");
        assertThat(details.getUsername()).isEqualTo("shopify-admin");
    }
}
