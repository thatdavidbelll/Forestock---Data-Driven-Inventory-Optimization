import type { CSSProperties } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useEffect, useState } from "react";
import { useLoaderData, useRevalidator, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  AppShell,
  Badge,
  Card,
  DateTimeText,
  EmptyState,
  ErrorState,
  Grid,
  InsetPanel,
  KeyValueList,
  MetricCard,
  PlainButton,
  Section,
} from "../components";
import { authenticate } from "../shopify.server";
import { getForestockRecommendations } from "../forestock.server";

type RecommendationsData = Awaited<ReturnType<typeof loader>>;
type Recommendation = RecommendationsData["recommendations"][number];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { session } = await authenticate.admin(request);
    return await getForestockRecommendations(session.shop);
  } catch (error) {
    if (error instanceof Response) throw error;
    throw new Response(error instanceof Error ? error.message : "Failed to load recommendations.", {
      status: 500,
      statusText: "Recommendations Error",
    });
  }
};

function urgencyTone(urgency: string) {
  if (urgency === "CRITICAL") return "danger" as const;
  if (urgency === "HIGH") return "warning" as const;
  return "primary" as const;
}

function formatMetricNumber(value: number | null | undefined, suffix = "") {
  if (value == null) return "Unknown";
  return `${Number(value).toFixed(1)}${suffix}`;
}

function modelTone(forecastModel: string | null | undefined) {
  if (forecastModel === "HOLT_WINTERS") return "success" as const;
  if (forecastModel === "ZERO") return "warning" as const;
  return "subtle" as const;
}

function modelLabel(forecastModel: string | null | undefined) {
  if (forecastModel === "HOLT_WINTERS") return "Seasonal model";
  if (forecastModel === "ZERO") return "No demand signal";
  return "Forecast model";
}

function shouldShowModelBadge(forecastModel: string | null | undefined) {
  return forecastModel === "HOLT_WINTERS" || forecastModel === "ZERO";
}

function showsLowConfidence(
  forecastModel: string | null | undefined,
  lowConfidence: boolean | null | undefined,
) {
  return Boolean(lowConfidence) || forecastModel === "INTERMITTENT_FALLBACK";
}

function stockoutColor(daysOfStock: number | null | undefined): string {
  if (daysOfStock == null) return "var(--fs-text-muted)";
  if (daysOfStock <= 5) return "var(--fs-danger)";
  if (daysOfStock <= 10) return "var(--fs-warning)";
  return "var(--fs-text)";
}

function stableStockoutLabel(
  currentStock: number | null | undefined,
  daysOfStock: number | null | undefined,
): string {
  if (currentStock != null && currentStock <= 0) return "Out of stock now";
  if (daysOfStock != null && daysOfStock > 0) return `Runs out in about ${Math.round(daysOfStock)} days`;
  return "Stockout estimate unavailable";
}

