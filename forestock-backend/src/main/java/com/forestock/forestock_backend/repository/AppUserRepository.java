package com.forestock.forestock_backend.repository;

import com.forestock.forestock_backend.domain.AppUser;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AppUserRepository extends JpaRepository<AppUser, UUID> {
    Optional<AppUser> findByUsername(String username);

    @EntityGraph(attributePaths = "store")
    Optional<AppUser> findWithStoreByUsername(String username);
    boolean existsByUsername(String username);

    /** All users belonging to a specific store (for user management). */
    List<AppUser> findByStoreId(UUID storeId);

    /** Find user by ID scoped to a store (enforces tenant isolation). */
    Optional<AppUser> findByIdAndStoreId(UUID id, UUID storeId);

    /** Find user by email (for password reset lookup). */
    Optional<AppUser> findByEmail(String email);
    boolean existsByEmail(String email);

    /** Find user by password reset token (for reset validation). */
    Optional<AppUser> findByPasswordResetToken(String token);

    Optional<AppUser> findByEmailVerificationToken(String token);

    /** Check if a role exists in the system (used to seed super admin). */
    boolean existsByRole(String role);
}
