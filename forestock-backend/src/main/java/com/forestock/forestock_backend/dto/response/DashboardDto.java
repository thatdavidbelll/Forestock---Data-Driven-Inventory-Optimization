package com.forestock.forestock_backend.dto.response;

import com.forestock.forestock_backend.domain.enums.ForecastStatus;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class DashboardDto {
    private long totalActiveProducts;
    private long alertsCount;           // produse sub reorder_point
    private long criticalCount;         // sugestii cu urgency CRITICAL
    private long highCount;             // sugestii cu urgency HIGH
    private ForecastStatus lastRunStatus;
    private LocalDateTime lastRunAt;
    private List<CategorySummary> categorySummaries;

    @Data
    @Builder
    public static class CategorySummary {
        private String category;
        private long productCount;
        private long alertCount;
    }
}
