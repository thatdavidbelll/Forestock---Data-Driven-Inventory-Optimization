import type { CSSProperties } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useEffect, useState } from "react";
import { useLoaderData, useRevalidator, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  AppShell,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  formatDateTime,
  Grid,
  KeyValueList,
  MetricCard,
  Section,
} from "../components";
import { authenticate } from "../shopify.server";
import { getForestockRecommendations } from "../forestock.server";

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
  if (urgency === "CRITICAL") return "critical" as const;
  if (urgency === "HIGH") return "warning" as const;
  return "accent" as const;
}

function formatMetricNumber(value: number | null | undefined, suffix = "") {
  if (value == null) return "Not available";
  return `${Number(value).toFixed(1)}${suffix}`;
}

function modelTone(forecastModel: string | null | undefined) {
  if (forecastModel === "HOLT_WINTERS") return "success" as const;
  if (forecastModel === "ZERO") return "warning" as const;
  return "subtle" as const;
}

function modelLabel(forecastModel: string | null | undefined) {
  if (forecastModel === "HOLT_WINTERS") return "Seasonal model";
  if (forecastModel === "INTERMITTENT_FALLBACK") return "Conservative fallback";
  if (forecastModel === "ZERO") return "No demand signal";
  return "Forecast model";
}

const modelTooltip: Record<string, string> = {
  HOLT_WINTERS: "Seasonal model — uses your past 12 months of sales patterns to forecast demand.",
  INTERMITTENT_FALLBACK: "Conservative fallback — used when demand is uneven or sparse. Treats each sale as a signal.",
  ZERO: "No demand signal — this product has no meaningful recent sales history. The recommendation is intentionally conservative.",
}

