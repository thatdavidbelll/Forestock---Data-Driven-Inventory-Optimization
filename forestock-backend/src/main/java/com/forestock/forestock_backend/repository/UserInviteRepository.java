package com.forestock.forestock_backend.repository;

import com.forestock.forestock_backend.domain.UserInvite;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserInviteRepository extends JpaRepository<UserInvite, UUID> {
    List<UserInvite> findByStoreIdOrderByCreatedAtDesc(UUID storeId);
    Optional<UserInvite> findByIdAndStoreId(UUID id, UUID storeId);
    Optional<UserInvite> findByInviteToken(String inviteToken);
    boolean existsByStoreIdAndEmailAndAcceptedAtIsNull(UUID storeId, String email);
}
