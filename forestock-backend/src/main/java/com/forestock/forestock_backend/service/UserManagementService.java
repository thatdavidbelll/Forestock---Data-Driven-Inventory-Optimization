package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.domain.AppUser;
import com.forestock.forestock_backend.domain.Inventory;
import com.forestock.forestock_backend.domain.Product;
import com.forestock.forestock_backend.domain.SalesTransaction;
import com.forestock.forestock_backend.domain.Store;
import com.forestock.forestock_backend.dto.request.ChangePasswordRequest;
import com.forestock.forestock_backend.dto.request.CreateUserRequest;
import com.forestock.forestock_backend.dto.request.UpdateUserRequest;
import com.forestock.forestock_backend.dto.response.UserDto;
import com.forestock.forestock_backend.repository.AppUserRepository;
import com.forestock.forestock_backend.repository.InventoryRepository;
import com.forestock.forestock_backend.repository.ProductRepository;
import com.forestock.forestock_backend.repository.SalesTransactionRepository;
import com.forestock.forestock_backend.repository.StoreRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.forestock.forestock_backend.security.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.NoSuchElementException;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserManagementService {

    private final AppUserRepository userRepository;
    private final StoreRepository storeRepository;
    private final ProductRepository productRepository;
    private final SalesTransactionRepository salesTransactionRepository;
    private final InventoryRepository inventoryRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final TokenBlacklistService tokenBlacklistService;
    private final AuditLogService auditLogService;
    private final ObjectMapper objectMapper = JsonMapper.builder().build();

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

        auditLogService.log("USER_CREATED", "AppUser", user.getId().toString(),
                "Created user '" + user.getUsername() + "' with role " + user.getRole());
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

        AppUser saved = userRepository.save(user);
        auditLogService.log("USER_UPDATED", "AppUser", saved.getId().toString(),
                "Updated user '" + saved.getUsername() + "' to role " + saved.getRole() + ", active=" + saved.getActive());
        return toDto(saved);
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
        auditLogService.log("USER_DEACTIVATED", "AppUser", user.getId().toString(),
                "Deactivated user '" + user.getUsername() + "'");
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
        auditLogService.log("PASSWORD_CHANGED", "AppUser", user.getId().toString(),
                "Changed password for user '" + currentUsername + "'");
        log.info("Password changed for user: {}", currentUsername);
    }

    @Transactional(readOnly = true)
    public byte[] exportMyData() {
        String currentUsername = SecurityContextHolder.getContext().getAuthentication().getName();
        AppUser user = userRepository.findByUsername(currentUsername)
                .orElseThrow(() -> new NoSuchElementException("User not found"));

        UUID storeId = requireStoreContext();
        List<Product> products = productRepository.findByStoreIdOrderByCreatedAtAsc(storeId);
        List<SalesTransaction> sales = salesTransactionRepository.findAllByStoreIdOrderBySaleDateAsc(storeId);
        List<Inventory> inventory = inventoryRepository.findLatestForAllProductsByStore(storeId);

        try (ByteArrayOutputStream byteStream = new ByteArrayOutputStream();
             ZipOutputStream zipStream = new ZipOutputStream(byteStream)) {

            addJsonEntry(zipStream, "profile.json", user);
            addProductsCsv(zipStream, products);
            addSalesCsv(zipStream, sales);
            addInventoryCsv(zipStream, inventory);

            zipStream.finish();
            return byteStream.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("Failed to export account data", e);
        }
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

    private void addJsonEntry(ZipOutputStream zipStream, String filename, AppUser user) throws IOException {
        LinkedHashMap<String, Object> profile = new LinkedHashMap<>();
        profile.put("id", user.getId());
        profile.put("username", user.getUsername());
        profile.put("email", user.getEmail());
        profile.put("role", user.getRole());
        profile.put("active", user.getActive());
        profile.put("createdAt", user.getCreatedAt());

        zipStream.putNextEntry(new ZipEntry(filename));
        zipStream.write(objectMapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(profile));
        zipStream.closeEntry();
    }

    private void addProductsCsv(ZipOutputStream zipStream, List<Product> products) throws IOException {
        zipStream.putNextEntry(new ZipEntry("products.csv"));
        PrintWriter writer = new PrintWriter(new OutputStreamWriter(zipStream, StandardCharsets.UTF_8), false);
        writer.println("id,sku,name,category,unit,reorder_point,max_stock,active,created_at");
        for (Product product : products) {
            writer.println(csv(
                    product.getId(),
                    product.getSku(),
                    product.getName(),
                    product.getCategory(),
                    product.getUnit(),
                    product.getReorderPoint(),
                    product.getMaxStock(),
                    product.getActive(),
                    product.getCreatedAt()
            ));
        }
        writer.flush();
        zipStream.closeEntry();
    }

    private void addSalesCsv(ZipOutputStream zipStream, List<SalesTransaction> sales) throws IOException {
        zipStream.putNextEntry(new ZipEntry("sales.csv"));
        PrintWriter writer = new PrintWriter(new OutputStreamWriter(zipStream, StandardCharsets.UTF_8), false);
        writer.println("id,product_id,sku,product_name,sale_date,quantity_sold");
        for (SalesTransaction sale : sales) {
            writer.println(csv(
                    sale.getId(),
                    sale.getProduct().getId(),
                    sale.getProduct().getSku(),
                    sale.getProduct().getName(),
                    sale.getSaleDate(),
                    sale.getQuantitySold()
            ));
        }
        writer.flush();
        zipStream.closeEntry();
    }

    private void addInventoryCsv(ZipOutputStream zipStream, List<Inventory> inventory) throws IOException {
        zipStream.putNextEntry(new ZipEntry("inventory.csv"));
        PrintWriter writer = new PrintWriter(new OutputStreamWriter(zipStream, StandardCharsets.UTF_8), false);
        writer.println("id,product_id,sku,product_name,quantity,recorded_at");
        for (Inventory item : inventory) {
            writer.println(csv(
                    item.getId(),
                    item.getProduct().getId(),
                    item.getProduct().getSku(),
                    item.getProduct().getName(),
                    item.getQuantity(),
                    item.getRecordedAt()
            ));
        }
        writer.flush();
        zipStream.closeEntry();
    }

    private String csv(Object... values) {
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < values.length; i++) {
            if (i > 0) {
                builder.append(',');
            }
            String value = values[i] == null ? "" : values[i].toString();
            builder.append('"').append(value.replace("\"", "\"\"")).append('"');
        }
        return builder.toString();
    }
}
