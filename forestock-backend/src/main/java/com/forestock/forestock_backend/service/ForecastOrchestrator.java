package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.domain.ForecastRun;
import com.forestock.forestock_backend.domain.OrderSuggestion;
import com.forestock.forestock_backend.domain.Product;
import com.forestock.forestock_backend.domain.SalesTransaction;
import com.forestock.forestock_backend.domain.Store;
import com.forestock.forestock_backend.domain.StoreConfiguration;
import com.forestock.forestock_backend.domain.enums.ForecastStatus;
import com.forestock.forestock_backend.domain.enums.Urgency;
import com.forestock.forestock_backend.repository.ForecastRunRepository;
import com.forestock.forestock_backend.repository.ProductRepository;
import com.forestock.forestock_backend.repository.SalesTransactionRepository;
import com.forestock.forestock_backend.repository.StoreRepository;
import com.forestock.forestock_backend.security.TenantContext;
import com.forestock.forestock_backend.service.ForecastingEngine.ForecastResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Coordinates the full forecast cycle:
 * 1. Guard (no parallel runs)
 * 2. Load 365 days of sales data per product
 * 3. Fill missing days with 0
 * 4. Run ForecastingEngine (Holt-Winters per product)
 * 5. Get current stock
 * 6. Generate OrderSuggestions
 * 7. Backup to S3
 * 8. Notify via SNS
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ForecastOrchestrator {

    private final ForecastRunRepository forecastRunRepository;
    private final ProductRepository productRepository;
    private final SalesTransactionRepository salesRepository;
    private final StoreRepository storeRepository;
    private final InventoryService inventoryService;
    private final ForecastingEngine forecastingEngine;
    private final SuggestionEngine suggestionEngine;
    private final StoreConfigurationService storeConfigurationService;
    private final S3DataExportService s3ExportService;
    private final NotificationService notificationService;

    /**
     * Async entry point for store-scoped/manual triggers.
     * storeId must be captured from TenantContext BEFORE calling this method,
     * because @Async spawns a new thread where ThreadLocal is not inherited.
     */
    @Async
    @Transactional
    public void runForecast(UUID storeId, String triggeredBy) {
        if (storeId == null) {
            return;
        }

        TenantContext.setStoreId(storeId);
        try {
            Store store = storeRepository.findById(storeId).orElse(null);
            if (store != null) {
                runFullCycle(triggeredBy, store);
            }
        } finally {
            TenantContext.clear();
        }
    }

    /**
     * Runs the forecast cycle for every active store.
     * Called by DailyForecastJob where there is no per-tenant request context.
     */
    public void runForAllStores(String triggeredBy) {
        List<Store> activeStores = storeRepository.findAll()
                .stream()
                .filter(s -> Boolean.TRUE.equals(s.getActive()))
                .toList();
        log.info("Running nightly forecast for {} active stores", activeStores.size());
        for (Store store : activeStores) {
            runFullCycle(triggeredBy, store);
        }
    }

    /**
     * Synchronous cycle for a specific store.
     */
    public ForecastRun runFullCycle(String triggeredBy, Store store) {
        // Guard: prevent parallel runs for the same store
        if (forecastRunRepository.existsByStoreIdAndStatus(store.getId(), ForecastStatus.RUNNING)) {
            log.warn("Forecast already RUNNING for store {} — skipping run triggered by {}", store.getSlug(), triggeredBy);
            return null;
        }
        StoreConfiguration configuration = storeConfigurationService.getConfigForStore(store.getId());
        int horizonDays = configuration.getForecastHorizonDays();

        ForecastRun run;
        try {
            run = forecastRunRepository.save(ForecastRun.builder()
                    .store(store)
                    .status(ForecastStatus.RUNNING)
                    .startedAt(LocalDateTime.now())
                    .horizonDays(horizonDays)
                    .triggeredBy(triggeredBy)
                    .build());
        } catch (DataIntegrityViolationException e) {
            log.warn("Forecast already RUNNING for store {} — concurrent insert blocked", store.getSlug());
            return null;
        }

        log.info("Forecast run {} started for store {} (triggered by {})", run.getId(), store.getSlug(), triggeredBy);

        try {
            // Load sales data scoped to this store
            LocalDate from = LocalDate.now().minusDays(configuration.getLookbackDays());
            List<SalesTransaction> allSales = salesRepository.findAllFromDateByStore(from, store.getId());

            Map<UUID, List<SalesTransaction>> salesByProduct = allSales.stream()
                    .collect(Collectors.groupingBy(s -> s.getProduct().getId()));

            List<Product> products = productRepository.findByStoreIdAndActiveTrue(store.getId());
            log.info("Processing {} active products for store {}", products.size(), store.getSlug());

            Map<UUID, ForecastResult> forecastResults = new HashMap<>();
            int productsWithInsufficientData = 0;
            for (Product product : products) {
                List<SalesTransaction> productSales = salesByProduct.getOrDefault(product.getId(), List.of());
                List<Double> timeSeries = buildTimeSeries(productSales, from, LocalDate.now());
                if (timeSeries.size() < configuration.getMinHistoryDays()) {
                    productsWithInsufficientData++;
                }
                ForecastResult result = forecastingEngine.forecast(timeSeries, horizonDays, configuration);
                forecastResults.put(product.getId(), result);
            }

            // Get current stock — set tenant context temporarily for store-scoped query
            TenantContext.setStoreId(store.getId());
            Map<UUID, BigDecimal> currentStock;
            try {
                currentStock = inventoryService.getCurrentStockMap();
            } finally {
                TenantContext.clear();
            }

            List<OrderSuggestion> suggestions = suggestionEngine.generate(
                    products, currentStock, forecastResults, run, horizonDays, configuration);

            s3ExportService.backupSalesData(allSales, run.getId());
            s3ExportService.uploadForecastResults(forecastResults, run.getId());

            run.setStatus(ForecastStatus.COMPLETED);
            run.setFinishedAt(LocalDateTime.now());
            run.setProductsProcessed(products.size());
            run.setProductsWithInsufficientData(productsWithInsufficientData);
            run.setDurationSeconds((int) Duration.between(run.getStartedAt(), run.getFinishedAt()).getSeconds());
            forecastRunRepository.save(run);

            long criticalCount = suggestions.stream()
                    .filter(s -> s.getUrgency() == Urgency.CRITICAL)
                    .count();
            notificationService.sendForecastComplete(run, criticalCount);

            log.info("Forecast run {} COMPLETED for store {} — {} products, {} suggestions ({} CRITICAL)",
                    run.getId(), store.getSlug(), products.size(), suggestions.size(), criticalCount);

        } catch (Exception e) {
            log.error("Forecast run {} FAILED for store {}: {}", run.getId(), store.getSlug(), e.getMessage(), e);
            run.setStatus(ForecastStatus.FAILED);
            run.setFinishedAt(LocalDateTime.now());
            if (run.getStartedAt() != null) {
                run.setDurationSeconds((int) Duration.between(run.getStartedAt(), run.getFinishedAt()).getSeconds());
            }
            run.setErrorMessage(e.getMessage());
            forecastRunRepository.save(run);
            notificationService.sendForecastFailed(run);
        } finally {
            if (run != null && run.getStatus() == ForecastStatus.RUNNING) {
                run.setStatus(ForecastStatus.FAILED);
                forecastRunRepository.save(run);
            }
        }

        return run;
    }

    private List<Double> buildTimeSeries(List<SalesTransaction> sales, LocalDate from, LocalDate to) {
        Map<LocalDate, Double> salesMap = sales.stream()
                .collect(Collectors.toMap(
                        SalesTransaction::getSaleDate,
                        s -> s.getQuantitySold().doubleValue(),
                        Double::sum));

        List<Double> series = new ArrayList<>();
        LocalDate current = from;
        while (!current.isAfter(to)) {
            series.add(salesMap.getOrDefault(current, 0.0));
            current = current.plusDays(1);
        }
        return series;
    }
}
