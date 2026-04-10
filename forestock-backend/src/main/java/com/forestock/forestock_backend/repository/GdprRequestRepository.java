package com.forestock.forestock_backend.repository;

import com.forestock.forestock_backend.domain.GdprRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface GdprRequestRepository extends JpaRepository<GdprRequest, UUID> {
}
