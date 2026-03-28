package com.forestock.forestock_backend.repository;

import com.forestock.forestock_backend.domain.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.UUID;

public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {

    @Query(value = """
            SELECT a FROM AuditLog a
            WHERE a.store.id = :storeId
            AND (:action IS NULL OR a.action = :action)
            AND (:actor IS NULL OR LOWER(a.actorUsername) LIKE LOWER(CONCAT('%', :actor, '%')))
            AND (:from IS NULL OR a.occurredAt >= :from)
            AND (:to IS NULL OR a.occurredAt <= :to)
            ORDER BY a.occurredAt DESC
            """,
           countQuery = """
            SELECT COUNT(a) FROM AuditLog a
            WHERE a.store.id = :storeId
            AND (:action IS NULL OR a.action = :action)
            AND (:actor IS NULL OR LOWER(a.actorUsername) LIKE LOWER(CONCAT('%', :actor, '%')))
            AND (:from IS NULL OR a.occurredAt >= :from)
            AND (:to IS NULL OR a.occurredAt <= :to)
            """)
    Page<AuditLog> findByStoreFiltered(
            @Param("storeId") UUID storeId,
            @Param("action") String action,
            @Param("actor") String actor,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to,
            Pageable pageable);

    @Query("""
            SELECT a FROM AuditLog a
            WHERE a.store.id = :storeId
            AND (:action IS NULL OR a.action = :action)
            AND (:actor IS NULL OR LOWER(a.actorUsername) LIKE LOWER(CONCAT('%', :actor, '%')))
            AND (:from IS NULL OR a.occurredAt >= :from)
            AND (:to IS NULL OR a.occurredAt <= :to)
            ORDER BY a.occurredAt DESC
            """)
    java.util.List<AuditLog> findAllByStoreFiltered(
            @Param("storeId") UUID storeId,
            @Param("action") String action,
            @Param("actor") String actor,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to);
}
