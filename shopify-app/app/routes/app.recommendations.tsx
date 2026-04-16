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
  if (forecastModel === "ZERO") return "No demand signal";
  return "Forecast model";
}

function shouldShowModelBadge(forecastModel: string | null | undefined) {
  return forecastModel === "HOLT_WINTERS" || forecastModel === "ZERO";
}

const modelTooltip: Record<string, string> = {
  HOLT_WINTERS: "Seasonal model — uses your past 12 months of sales patterns to forecast demand.",
  ZERO: "No demand signal — this product has no meaningful recent sales history. The recommendation is intentionally conservative.",
}

function showsLowConfidence(
  forecastModel: string | null | undefined,
  lowConfidence: boolean | null | undefined,
) {
  return Boolean(lowConfidence) || forecastModel === "INTERMITTENT_FALLBACK";
}

function stockoutColor(daysOfStock: number | null | undefined): string {
  if (daysOfStock == null) return "#6B7280"
  if (daysOfStock <= 5) return "#B42318"
  if (daysOfStock <= 10) return "#A16207"
  return "#6B7280"
}

function stableStockoutLabel(
  currentStock: number | null | undefined,
  daysOfStock: number | null | undefined,
): string {
  if (currentStock != null && currentStock <= 0) return "Out of stock now"
  if (daysOfStock != null && daysOfStock > 0) return `Runs out in ~${Math.round(daysOfStock)}d`
  return "Stockout estimate unavailable"
}