function projectedStockoutDate(daysOfStock: number | null | undefined): string | null {
  if (daysOfStock == null || daysOfStock <= 0) return null
  const d = new Date()
  d.setDate(d.getDate() + Math.round(daysOfStock))
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function stockoutColor(daysOfStock: number | null | undefined): string {
  if (daysOfStock == null) return "#6B7280"
  if (daysOfStock <= 5) return "#B42318"
  if (daysOfStock <= 10) return "#A16207"
  return "#6B7280"
}

function checkboxStyle(checked: boolean): CSSProperties {
  return {
    appearance: "none",
    WebkitAppearance: "none" as CSSProperties["WebkitAppearance"],
    width: 18,
    height: 18,
    borderRadius: 6,
    border: checked ? "1px solid var(--fs-indigo)" : "1px solid #CBD5E1",
    background: checked
      ? "linear-gradient(180deg, #4F46E5 0%, #4338CA 100%)"
      : "linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)",
    boxShadow: checked
      ? "0 10px 18px rgba(79, 70, 229, 0.24)"
      : "inset 0 1px 0 rgba(255,255,255,0.85), 0 2px 6px rgba(15, 23, 42, 0.06)",
    cursor: "pointer",
    display: "inline-grid",
    placeItems: "center",
    position: "relative" as const,
    flex: "0 0 auto",
    backgroundImage: checked
      ? "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='white' d='M6.2 11.6 2.9 8.3l1.1-1.1 2.2 2.2 5.1-5.1 1.1 1.1z'/%3E%3C/svg%3E\")"
      : "none",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "center",
    backgroundSize: "12px 12px",
  }
}

export default function RecommendationsPage() {
  const data = useLoaderData<typeof loader>();
  const revalidator = useRevalidator()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [generatingPo, setGeneratingPo] = useState(false)
  const [purchaseOrderError, setPurchaseOrderError] = useState<string | null>(null)
  const criticalCount = data.recommendations.filter((recommendation) => recommendation.urgency === "CRITICAL").length;

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  const allSelected = data.recommendations.length > 0 &&
    data.recommendations.every((r) => selectedIds.has(r.id))

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(data.recommendations.map((r) => r.id)))
    }
  }

  const purchaseOrderHref = selectedIds.size > 0
    ? `/app/purchase-order?ids=${[...selectedIds].join(",")}`
    : null

  const generatePurchaseOrder = async () => {
    if (!purchaseOrderHref || generatingPo) return

    setGeneratingPo(true)
    setPurchaseOrderError(null)

    try {
      const response = await fetch(purchaseOrderHref, {
        method: "GET",
        credentials: "same-origin",
      })

      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || "Failed to generate purchase order")
      }

      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = objectUrl
      link.download = "forestock-purchase-order.pdf"
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(objectUrl)
    } catch (error) {
      setPurchaseOrderError(error instanceof Error ? error.message : "Failed to generate purchase order")
    } finally {
      setGeneratingPo(false)
    }
  }

  useEffect(() => {
    if (data.forecastStatus !== "RUNNING") return

    let delay = 3_000
    const maxDelay = 15_000
    let timeoutId: ReturnType<typeof setTimeout>

    const poll = () => {
      if (revalidator.state === "idle") {
        revalidator.revalidate()
      }
      delay = Math.min(delay * 1.5, maxDelay)
      timeoutId = setTimeout(poll, delay)
    }

    timeoutId = setTimeout(poll, delay)
    return () => clearTimeout(timeoutId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.forecastStatus])

  return (
    <AppShell title="Recommendations">
      {data.forecastCompletedAt && (() => {
        const hoursSinceLastRun = (Date.now() - new Date(data.forecastCompletedAt!).getTime()) / 3_600_000
        const freshnessMessage =
          data.forecastStatus === "RUNNING"
            ? "New forecast running — recommendations will update shortly."
            : hoursSinceLastRun < 24
              ? "Forecast is fresh (updated today)."
              : hoursSinceLastRun < 72
                ? `Forecast is ${Math.floor(hoursSinceLastRun / 24)} day(s) old — will refresh tonight at 2:00 UTC.`
                : `Forecast is ${Math.floor(hoursSinceLastRun / 24)} days old — consider running setup again from Settings.`
        return (
          <div style={{ marginBottom: 16, fontSize: 13, color: "#6B7280" }}>
            {freshnessMessage}
          </div>
        )
      })()}
      <Grid columns={3}>
        <MetricCard label="In queue" value={data.recommendations.length} hint="Products needing review now" />
        <MetricCard label="Critical" value={criticalCount} hint="Highest urgency recommendations" tone={criticalCount > 0 ? "critical" : "subtle"} />
        <MetricCard label="Forecast status" value={data.forecastStatus ?? "Pending"} hint={data.forecastCompletedAt ? `Updated ${formatDateTime(data.forecastCompletedAt)}` : "No completed forecast yet"} tone={data.forecastStatus?.toUpperCase().includes("COMPLETED") ? "success" : "warning"} />
      </Grid>

      <div style={{ marginTop: 12, paddingBottom: selectedIds.size > 0 ? 108 : 0 }}>
        <Section title="Queue" description="Keep the list direct and easy to scan.">
        {data.recommendations.length > 0 ? (
          <>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 16,
              flexWrap: "wrap",
            }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#6B7280", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  style={checkboxStyle(allSelected)}
                />
                {allSelected ? "Deselect all" : "Select all"}
              </label>
              <div style={{ fontSize: 13, color: "#64748B" }}>
                Select products to generate one purchase order PDF.
              </div>
            </div>
            {purchaseOrderError ? (
              <div style={{ marginBottom: 16, fontSize: 13, color: "#B42318" }}>
                {purchaseOrderError}
              </div>
            ) : null}
            <Grid columns={2}>
            {data.recommendations.map((recommendation) => {
              const tone = urgencyTone(recommendation.urgency);
              return (
                <Card key={recommendation.id} style={{ padding: 20 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 12,
                      flexWrap: "wrap",
                      marginBottom: 14,
                    }}
                  >
                    <div style={{ minWidth: 0, flex: "1 1 240px" }}>
                      <div
                        style={{
                          fontFamily: '"Space Grotesk", "Manrope", sans-serif',
                          fontSize: 24,
                          lineHeight: 1.06,
                          letterSpacing: "-0.04em",
                          fontWeight: 700,
                          color: "#0F172A",
                          marginBottom: 8,
                        }}
                      >
                        {recommendation.productName}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#6B7280" }}>
                        {recommendation.productSku}
                        {recommendation.productCategory ? ` • ${recommendation.productCategory}` : ""}
                      </div>
                      {recommendation.lowConfidence ? (
                        <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.5, color: "#92400E" }}>
                          <span title="This recommendation is based on limited sales history. Treat the suggested quantity as directional, not precise.">
                            Low confidence{recommendation.historyDaysAtGeneration != null ? ` • ${recommendation.historyDaysAtGeneration} sales days observed` : ""}
                          </span>
                        </div>
                      ) : null}
                      {recommendation.forecastModel ? (
                        <div style={{ marginTop: recommendation.lowConfidence ? 8 : 10, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                          <span title={modelTooltip[recommendation.forecastModel ?? ""] ?? ""}>
                            <Badge tone={modelTone(recommendation.forecastModel)}>{modelLabel(recommendation.forecastModel)}</Badge>
                          </span>
                          <div style={{ fontSize: 13, lineHeight: 1.5, color: "#64748B" }}>
                            {recommendation.forecastModel === "HOLT_WINTERS"
                              ? "Using the stronger seasonal model."
                              : recommendation.forecastModel === "INTERMITTENT_FALLBACK"
                                ? "Using the conservative fallback because demand is uneven."
                                : "Using a minimal demand signal path."}
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 10 }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(recommendation.id)}
                        onChange={() => toggleSelection(recommendation.id)}
                        style={checkboxStyle(selectedIds.has(recommendation.id))}
                        aria-label={`Select ${recommendation.productName}`}
                      />
                      <Badge tone={tone}>{recommendation.urgency}</Badge>
                    </div>
                  </div>
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #E5E7EB" }}>
                    <Grid columns={2}>
                      <MetricCard
                        label="Days left"
                        value={recommendation.daysOfStock != null ? formatMetricNumber(recommendation.daysOfStock, "d") : "Unknown"}
                        hint={
                          projectedStockoutDate(recommendation.daysOfStock)
                            ? `Runs out ~${projectedStockoutDate(recommendation.daysOfStock)}`
                            : undefined
                        }
                        tone="subtle"
                      />
                      <MetricCard label="Reorder qty" value={recommendation.suggestedQty != null ? formatMetricNumber(recommendation.suggestedQty) : "Unknown"} tone="subtle" />
                    </Grid>
                    {recommendation.daysOfStock != null && recommendation.daysOfStock <= 10 && (
                      <div style={{
                        marginTop: 8,
                        fontSize: 12,
                        fontWeight: 600,
                        color: stockoutColor(recommendation.daysOfStock),
                      }}>
                        Runs out ~{projectedStockoutDate(recommendation.daysOfStock)}
                      </div>
                    )}
                  </div>
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #E5E7EB" }}>
                    <KeyValueList
                      items={[
                        { label: "Current stock", value: recommendation.currentStock != null ? formatMetricNumber(recommendation.currentStock) : "Not available" },
                        { label: "Estimated value", value: recommendation.estimatedOrderValue != null ? recommendation.estimatedOrderValue.toFixed(2) : "Unknown" },
                        { label: "Supplier", value: recommendation.supplierName ?? "Not set" },
                        { label: "Generated", value: formatDateTime(recommendation.generatedAt) },
                      ]}
                    />
                  </div>
                </Card>
              );
            })}
            </Grid>
          </>
        ) : (
          <EmptyState
            title={
              !data.forecastStatus || data.forecastStatus === "PENDING"
                ? "No forecast has run yet"
                : data.forecastStatus === "RUNNING"
                  ? "Forecast is running…"
                  : "Everything looks well-stocked"
            }
            body={
              !data.forecastStatus || data.forecastStatus === "PENDING"
                ? "Go to Settings and run setup to sync your catalog, import order history, and generate your first forecast."
                : data.forecastStatus === "RUNNING"
                  ? "Your forecast is in progress. This page will update automatically when it completes."
                  : "No products are flagged for reordering right now. Check back after your next forecast runs tonight."
            }
          />
        )}
        </Section>
      </div>
      {selectedIds.size > 0 ? (
        <div
          style={{
            position: "fixed",
            left: "50%",
            bottom: 20,
            transform: "translateX(-50%)",
            zIndex: 30,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 14px",
            borderRadius: 16,
            background: "rgba(15, 23, 42, 0.92)",
            color: "#ffffff",
            boxShadow: "0 18px 40px rgba(15, 23, 42, 0.22)",
            backdropFilter: "blur(14px)",
            maxWidth: "calc(100vw - 24px)",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>
            {selectedIds.size} selected
          </div>
          <button
            type="button"
            onClick={generatePurchaseOrder}
            disabled={generatingPo}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "10px 16px",
              borderRadius: 12,
              background: "#ffffff",
              color: "#0F172A",
              border: "none",
              fontSize: 13,
              fontWeight: 800,
              cursor: generatingPo ? "wait" : "pointer",
              opacity: generatingPo ? 0.72 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {generatingPo ? "Generating PO..." : "Generate PO"}
          </button>
        </div>
      ) : null}
    </AppShell>
  );
}

export function ErrorBoundary() {
  return <ErrorState error={useRouteError()} />;
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
