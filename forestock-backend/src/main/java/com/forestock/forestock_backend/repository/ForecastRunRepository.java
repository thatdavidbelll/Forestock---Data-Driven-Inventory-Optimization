package com.forestock.forestock_backend.repository;

import com.forestock.forestock_backend.domain.ForecastRun;
import com.forestock.forestock_backend.domain.enums.ForecastStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ForecastRunRepository extends JpaRepository<ForecastRun, UUID> {

    // Most recent successfully completed run for a store
    Optional<ForecastRun> findTopByStoreIdAndStatusOrderByFinishedAtDesc(UUID storeId, ForecastStatus status);

    // Check whether an active run exists for a store (guard against overlapping runs)
    boolean existsByStoreIdAndStatus(UUID storeId, ForecastStatus status);

    List<ForecastRun> findByStoreIdOrderByStartedAtDesc(UUID storeId);

    // Legacy — unscoped (used by scheduler)
    Optional<ForecastRun> findTopByStatusOrderByFinishedAtDesc(ForecastStatus status);

    boolean existsByStatus(ForecastStatus status);

    List<ForecastRun> findAllByOrderByStartedAtDesc();
}