function clientStockoutLabel(
  currentStock: number | null | undefined,
  daysOfStock: number | null | undefined,
): string {
  if (currentStock != null && currentStock <= 0) return "Out of stock now"
  if (daysOfStock == null || daysOfStock <= 0) return "Stockout estimate unavailable"

  const projectedDate = new Date()
  projectedDate.setDate(projectedDate.getDate() + Math.round(daysOfStock))
  return `Runs out ~${projectedDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
}

function StockoutText({
  currentStock,
  daysOfStock,
}: {
  currentStock: number | null | undefined;
  daysOfStock: number | null | undefined;
}) {
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  const label = hydrated
    ? clientStockoutLabel(currentStock, daysOfStock)
    : stableStockoutLabel(currentStock, daysOfStock)

  return <span suppressHydrationWarning>{label}</span>
}

function checkboxStyle(checked: boolean): CSSProperties {
  return {
    width: 18,
    height: 18,
    borderRadius: 6,
    accentColor: "#4F46E5",
    border: "1px solid #CBD5E1",
    background: "#FFFFFF",
    boxShadow: checked
      ? "0 8px 16px rgba(79, 70, 229, 0.18)"
      : "0 2px 6px rgba(15, 23, 42, 0.06)",
    cursor: "pointer",
    flex: "0 0 auto",
  }
}

function productImageStyle(): CSSProperties {
  return {
    width: 56,
    height: 56,
    borderRadius: 999,
    overflow: "hidden",
    border: "1px solid #E2E8F0",
    background: "#F8FAFC",
    boxShadow: "0 6px 14px rgba(15, 23, 42, 0.06)",
    flex: "0 0 auto",
  }
}

function clampText(lines: number): CSSProperties {
  return {
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: lines,
    overflow: "hidden",
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
      <Grid columns={3}>
        <MetricCard label="In queue" value={data.recommendations.length} hint="Products needing review now" />
        <MetricCard label="Critical" value={criticalCount} hint="Highest urgency recommendations" tone={criticalCount > 0 ? "critical" : "subtle"} />
        <MetricCard
          label="Forecast status"
          value={data.forecastStatus ?? "Pending"}
          hint={data.forecastCompletedAt ? <>Updated <DateTimeText value={data.forecastCompletedAt} /></> : "No completed forecast yet"}
          tone={data.forecastStatus?.toUpperCase().includes("COMPLETED") ? "success" : "warning"}
        />
      </Grid>

      <div style={{ marginTop: 12, paddingBottom: selectedIds.size > 0 ? 108 : 0 }}>
        <Section title="Recommendations">
        {data.recommendations.length > 0 ? (
          <>
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 16,
              flexWrap: "wrap",
              padding: "14px 16px",
              borderRadius: 18,
              background: "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(248,250,252,0.92) 100%)",
              border: "1px solid #E2E8F0",
              boxShadow: "0 12px 24px rgba(15, 23, 42, 0.05)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#475569", cursor: "pointer", fontWeight: 700 }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    style={checkboxStyle(allSelected)}
                  />
                  {allSelected ? "Deselect all" : "Select all"}
                </label>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <Badge tone={criticalCount > 0 ? "critical" : "subtle"}>
                  {criticalCount > 0 ? `${criticalCount} critical` : "No critical items"}
                </Badge>
                <Badge tone="subtle">{data.recommendations.length} total</Badge>
              </div>
            </div>
            {purchaseOrderError ? (
              <div style={{ marginBottom: 16, fontSize: 13, color: "#B42318" }}>
                {purchaseOrderError}
              </div>
            ) : null}
            <div
              style={{
                display: "grid",
                gap: 16,
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                alignItems: "stretch",
              }}
            >
            {data.recommendations.map((recommendation) => {
              const tone = urgencyTone(recommendation.urgency);
              const reorderValue = recommendation.suggestedQty != null ? formatMetricNumber(recommendation.suggestedQty) : "Unknown";
              const daysLeft = recommendation.daysOfStock != null ? formatMetricNumber(recommendation.daysOfStock, "d") : "Unknown";
              return (
                <Card key={recommendation.id} style={{ padding: 20, height: "100%" }}>
                  <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
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
                    <div style={{ minWidth: 0, flex: "1 1 240px", display: "flex", gap: 14, alignItems: "flex-start" }}>
                      <div style={productImageStyle()}>
                        {recommendation.productImageUrl ? (
                          <img
                            src={recommendation.productImageUrl}
                            alt={recommendation.productName}
                            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                          />
                        ) : (
                          <div
                            style={{
                              width: "100%",
                              height: "100%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontFamily: '"Space Grotesk", "Manrope", sans-serif',
                              fontSize: 20,
                              fontWeight: 700,
                              color: "#64748B",
                            }}
                          >
                            {recommendation.productName.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10, minHeight: 32, alignContent: "flex-start" }}>
                        <Badge tone={tone}>{recommendation.urgency}</Badge>
                        {recommendation.forecastModel && shouldShowModelBadge(recommendation.forecastModel) ? (
                          <span title={modelTooltip[recommendation.forecastModel ?? ""] ?? ""}>
                            <Badge tone={modelTone(recommendation.forecastModel)}>{modelLabel(recommendation.forecastModel)}</Badge>
                          </span>
                        ) : null}
                        {showsLowConfidence(recommendation.forecastModel, recommendation.lowConfidence) ? (
                          <Badge tone="warning">Low confidence</Badge>
                        ) : null}
                      </div>
                      <div
                        style={{
                          fontFamily: '"Space Grotesk", "Manrope", sans-serif',
                          fontSize: 24,
                          lineHeight: 1.06,
                          letterSpacing: "-0.04em",
                          fontWeight: 700,
                          color: "#0F172A",
                          marginBottom: 10,
                          minHeight: 52,
                          ...clampText(2),
                        }}
                      >
                        {recommendation.productName}
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: "#6B7280",
                          marginBottom: 14,
                          minHeight: 21,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        title={recommendation.productSku}
                      >
                        {recommendation.productSku}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 14 }}>
                        <div style={{ padding: "14px 16px", borderRadius: 16, background: "linear-gradient(180deg, #0F172A 0%, #111827 100%)", color: "#FFFFFF" }}>
                          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.68)", marginBottom: 8 }}>
                            Reorder now
                          </div>
                          <div style={{ fontFamily: '"Space Grotesk", "Manrope", sans-serif', fontSize: 34, lineHeight: 0.95, letterSpacing: "-0.05em", fontWeight: 700 }}>
                            {reorderValue}
                          </div>
                        </div>
                        <div style={{ padding: "14px 16px", borderRadius: 16, background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#64748B", marginBottom: 8 }}>
                            Stock cover
                          </div>
                          <div style={{ fontFamily: '"Space Grotesk", "Manrope", sans-serif', fontSize: 30, lineHeight: 0.95, letterSpacing: "-0.05em", fontWeight: 700, color: "#0F172A", marginBottom: 6 }}>
                            {daysLeft}
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: stockoutColor(recommendation.daysOfStock) }}>
                            <StockoutText currentStock={recommendation.currentStock} daysOfStock={recommendation.daysOfStock} />
                          </div>
                        </div>
                      </div>
                      </div>
                    </div>
                    <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 10 }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(recommendation.id)}
                        onChange={() => toggleSelection(recommendation.id)}
                        style={checkboxStyle(selectedIds.has(recommendation.id))}
                        aria-label={`Select ${recommendation.productName}`}
                      />
                    </div>
                  </div>
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #E5E7EB" }}>
                    <KeyValueList
                      items={[
                        { label: "Current stock", value: recommendation.currentStock != null ? formatMetricNumber(recommendation.currentStock) : "Not available" },
                        { label: "Supplier", value: recommendation.supplierName ?? "Not set" },
                      ]}
                      />
                  </div>
                  </div>
                </Card>
              );
            })}
            </div>
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
          <div style={{ display: "grid", gap: 2 }}>
            <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>
              {selectedIds.size} selected
            </div>
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
