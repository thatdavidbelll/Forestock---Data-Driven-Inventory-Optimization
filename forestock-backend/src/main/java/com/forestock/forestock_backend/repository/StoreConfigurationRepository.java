package com.forestock.forestock_backend.repository;

import com.forestock.forestock_backend.domain.StoreConfiguration;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface StoreConfigurationRepository extends JpaRepository<StoreConfiguration, UUID> {
    Optional<StoreConfiguration> findByStoreId(UUID storeId);
}
