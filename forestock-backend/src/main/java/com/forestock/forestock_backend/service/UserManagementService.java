package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.domain.AppUser;
import com.forestock.forestock_backend.domain.Store;
import com.forestock.forestock_backend.dto.request.ChangePasswordRequest;
import com.forestock.forestock_backend.dto.request.CreateUserRequest;
import com.forestock.forestock_backend.dto.request.UpdateUserRequest;
import com.forestock.forestock_backend.dto.response.UserDto;
import com.forestock.forestock_backend.repository.AppUserRepository;
import com.forestock.forestock_backend.repository.StoreRepository;
import com.forestock.forestock_backend.security.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserManagementService {

    private final AppUserRepository userRepository;
    private final StoreRepository storeRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final TokenBlacklistService tokenBlacklistService;

    /** Returns all users for the current store. */
    @Transactional(readOnly = true)
    public List<UserDto> listUsers() {
        UUID storeId = requireStoreContext();
        return userRepository.findByStoreId(storeId)
                .stream()
                .map(this::toDto)
                .toList();
    }

    /** Creates a new user in the current store. Only ROLE_MANAGER and ROLE_VIEWER are allowed. */
    @Transactional
    public UserDto createUser(CreateUserRequest request) {
        UUID storeId = requireStoreContext();

        if (userRepository.existsByUsername(request.getUsername())) {
            throw new IllegalArgumentException("Username already taken: " + request.getUsername());
        }

        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new NoSuchElementException("Store not found"));

        AppUser user = userRepository.save(AppUser.builder()
                .username(request.getUsername())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(request.getRole())
                .email(request.getEmail())
                .store(store)
                .active(true)
                .build());

        log.info("New user created: username={}, role={}, storeId={}", user.getUsername(), user.getRole(), storeId);
        return toDto(user);
    }

    /** Updates role and/or active status of a user in the current store. */
    @Transactional
    public UserDto updateUser(UUID targetUserId, UpdateUserRequest request) {
        UUID storeId = requireStoreContext();
        String currentUsername = SecurityContextHolder.getContext().getAuthentication().getName();

        AppUser user = userRepository.findByIdAndStoreId(targetUserId, storeId)
                .orElseThrow(() -> new NoSuchElementException("User not found"));

        if (user.getUsername().equals(currentUsername)) {
            throw new IllegalArgumentException("You cannot modify your own account via this endpoint.");
        }

        if (request.getRole() != null) {
            if ("ROLE_SUPER_ADMIN".equals(request.getRole())) {
                throw new IllegalArgumentException("Cannot assign ROLE_SUPER_ADMIN.");
            }
            user.setRole(request.getRole());
        }
        if (request.getActive() != null) {
            user.setActive(request.getActive());
        }

        return toDto(userRepository.save(user));
    }

    /** Soft-deactivates a user in the current store. */
    @Transactional
    public void deactivateUser(UUID targetUserId) {
        UUID storeId = requireStoreContext();
        String currentUsername = SecurityContextHolder.getContext().getAuthentication().getName();

        AppUser user = userRepository.findByIdAndStoreId(targetUserId, storeId)
                .orElseThrow(() -> new NoSuchElementException("User not found"));

        if (user.getUsername().equals(currentUsername)) {
            throw new IllegalArgumentException("You cannot deactivate your own account.");
        }

        user.setActive(false);
        userRepository.save(user);
        log.info("User deactivated: username={}, storeId={}", user.getUsername(), storeId);
    }

    /** Allows any authenticated user to change their own password. */
    @Transactional
    public void changePassword(ChangePasswordRequest request) {
        String currentUsername = SecurityContextHolder.getContext().getAuthentication().getName();
        AppUser user = userRepository.findByUsername(currentUsername)
                .orElseThrow(() -> new NoSuchElementException("User not found"));

        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Current password is incorrect.");
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
        revokeCurrentToken();
        log.info("Password changed for user: {}", currentUsername);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private UUID requireStoreContext() {
        UUID storeId = TenantContext.getStoreId();
        if (storeId == null) throw new IllegalStateException("No store context");
        return storeId;
    }

    private UserDto toDto(AppUser u) {
        return UserDto.builder()
                .id(u.getId())
                .username(u.getUsername())
                .email(u.getEmail())
                .role(u.getRole())
                .active(u.getActive())
                .createdAt(u.getCreatedAt())
                .build();
    }

    private void revokeCurrentToken() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null) {
            return;
        }

        Object credentials = authentication.getCredentials();
        if (!(credentials instanceof String token) || token.isBlank()) {
            return;
        }

        Duration remaining = jwtService.getRemainingTtl(token);
        if (remaining.isZero() || remaining.isNegative()) {
            return;
        }

        tokenBlacklistService.blacklist(jwtService.extractJti(token), remaining);
    }
}
