import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  AppShell,
  Badge,
  Card,
  EmptyState,
  formatDateTime,
  Grid,
  InfoBanner,
  KeyValueList,
  MetricCard,
  Section,
  toneForForecast,
} from "../components";
import { authenticate } from "../shopify.server";
import { getForestockRecommendations } from "../forestock.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return getForestockRecommendations(session.shop);
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

export default function RecommendationsPage() {
  const data = useLoaderData<typeof loader>();
  const forecastTone = toneForForecast(data.forecastStatus);
  const criticalCount = data.recommendations.filter((recommendation) => recommendation.urgency === "CRITICAL").length;
  const highCount = data.recommendations.filter((recommendation) => recommendation.urgency === "HIGH").length;
  const totalEstimatedOrderValue = data.recommendations.reduce(
    (sum, recommendation) => sum + (recommendation.estimatedOrderValue ?? 0),
    0,
  );

  return (
    <AppShell
      title="Recommendations"
      subtitle="A sharper decision queue for merchant action. This surface translates shared forecast output into reorder priorities without introducing Shopify-side calculation."
      actions={<Badge tone={forecastTone}>{data.forecastStatus ?? "No forecast yet"}</Badge>}
    >
      <InfoBanner
        title="Queue posture"
        body="This page is deliberately opinionated: surface urgency first, keep proof visible, and make it obvious when the queue is thin because setup or forecast conditions are weak."
        tone={data.recommendations.length > 0 ? "accent" : "subtle"}
      />

      <Grid columns={2}>
        <Card tone="accent">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 8, opacity: 0.82 }}>
                Queue Snapshot
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.04em" }}>
                {data.recommendations.length > 0 ? `${data.recommendations.length} items need review` : "No active queue yet"}
              </div>
            </div>
            <Badge tone={forecastTone}>{data.forecastStatus ?? "Not run yet"}</Badge>
          </div>
          <div style={{ color: "rgba(224, 231, 255, 0.84)", lineHeight: 1.75 }}>
            The queue should feel commercially legible: what is urgent, what it will cost, and whether the forecast evidence is fresh enough to act on.
          </div>
        </Card>

        <Grid columns={2}>
          <MetricCard
            label="Forecast status"
            value={data.forecastStatus ?? "Not run yet"}
            hint={`Completed ${formatDateTime(data.forecastCompletedAt)}`}
            tone={forecastTone === "default" ? "warning" : forecastTone}
          />
          <MetricCard
            label="Open recommendations"
            value={data.recommendations.length}
            hint={data.recommendations.length > 0 ? "Products currently needing review" : "No active queue yet"}
            tone={data.recommendations.length > 0 ? "accent" : "subtle"}
          />
          <MetricCard
            label="Critical items"
            value={criticalCount}
            hint="Immediate stockout exposure"
            tone={criticalCount > 0 ? "critical" : "subtle"}
          />
          <MetricCard
            label="High priority"
            value={highCount}
            hint="Important but less urgent"
            tone={highCount > 0 ? "warning" : "subtle"}
          />
          <MetricCard
            label="Estimated order value"
            value={totalEstimatedOrderValue > 0 ? totalEstimatedOrderValue.toFixed(2) : "0.00"}
            hint="Current queue total"
            tone={data.recommendations.length > 0 ? "accent" : "subtle"}
          />
        </Grid>
      </Grid>

      <Section
        title="Review queue"
        description="Each card should answer the merchant’s decision in one pass: urgency, stock runway, recommended quantity, and commercial context."
      >
        {data.recommendations.length > 0 ? (
          <>
            <Card tone="subtle" style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, lineHeight: 1.7, color: "rgba(226, 232, 240, 0.76)" }}>
                Current payload coverage: product identity, urgency, suggested reorder quantity, days of stock, estimated order value, supplier, and generated timestamp.
                The UI also supports stock, forecast bands, lead time, MOQ, and acknowledgement metadata when the backend exposes them on the Shopify route.
              </div>
            </Card>
            <Grid columns={2}>
            {data.recommendations.map((recommendation) => {
              const tone = urgencyTone(recommendation.urgency);
              return (
                <Card key={recommendation.id} tone={tone}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 6, lineHeight: 1.05, letterSpacing: "-0.04em" }}>{recommendation.productName}</div>
                      <div style={{ fontSize: 14, color: "rgba(226, 232, 240, 0.74)" }}>
                        {recommendation.productSku}
                        {recommendation.productCategory ? ` • ${recommendation.productCategory}` : ""}
                      </div>
                    </div>
                    <Badge tone={tone}>{recommendation.urgency}</Badge>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                      gap: 12,
                      marginBottom: 14,
                    }}
                  >
                    <div style={{ padding: 14, borderRadius: 18, background: "rgba(15, 23, 42, 0.24)", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6, opacity: 0.72 }}>Days Left</div>
                      <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.04em" }}>
                        {recommendation.daysOfStock != null ? formatMetricNumber(recommendation.daysOfStock, "d") : "Unknown"}
                      </div>
                    </div>
                    <div style={{ padding: 14, borderRadius: 18, background: "rgba(15, 23, 42, 0.24)", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6, opacity: 0.72 }}>Reorder Qty</div>
                      <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.04em" }}>
                        {recommendation.suggestedQty != null
                          ? `${formatMetricNumber(recommendation.suggestedQty)}${recommendation.unit ? ` ${recommendation.unit}` : ""}`
                          : "Unknown"}
                      </div>
                    </div>
                    <div style={{ padding: 14, borderRadius: 18, background: "rgba(15, 23, 42, 0.24)", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6, opacity: 0.72 }}>Est. Value</div>
                      <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.04em" }}>
                        {recommendation.estimatedOrderValue != null ? recommendation.estimatedOrderValue.toFixed(2) : "Unknown"}
                      </div>
                    </div>
                  </div>
                  <KeyValueList
                    items={[
                      {
                        label: "Current stock",
                        value:
                          recommendation.currentStock != null
                            ? `${formatMetricNumber(recommendation.currentStock)}${recommendation.unit ? ` ${recommendation.unit}` : ""}`
                            : "Not available",
                      },
                      {
                        label: "Forecast P50 / P90",
                        value:
                          recommendation.forecastP50 != null || recommendation.forecastP90 != null
                            ? `${recommendation.forecastP50 != null ? formatMetricNumber(recommendation.forecastP50) : "—"} / ${recommendation.forecastP90 != null ? formatMetricNumber(recommendation.forecastP90) : "—"}`
                            : "Not available",
                      },
                      {
                        label: "Lead time",
                        value:
                          recommendation.leadTimeDaysAtGeneration != null
                            ? `${recommendation.leadTimeDaysAtGeneration}d`
                            : "Not available",
                      },
                      {
                        label: "MOQ applied",
                        value: recommendation.moqApplied != null ? formatMetricNumber(recommendation.moqApplied) : "Not available",
                      },
                      { label: "Supplier", value: recommendation.supplierName ?? "Not set" },
                      { label: "Generated", value: formatDateTime(recommendation.generatedAt) },
                    ]}
                  />
                  {recommendation.acknowledged ? (
                    <Card tone="subtle" style={{ marginTop: 12 }}>
                      <KeyValueList
                        items={[
                          { label: "Status", value: "Acknowledged" },
                          { label: "At", value: formatDateTime(recommendation.acknowledgedAt) },
                          { label: "Reason", value: recommendation.acknowledgedReason ?? "Not recorded" },
                          { label: "Ordered qty", value: recommendation.quantityOrdered ?? "Not recorded" },
                          { label: "Expected delivery", value: recommendation.expectedDelivery ?? "Not recorded" },
                          { label: "Order reference", value: recommendation.orderReference ?? "Not recorded" },
                        ]}
                      />
                    </Card>
                  ) : null}
                  <div style={{ marginTop: 12, fontSize: 14, lineHeight: 1.7, color: "rgba(226, 232, 240, 0.76)" }}>
                    This queue uses the same backend recommendation pipeline as the website. If the output looks weak, the correct fix is better synced catalog and order history, not alternate Shopify-side calculation.
                  </div>
                </Card>
              );
            })}
            </Grid>
          </>
        ) : (
          <EmptyState
            title="No active recommendations yet"
            body="Complete setup, import usable order history, and confirm a completed forecast before expecting trustworthy restocking recommendations here."
          />
        )}
      </Section>
    </AppShell>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
