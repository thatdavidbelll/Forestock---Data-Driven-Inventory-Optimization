package com.forestock.forestock_backend.security;

import com.forestock.forestock_backend.domain.AppUser;
import com.forestock.forestock_backend.repository.AppUserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class UserDetailsServiceImpl implements UserDetailsService {

    private final AppUserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        AppUser user = userRepository.findWithStoreByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));

        if (!Boolean.TRUE.equals(user.getActive())) {
            throw new DisabledException("User account is deactivated.");
        }

        if (user.getStore() != null && !Boolean.TRUE.equals(user.getStore().getActive())) {
            throw new DisabledException("Store is deactivated. Contact the platform administrator.");
        }

        if (user.getEmail() != null && !Boolean.TRUE.equals(user.getEmailVerified())) {
            throw new DisabledException("Email not verified. Check your inbox.");
        }

        if ("SHOPIFY".equalsIgnoreCase(user.getProvisioningSource())
                && (!Boolean.TRUE.equals(user.getStandaloneAccessEnabled())
                || user.getStandaloneAccessActivatedAt() == null)) {
            throw new DisabledException("Standalone Forestock access has not been activated for this Shopify account yet. Continue in Shopify or request web access.");
        }

        return new User(
                user.getUsername(),
                user.getPasswordHash(),
                List.of(new SimpleGrantedAuthority(user.getRole()))
        );
    }
}
