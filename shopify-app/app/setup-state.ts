import type { AppHomeOverviewResponse } from "./forestock.server";

export type SetupStageStatus =
  | "not_started"
  | "ready_to_run"
  | "running"
  | "completed"
  | "blocked"
  | "failed";

export type SetupStage = {
  id: "provision" | "catalog" | "orders" | "forecast" | "recommendations";
  step: string;
  title: string;
  status: SetupStageStatus;
  summary: string;
  successLooksLike: string;
  blockers: string[];
  evidenceAt: string | null;
  evidenceLabel: string | null;
};

function includesToken(value: string | null | undefined, token: string) {
  return value?.toUpperCase().includes(token) ?? false;
}

export function getSetupStages(overview: AppHomeOverviewResponse): SetupStage[] {
  const forecastStatus = overview.forecastProof?.status ?? overview.forecastStatus;
  const forecastRunning = includesToken(forecastStatus, "RUNNING") || includesToken(forecastStatus, "PENDING");
  const forecastFailed = includesToken(forecastStatus, "FAILED") || includesToken(forecastStatus, "ERROR");
  const forecastCompleted = includesToken(forecastStatus, "COMPLETED");
  const recommendationsReady =
    overview.recommendationReadinessReasons.length === 0 &&
    Boolean(overview.forecastProof?.readyForRecommendations);

  const provision: SetupStage = {
    id: "provision",
    step: "Step 1",
    title: "Link store to Forestock",
    status: overview.shopifyConnectionActive ? "completed" : "ready_to_run",
    summary: overview.shopifyConnectionActive
      ? "The Shopify store is linked to an active Forestock workspace."
      : "The Shopify store still needs to be linked to a Forestock workspace.",
    successLooksLike: "The store is linked to a Forestock workspace and the connection remains active.",
    blockers: overview.shopifyConnectionActive ? [] : ["The Shopify connection is not active yet."],
    evidenceAt: null,
    evidenceLabel: null,
  };

  const catalogBlocked = !overview.shopifyConnectionActive;
  const catalogCompleted = overview.totalProductCount > 0;
  const catalog: SetupStage = {
    id: "catalog",
    step: "Step 2",
    title: "Import catalog and inventory",
    status: catalogCompleted ? "completed" : catalogBlocked ? "blocked" : "ready_to_run",
    summary: catalogCompleted
      ? `${overview.totalProductCount} products are mapped into Forestock, including ${overview.activeProductCount} active items.`
      : catalogBlocked
        ? "Catalog import is blocked until the Shopify store is linked."
        : "Catalog and inventory still need to be imported into Forestock.",
    successLooksLike: "Products are processed, created or updated, and inventory snapshots are recorded.",
    blockers: catalogBlocked ? ["Link the store first so catalog data has a target workspace."] : [],
    evidenceAt: null,
    evidenceLabel: null,
  };

  const ordersBlocked = !overview.shopifyConnectionActive || !catalogCompleted;
  const ordersCompleted = overview.hasSalesHistory;
  const orders: SetupStage = {
    id: "orders",
    step: "Step 3",
    title: "Import order history",
    status: ordersCompleted ? "completed" : ordersBlocked ? "blocked" : "ready_to_run",
    summary: ordersCompleted
      ? `${overview.salesTransactionCount} sales rows are present in Forestock.`
      : ordersBlocked
        ? "Order import is blocked until linkage and catalog import are in place."
        : "Historical order data still needs to be imported for demand signals.",
    successLooksLike: "Orders are imported, line items are matched, and sales rows are written for forecasting.",
    blockers: ordersBlocked
      ? [
          !overview.shopifyConnectionActive
            ? "Link the store before trying to import order history."
            : "Import catalog first so order line items can match products cleanly.",
        ]
      : [],
    evidenceAt: overview.latestSaleDate,
    evidenceLabel: overview.latestSaleDate ? "Latest sale date" : null,
  };

  const forecastBlocked = !catalogCompleted || !ordersCompleted;
  const forecast: SetupStage = {
    id: "forecast",
    step: "Step 4",
    title: "Confirm forecast proof",
    status: forecastCompleted
      ? "completed"
      : forecastRunning
        ? "running"
        : forecastFailed
          ? "failed"
          : forecastBlocked
            ? "blocked"
            : "ready_to_run",
    summary: forecastCompleted
      ? "A completed backend forecast run exists for this store."
      : forecastRunning
        ? "The backend forecast engine is currently running."
        : forecastFailed
          ? overview.forecastProof?.errorMessage || "The latest backend forecast run failed."
          : forecastBlocked
            ? "Forecast proof is blocked until both catalog and order history are in place."
            : "No completed forecast proof exists yet for this store.",
    successLooksLike: "A backend forecast run exists with explicit started/finished evidence and no unresolved failure.",
    blockers: forecastBlocked
      ? [
          !catalogCompleted
            ? "Import catalog and inventory before expecting forecast proof."
            : "Import order history before expecting trustworthy forecast proof.",
        ]
      : forecastFailed && overview.forecastProof?.errorMessage
        ? [overview.forecastProof.errorMessage]
        : [],
    evidenceAt: overview.forecastProof?.finishedAt ?? overview.forecastProof?.startedAt ?? null,
    evidenceLabel: overview.forecastProof?.finishedAt
      ? "Forecast finished"
      : overview.forecastProof?.startedAt
        ? "Forecast started"
        : null,
  };

  const recommendationsBlocked = !forecastCompleted || overview.recommendationReadinessReasons.length > 0;
  const recommendations: SetupStage = {
    id: "recommendations",
    step: "Step 5",
    title: "Recommendations ready",
    status: recommendationsReady ? "completed" : recommendationsBlocked ? "blocked" : "ready_to_run",
    summary: recommendationsReady
      ? "The shared recommendation pipeline is ready for merchant review."
      : "Recommendation trust is still blocked by setup or forecast gaps.",
    successLooksLike: "The recommendations page exposes a usable review surface backed by the shared forecast engine.",
    blockers: recommendationsReady ? [] : overview.recommendationReadinessReasons,
    evidenceAt: overview.forecastProof?.finishedAt ?? null,
    evidenceLabel: overview.forecastProof?.finishedAt ? "Underlying forecast finished" : null,
  };

  return [provision, catalog, orders, forecast, recommendations];
}
