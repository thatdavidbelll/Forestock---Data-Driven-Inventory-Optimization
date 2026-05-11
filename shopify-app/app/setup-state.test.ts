import { describe, expect, it } from "vitest";

import type { AppHomeOverviewResponse } from "./forestock.server";
import { getSetupStages } from "./setup-state";

function buildOverview(overrides: Partial<AppHomeOverviewResponse> = {}): AppHomeOverviewResponse {
  return {
    shopDomain: "paid-shop.myshopify.com",
    storeName: "Paid Shop",
    shopifyConnectionActive: true,
    planTier: "FREE",
    productLimit: 15,
    remainingProductSlots: 0,
    overProductLimit: false,
    planMessage: null,
    activeProductCount: 15,
    totalProductCount: 42,
    hasSalesHistory: true,
    salesTransactionCount: 320,
    latestSaleDate: "2026-05-11T12:00:00Z",
    forecastStatus: "COMPLETED",
    forecastCompletedAt: "2026-05-11T12:05:00Z",
    lastForecastStartedAt: "2026-05-11T12:01:00Z",
    forecastProof: {
      status: "COMPLETED",
      startedAt: "2026-05-11T12:01:00Z",
      finishedAt: "2026-05-11T12:05:00Z",
      durationSeconds: 240,
      productsProcessed: 42,
      productsWithInsufficientData: 0,
      horizonDays: 30,
      triggeredBy: "SYSTEM",
      errorMessage: null,
      readyForRecommendations: true,
    },
    recommendationReadinessReasons: [],
    criticalSuggestions: 0,
    highSuggestions: 0,
    totalActiveSuggestions: 0,
    topRecommendation: null,
    dataQualityWarnings: [],
    nextActions: [],
    ...overrides,
  };
}

describe("getSetupStages", () => {
  it("keeps the catalog stage completed for capped free-plan stores", () => {
    const stages = getSetupStages(buildOverview());
    const catalogStage = stages.find((stage) => stage.id === "catalog");

    expect(catalogStage?.status).toBe("completed");
    expect(catalogStage?.summary).toContain("42 products are mapped");
  });

  it("marks the catalog stage as ready to rerun after a paid upgrade if active products are still capped", () => {
    const stages = getSetupStages(
      buildOverview({
        planTier: "PAID",
        productLimit: null,
        remainingProductSlots: null,
      }),
    );
    const catalogStage = stages.find((stage) => stage.id === "catalog");

    expect(catalogStage?.status).toBe("ready_to_run");
    expect(catalogStage?.summary).toContain("Setup needs to run again");
    expect(catalogStage?.blockers).toContain(
      "Rerun setup after the paid upgrade so Forestock can reactivate Shopify-active products beyond the old free-plan cap.",
    );
  });

  it("keeps the catalog stage completed once the paid catalog is fully reactivated", () => {
    const stages = getSetupStages(
      buildOverview({
        planTier: "PAID",
        productLimit: null,
        remainingProductSlots: null,
        activeProductCount: 42,
      }),
    );
    const catalogStage = stages.find((stage) => stage.id === "catalog");

    expect(catalogStage?.status).toBe("completed");
  });
});
