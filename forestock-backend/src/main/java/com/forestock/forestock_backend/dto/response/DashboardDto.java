package com.forestock.forestock_backend.dto.response;

import com.forestock.forestock_backend.domain.enums.ForecastStatus;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
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
    private AccuracyScore accuracyScore;
    private List<AlertTrendPoint> alertTrend;
    private List<CriticalSuggestion> topCritical;
    private List<SalesVelocityPoint> salesVelocityTrend;
    private List<String> dataQualityWarnings;
    private List<CategorySummary> categorySummaries;

    @Data
    @Builder
    public static class AccuracyScore {
        private BigDecimal lastRunMape;
        private String trend;
        private int evaluatedForecasts;
    }

    @Data
    @Builder
    public static class AlertTrendPoint {
        private String date;
        private long critical;
        private long high;
    }

    @Data
    @Builder
    public static class CriticalSuggestion {
        private String productName;
        private String sku;
        private BigDecimal daysOfStock;
        private BigDecimal suggestedQty;
        private BigDecimal estimatedOrderValue;
    }

    @Data
    @Builder
    public static class SalesVelocityPoint {
        private String date;
        private BigDecimal totalUnitsSold;
    }

    @Data
    @Builder
    public static class CategorySummary {
        private String category;
        private long productCount;
        private long alertCount;
    }
}
