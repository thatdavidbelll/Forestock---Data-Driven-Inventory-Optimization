package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.domain.ForecastRun;
import com.forestock.forestock_backend.domain.Store;
import com.forestock.forestock_backend.domain.enums.ForecastStatus;
import com.forestock.forestock_backend.repository.ForecastRunRepository;
import com.forestock.forestock_backend.security.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.NoSuchElementException;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ForecastServiceTest {

    @Mock
    private ForecastRunRepository forecastRunRepository;

    @Mock
    private ForecastAccuracyService forecastAccuracyService;

    @InjectMocks
    private ForecastService forecastService;

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void getRunById_throwsNotFound_whenRunBelongsToAnotherStore() {
        UUID requestStoreId = UUID.randomUUID();
        UUID otherStoreId = UUID.randomUUID();
        UUID runId = UUID.randomUUID();

        TenantContext.setStoreId(requestStoreId);
        when(forecastRunRepository.findById(runId)).thenReturn(Optional.of(
                ForecastRun.builder()
                        .id(runId)
                        .store(Store.builder().id(otherStoreId).build())
                        .status(ForecastStatus.COMPLETED)
                        .build()
        ));

        assertThatThrownBy(() -> forecastService.getRunById(runId))
                .isInstanceOf(NoSuchElementException.class)
                .hasMessage("Forecast run not found");
    }

    @Test
    void getRunById_includesModelPerformance() {
        UUID storeId = UUID.randomUUID();
        UUID runId = UUID.randomUUID();

        TenantContext.setStoreId(storeId);
        when(forecastRunRepository.findById(runId)).thenReturn(Optional.of(
                ForecastRun.builder()
                        .id(runId)
                        .store(Store.builder().id(storeId).build())
                        .status(ForecastStatus.COMPLETED)
                        .build()
        ));
        when(forecastAccuracyService.getModelPerformance(runId)).thenReturn(
                new ForecastAccuracyService.ModelPerformance(
                        Map.of("INTERMITTENT_FALLBACK", 3L),
                        Map.of("INTERMITTENT_FALLBACK", java.math.BigDecimal.valueOf(12.34))
                )
        );

        var dto = forecastService.getRunById(runId);

        assertThat(dto.getModelUsage()).containsEntry("INTERMITTENT_FALLBACK", 3L);
        assertThat(dto.getModelMape()).containsEntry("INTERMITTENT_FALLBACK", java.math.BigDecimal.valueOf(12.34));
    }
}
