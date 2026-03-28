package com.forestock.forestock_backend.repository;

import com.forestock.forestock_backend.domain.ForecastAccuracyResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ForecastAccuracyResultRepository extends JpaRepository<ForecastAccuracyResult, Long> {

    boolean existsByForecastRunId(UUID forecastRunId);

    @Query("""
            SELECT r FROM ForecastAccuracyResult r
            WHERE r.store.id = :storeId
            AND r.evaluationDate >= :fromDate
            AND r.mape IS NOT NULL
            ORDER BY r.evaluationDate DESC
            """)
    List<ForecastAccuracyResult> findRecentEvaluatedByStore(
            @Param("storeId") UUID storeId,
            @Param("fromDate") LocalDate fromDate);

    @Query("""
            SELECT AVG(r.mape) FROM ForecastAccuracyResult r
            WHERE r.forecastRun.id = :forecastRunId
            AND r.mape IS NOT NULL
            """)
    Optional<Double> findAverageMapeByForecastRunId(@Param("forecastRunId") UUID forecastRunId);

    @Query("""
            SELECT r FROM ForecastAccuracyResult r
            WHERE r.forecastRun.id = :forecastRunId
            AND r.mape IS NOT NULL
            """)
    List<ForecastAccuracyResult> findEvaluatedByForecastRunId(@Param("forecastRunId") UUID forecastRunId);
}