function clientStockoutLabel(
  currentStock: number | null | undefined,
  daysOfStock: number | null | undefined,
): string {
  if (currentStock != null && currentStock <= 0) return "Out of stock now";
  if (daysOfStock == null || daysOfStock <= 0) return "Stockout estimate unavailable";

  const projectedDate = new Date();
  projectedDate.setDate(projectedDate.getDate() + Math.round(daysOfStock));
  return `Around ${projectedDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

function StockoutText({
  currentStock,
  daysOfStock,
}: {
  currentStock: number | null | undefined;
  daysOfStock: number | null | undefined;
}) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const label = hydrated
    ? clientStockoutLabel(currentStock, daysOfStock)
    : stableStockoutLabel(currentStock, daysOfStock);

  return <span suppressHydrationWarning>{label}</span>;
}

function checkboxStyle(checked: boolean): CSSProperties {
  return {
    width: 20,
    height: 20,
    borderRadius: "var(--space-xs)",
    accentColor: "var(--fs-primary)",
    border: checked ? "none" : "1px solid var(--fs-border-strong)",
    background: checked ? "var(--fs-primary)" : "var(--fs-white)",
    cursor: "pointer",
    flex: "0 0 auto",
  };
}

function recommendationSummary(recommendation: Recommendation) {
  if (showsLowConfidence(recommendation.forecastModel, recommendation.lowConfidence)) {
    return "Treat this suggestion as a starting point. Verify recent demand or supplier context before exporting it.";
  }
  if (recommendation.forecastModel === "HOLT_WINTERS") {
    return "This quantity is backed by a clearer seasonal pattern and current stock cover.";
  }
  if (recommendation.forecastModel === "ZERO") {
    return "Demand has been weak or inconsistent, so the quantity is deliberately conservative.";
  }
  return "This product has moved high enough in the recommendations list to justify review now.";
}

function recommendationSupportLine(recommendation: Recommendation) {
  const parts: string[] = [];

  if (recommendation.currentStock != null) {
    parts.push(`${formatMetricNumber(recommendation.currentStock)} in stock`);
  }

  if (recommendation.supplierName) {
    parts.push(recommendation.supplierName);
  }

  if (recommendation.estimatedOrderValue != null) {
    parts.push(`Estimated value ${formatMetricNumber(recommendation.estimatedOrderValue)}`);
  }

  return parts.join(" · ") || "No supplier or stock detail available";
}

export default function RecommendationsPage() {
  const data = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [generatingPo, setGeneratingPo] = useState(false);
  const [purchaseOrderError, setPurchaseOrderError] = useState<string | null>(null);
  const criticalCount = data.recommendations.filter((recommendation) => recommendation.urgency === "CRITICAL").length;
  const lowConfidenceCount = data.recommendations.filter((recommendation) =>
    showsLowConfidence(recommendation.forecastModel, recommendation.lowConfidence),
  ).length;

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const allSelected = data.recommendations.length > 0 &&
    data.recommendations.every((recommendation) => selectedIds.has(recommendation.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data.recommendations.map((recommendation) => recommendation.id)));
    }
  };

  const purchaseOrderHref = selectedIds.size > 0
    ? `/app/purchase-order?ids=${[...selectedIds].join(",")}`
    : null;

  const generatePurchaseOrder = async () => {
    if (!purchaseOrderHref || generatingPo) return;

    setGeneratingPo(true);
    setPurchaseOrderError(null);

    try {
      const response = await fetch(purchaseOrderHref, {
        method: "GET",
        credentials: "same-origin",
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "We could not generate the purchase order PDF.");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = "forestock-purchase-order.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setPurchaseOrderError(error instanceof Error ? error.message : "We could not generate the purchase order PDF.");
    } finally {
      setGeneratingPo(false);
    }
  };

  useEffect(() => {
    if (data.forecastStatus !== "RUNNING") return;

    let delay = 3000;
    const maxDelay = 15000;
    let timeoutId: ReturnType<typeof setTimeout>;

    const poll = () => {
      if (revalidator.state === "idle") {
        revalidator.revalidate();
      }
      delay = Math.min(delay * 1.5, maxDelay);
      timeoutId = setTimeout(poll, delay);
    };

    timeoutId = setTimeout(poll, delay);
    return () => clearTimeout(timeoutId);
  }, [data.forecastStatus, revalidator]);

  return (
    <AppShell
      title="Recommendations"
      subtitle="Review the forecast-backed restock list, keep only the products you trust, and export the next purchase order."
      actions={
        <Badge tone={criticalCount > 0 ? "danger" : data.recommendations.length > 0 ? "primary" : "success"}>
          {criticalCount > 0 ? `${criticalCount} critical` : data.recommendations.length > 0 ? "Recommendations ready" : "Nothing urgent"}
        </Badge>
      }
    >
      <Card>
        <div style={{ display: "grid", gap: "var(--space-xl)" }}>
          <div
            style={{
              display: "grid",
              gap: "var(--space-lg)",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))",
              alignItems: "start",
            }}
          >
            <div style={{ display: "grid", gap: "var(--space-sm)" }}>
              <div
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "var(--text-2xl)",
                  lineHeight: "var(--leading-tight)",
                  letterSpacing: "-0.02em",
                  fontWeight: "var(--weight-bold)",
                  color: "var(--fs-text)",
                  maxWidth: "18ch",
                }}
              >
                Keep this list tight and only export what belongs in the next order.
              </div>
              <div style={{ maxWidth: "60ch", fontSize: "var(--text-body)", lineHeight: "var(--leading-body)", color: "var(--fs-text-muted)" }}>
                {data.forecastCompletedAt
                  ? <>Forecast updated <DateTimeText value={data.forecastCompletedAt} />.</>
                  : "Recommendations update after each completed forecast run."}
              </div>
            </div>
            <InsetPanel>
              <KeyValueList
                items={[
                  { label: "Products", value: `${data.recommendations.length} to review` },
                  { label: "Critical", value: `${criticalCount}` },
                  { label: "Low confidence", value: `${lowConfidenceCount}` },
                ]}
              />
            </InsetPanel>
          </div>

          <Grid columns={4}>
            <MetricCard label="Selected" value={selectedIds.size} hint="Products in the next PDF" tone={selectedIds.size > 0 ? "primary" : "subtle"} />
            <MetricCard label="Critical" value={criticalCount} hint="Review these first" tone={criticalCount > 0 ? "danger" : "subtle"} />
            <MetricCard label="Low confidence" value={lowConfidenceCount} hint="Need manual judgment" tone={lowConfidenceCount > 0 ? "warning" : "subtle"} />
            <MetricCard label="Forecast" value={data.forecastStatus ?? "Pending"} hint={data.forecastCompletedAt ? <DateTimeText value={data.forecastCompletedAt} /> : "Waiting for the next run"} tone={data.forecastStatus === "COMPLETED" ? "success" : data.forecastStatus === "RUNNING" ? "primary" : "subtle"} />
          </Grid>
        </div>
      </Card>

      <Section title="Products to review" description="Urgency, confidence, and suggested restock quantity should be obvious before you commit anything to the purchase order.">
        <Card style={{ marginBottom: "var(--space-sm)" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "var(--space-md)",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <div style={{ display: "grid", gap: "var(--space-xs)" }}>
              <div
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "var(--text-lg)",
                  lineHeight: "var(--leading-tight)",
                  letterSpacing: "-0.01em",
                  fontWeight: "var(--weight-bold)",
                  color: "var(--fs-text)",
                }}
              >
                Select the products to include in this order.
              </div>
              <div style={{ fontSize: "var(--text-sm)", lineHeight: "var(--leading-body)", color: "var(--fs-text-muted)" }}>
                Low-confidence items still carry a quantity. Review them with extra care before export.
              </div>
            </div>
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--space-sm)",
                fontSize: "var(--text-sm)",
                color: "var(--fs-text-muted)",
                cursor: "pointer",
                fontWeight: "var(--weight-semibold)",
              }}
            >
              <input type="checkbox" checked={allSelected} onChange={toggleAll} style={checkboxStyle(allSelected)} />
              {allSelected ? "Deselect all" : "Select all"}
            </label>
          </div>
        </Card>

        {data.recommendations.length > 0 ? (
          <Card style={{ padding: 0, overflow: "hidden" }}>
            {purchaseOrderError ? (
              <div
                style={{
                  padding: "var(--space-md) var(--space-lg)",
                  fontSize: "var(--text-sm)",
                  lineHeight: "var(--leading-body)",
                  color: "var(--fs-danger)",
                  borderBottom: "1px solid var(--fs-border)",
                }}
              >
                {purchaseOrderError}
              </div>
            ) : null}

            {data.recommendations.map((recommendation, index) => {
              const reorderValue = recommendation.suggestedQty != null ? formatMetricNumber(recommendation.suggestedQty) : "Unknown";
              const selected = selectedIds.has(recommendation.id);

              return (
                <div
                  key={recommendation.id}
                  style={{
                    padding: "var(--space-xl)",
                    borderTop: purchaseOrderError || index > 0 ? "1px solid var(--fs-border)" : "none",
                    background: selected ? "color-mix(in oklab, var(--fs-primary) 5%, var(--fs-surface))" : "transparent",
                    transition: "background 0.14s ease",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gap: "var(--space-lg)",
                      gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))",
                      alignItems: "start",
                    }}
                  >
                    <div style={{ display: "grid", gap: "var(--space-md)", minWidth: 0 }}>
                      <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap" }}>
                        <Badge tone={urgencyTone(recommendation.urgency)}>{recommendation.urgency}</Badge>
                        {showsLowConfidence(recommendation.forecastModel, recommendation.lowConfidence) ? (
                          <Badge tone="warning">Low confidence</Badge>
                        ) : (
                          <Badge tone="success">Higher confidence</Badge>
                        )}
                        {recommendation.forecastModel && shouldShowModelBadge(recommendation.forecastModel) ? (
                          <Badge tone={modelTone(recommendation.forecastModel)}>{modelLabel(recommendation.forecastModel)}</Badge>
                        ) : null}
                      </div>

                      <div style={{ display: "grid", gap: "var(--space-xs)" }}>
                        <div
                          style={{
                            fontSize: "var(--text-xs)",
                            fontWeight: "var(--weight-bold)",
                            letterSpacing: "0.05em",
                            textTransform: "uppercase",
                            color: "var(--fs-text-muted)",
                          }}
                        >
                          {recommendation.productSku}
                        </div>
                        <div
                          style={{
                            fontFamily: "var(--font-heading)",
                            fontSize: "var(--text-xl)",
                            lineHeight: "var(--leading-tight)",
                            letterSpacing: "-0.01em",
                            fontWeight: "var(--weight-bold)",
                            color: "var(--fs-text)",
                            maxWidth: "24ch",
                          }}
                        >
                          {recommendation.productName}
                        </div>
                        <div style={{ maxWidth: "60ch", fontSize: "var(--text-sm)", lineHeight: "var(--leading-body)", color: "var(--fs-text-muted)" }}>
                          {recommendationSummary(recommendation)}
                        </div>
                        <div style={{ fontSize: "var(--text-xs)", lineHeight: "var(--leading-body)", color: "var(--fs-text-muted)" }}>
                          {recommendationSupportLine(recommendation)}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "grid", gap: "var(--space-lg)" }}>
                      <div
                        style={{
                          display: "grid",
                          gap: "var(--space-xs)",
                          padding: "var(--space-lg)",
                          borderRadius: "var(--space-md)",
                          border: "1px solid var(--fs-border)",
                          background: "var(--fs-surface-muted)",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "var(--text-xs)",
                            fontWeight: "var(--weight-bold)",
                            letterSpacing: "0.05em",
                            textTransform: "uppercase",
                            color: "var(--fs-text-muted)",
                          }}
                        >
                          Reorder now
                        </div>
                        <div
                          style={{
                            fontFamily: "var(--font-heading)",
                            fontSize: "var(--text-3xl)",
                            lineHeight: "var(--leading-tight)",
                            letterSpacing: "-0.02em",
                            fontWeight: "var(--weight-bold)",
                            color: "var(--fs-text)",
                          }}
                        >
                          {reorderValue}
                        </div>
                      </div>

                      <KeyValueList
                        items={[
                          {
                            label: "Stockout",
                            value: (
                              <span style={{ color: stockoutColor(recommendation.daysOfStock) }}>
                                <StockoutText currentStock={recommendation.currentStock} daysOfStock={recommendation.daysOfStock} />
                              </span>
                            ),
                          },
                          {
                            label: "Current stock",
                            value: recommendation.currentStock != null ? formatMetricNumber(recommendation.currentStock) : "Unknown",
                          },
                          {
                            label: "Confidence",
                            value: showsLowConfidence(recommendation.forecastModel, recommendation.lowConfidence) ? "Needs extra caution" : "Higher confidence",
                          },
                        ]}
                      />

                      <label
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "var(--space-sm)",
                          fontSize: "var(--text-sm)",
                          color: "var(--fs-text)",
                          fontWeight: "var(--weight-bold)",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleSelection(recommendation.id)}
                          style={checkboxStyle(selected)}
                          aria-label={`Select ${recommendation.productName}`}
                        />
                        Add to purchase order
                      </label>
                    </div>
                  </div>
                </div>
              );
            })}
          </Card>
        ) : (
          <EmptyState
            title={
              !data.forecastStatus || data.forecastStatus === "PENDING"
                ? "Your first forecast has not run yet"
                : data.forecastStatus === "RUNNING"
                  ? "Forecast is running"
                  : "Nothing needs reorder review right now"
            }
            body={
              !data.forecastStatus || data.forecastStatus === "PENDING"
                ? "Finish setup and wait for the first forecast run to complete. The purchase-order flow will appear here once recommendations are ready."
                : data.forecastStatus === "RUNNING"
                  ? "Forestock is updating reorder suggestions now. This page will refresh automatically when the run finishes."
                  : "Nothing currently stands out as needing reorder attention."
            }
          />
        )}
      </Section>

      <div
        style={{
          position: "sticky",
          bottom: "var(--space-sm)",
          zIndex: 2,
        }}
      >
        <Card tone="subtle" style={{ padding: "var(--space-md) var(--space-lg)", boxShadow: "var(--fs-shadow-md)" }}>
          <div
            style={{
              display: "grid",
              gap: "var(--space-md)",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))",
              alignItems: "center",
            }}
          >
            <div style={{ display: "grid", gap: "var(--space-xs)" }}>
              <div
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "var(--text-lg)",
                  lineHeight: "var(--leading-tight)",
                  letterSpacing: "-0.01em",
                  fontWeight: "var(--weight-bold)",
                  color: "var(--fs-text)",
                }}
              >
                Purchase order
              </div>
              <div style={{ fontSize: "var(--text-sm)", lineHeight: "var(--leading-body)", color: "var(--fs-text-muted)" }}>
                {selectedIds.size > 0
                  ? `${selectedIds.size} ${selectedIds.size === 1 ? "product is" : "products are"} ready for the purchase-order PDF.`
                  : "Select products from the recommendations list to build the purchase-order PDF."}
              </div>
            </div>
            <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <PlainButton
                type="button"
                onClick={() => setSelectedIds(new Set())}
                disabled={selectedIds.size === 0}
                tone="secondary"
              >
                Clear selection
              </PlainButton>
              <PlainButton type="button" onClick={generatePurchaseOrder} disabled={!purchaseOrderHref || generatingPo}>
                {generatingPo ? "Preparing PDF..." : "Export purchase order PDF"}
              </PlainButton>
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

export function ErrorBoundary() {
  return <ErrorState error={useRouteError()} />;
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
