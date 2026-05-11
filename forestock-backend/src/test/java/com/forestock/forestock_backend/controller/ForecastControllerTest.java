package com.forestock.forestock_backend.controller;

import com.forestock.forestock_backend.repository.ForecastRunRepository;
import com.forestock.forestock_backend.security.TenantContext;
import com.forestock.forestock_backend.service.ForecastOrchestrator;
import com.forestock.forestock_backend.service.ForecastService;
import com.forestock.forestock_backend.service.StorePlanService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;

class ForecastControllerTest {

    @Test
    void triggerRun_returnsConflictWhenForecastIsBlockedByFreeTier() {
        UUID storeId = UUID.fromString("00000000-0000-0000-0000-000000000001");
        ForecastOrchestrator forecastOrchestrator = mock(ForecastOrchestrator.class);
        ForecastService forecastService = mock(ForecastService.class);
        ForecastRunRepository forecastRunRepository = mock(ForecastRunRepository.class);
        StorePlanService storePlanService = mock(StorePlanService.class);

        doThrow(new IllegalStateException("This store has 18 active products on the Free plan. Reduce active products to 15 or upgrade to resume forecasting."))
                .when(storePlanService).assertForecastAllowed(storeId);

        ForecastController controller = new ForecastController(
                forecastOrchestrator,
                forecastService,
                forecastRunRepository,
                storePlanService
        );

        TenantContext.setStoreId(storeId);
        try {
            var response = controller.triggerRun();
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().getMessage())
                    .isEqualTo("This store has 18 active products on the Free plan. Reduce active products to 15 or upgrade to resume forecasting.");
        } finally {
            TenantContext.clear();
        }
    }
}
