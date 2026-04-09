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
      subtitle="This page should translate the shared forecast output into an embedded Shopify decision queue. The forecast and recommendation logic remain the same backend logic used by the website."
      actions={<Badge tone={forecastTone}>{data.forecastStatus ?? "No forecast yet"}</Badge>}
    >
      <InfoBanner
        title="Current recommendation contract"
        body="This embedded page is intentionally a presentation layer over the existing backend recommendation output. The next expansion should be field parity with the website suggestions table, not a separate Shopify-side algorithm."
        tone="subtle"
      />

      <Section
        title="Recommendation readiness"
        description="Merchants need context before they trust a reorder queue."
      >
        <Grid columns={4}>
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
      </Section>

      <Section
        title="Review queue"
        description="Each recommendation should tell the merchant what needs reordering now, how urgent it is, and whether the output is fresh enough to trust. The page is ready to render the richer website fields when the Shopify endpoint exposes them."
      >
        {data.recommendations.length > 0 ? (
          <>
            <Card tone="subtle" style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, lineHeight: 1.6, color: "#4b5563" }}>
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
                      <div style={{ fontSize: 21, fontWeight: 800, marginBottom: 4 }}>{recommendation.productName}</div>
                      <div style={{ fontSize: 14, color: "#6d7175" }}>
                        {recommendation.productSku}
                        {recommendation.productCategory ? ` • ${recommendation.productCategory}` : ""}
                      </div>
                    </div>
                    <Badge tone={tone}>{recommendation.urgency}</Badge>
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
                      { label: "Days of stock", value: recommendation.daysOfStock != null ? formatMetricNumber(recommendation.daysOfStock, "d") : "Unknown" },
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
                      {
                        label: "Suggested reorder qty",
                        value:
                          recommendation.suggestedQty != null
                            ? `${formatMetricNumber(recommendation.suggestedQty)}${recommendation.unit ? ` ${recommendation.unit}` : ""}`
                            : "Unknown",
                      },
                      { label: "Estimated order value", value: recommendation.estimatedOrderValue != null ? recommendation.estimatedOrderValue.toFixed(2) : "Unknown" },
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
                  <div style={{ marginTop: 12, fontSize: 14, lineHeight: 1.6, color: "#4b5563" }}>
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
