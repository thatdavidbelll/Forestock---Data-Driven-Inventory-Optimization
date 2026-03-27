package com.forestock.forestock_backend.repository;

import com.forestock.forestock_backend.domain.Store;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface StoreRepository extends JpaRepository<Store, UUID> {
    Optional<Store> findBySlug(String slug);
    boolean existsBySlug(String slug);
}
