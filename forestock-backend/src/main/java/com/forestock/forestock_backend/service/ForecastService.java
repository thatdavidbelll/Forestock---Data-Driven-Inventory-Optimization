package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.domain.ForecastRun;
import com.forestock.forestock_backend.domain.enums.ForecastStatus;
import com.forestock.forestock_backend.dto.response.ForecastRunDto;
import com.forestock.forestock_backend.repository.ForecastRunRepository;
import com.forestock.forestock_backend.security.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ForecastService {

    private final ForecastRunRepository forecastRunRepository;

    @Transactional(readOnly = true)
    public List<ForecastRunDto> getAllRuns() {
        UUID storeId = TenantContext.getStoreId();
        List<ForecastRun> runs = storeId != null
                ? forecastRunRepository.findByStoreIdOrderByStartedAtDesc(storeId)
                : forecastRunRepository.findAllByOrderByStartedAtDesc();
        return runs.stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public ForecastRunDto getRunById(UUID id) {
        return forecastRunRepository.findById(id)
                .map(this::toDto)
                .orElseThrow(() -> new NoSuchElementException("Forecast run not found: " + id));
    }

    @Transactional(readOnly = true)
    public ForecastRunDto getLatestCompletedRun() {
        UUID storeId = TenantContext.getStoreId();
        return (storeId != null
                ? forecastRunRepository.findTopByStoreIdAndStatusOrderByFinishedAtDesc(storeId, ForecastStatus.COMPLETED)
                : forecastRunRepository.findTopByStatusOrderByFinishedAtDesc(ForecastStatus.COMPLETED))
                .map(this::toDto)
                .orElseThrow(() -> new NoSuchElementException("No completed forecast run found"));
    }

    private ForecastRunDto toDto(ForecastRun run) {
        Long durationSeconds = null;
        if (run.getStartedAt() != null && run.getFinishedAt() != null) {
            durationSeconds = ChronoUnit.SECONDS.between(run.getStartedAt(), run.getFinishedAt());
        }
        return ForecastRunDto.builder()
                .id(run.getId())
                .status(run.getStatus())
                .startedAt(run.getStartedAt())
                .finishedAt(run.getFinishedAt())
                .horizonDays(run.getHorizonDays())
                .triggeredBy(run.getTriggeredBy())
                .errorMessage(run.getErrorMessage())
                .durationSeconds(durationSeconds)
                .productsWithInsufficientData(run.getProductsWithInsufficientData())
                .mape(run.getMape())
                .rmse(run.getRmse())
                .build();
    }
}
