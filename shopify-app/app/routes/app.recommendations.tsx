import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useRouteError } from "react-router";
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

export default function RecommendationsPage() {
  const data = useLoaderData<typeof loader>();
  const criticalCount = data.recommendations.filter((recommendation) => recommendation.urgency === "CRITICAL").length;

  return (
    <AppShell title="Recommendations">
      <Grid columns={3}>
        <MetricCard label="In queue" value={data.recommendations.length} hint="Products needing review now" />
        <MetricCard label="Critical" value={criticalCount} hint="Highest urgency recommendations" tone={criticalCount > 0 ? "critical" : "subtle"} />
        <MetricCard label="Forecast status" value={data.forecastStatus ?? "Pending"} hint={data.forecastCompletedAt ? `Updated ${formatDateTime(data.forecastCompletedAt)}` : "No completed forecast yet"} tone={data.forecastStatus?.toUpperCase().includes("COMPLETED") ? "success" : "warning"} />
      </Grid>

      <Section title="Queue" description="Keep the list direct and easy to scan.">
        {data.recommendations.length > 0 ? (
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
                      marginBottom: 14,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
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
                          Low confidence{recommendation.historyDaysAtGeneration != null ? ` • ${recommendation.historyDaysAtGeneration} sales days observed` : ""}
                        </div>
                      ) : null}
                      {recommendation.forecastModel ? (
                        <div style={{ marginTop: recommendation.lowConfidence ? 8 : 10, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                          <Badge tone={modelTone(recommendation.forecastModel)}>{modelLabel(recommendation.forecastModel)}</Badge>
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
                    <Badge tone={tone}>{recommendation.urgency}</Badge>
                  </div>
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #E5E7EB" }}>
                    <Grid columns={2}>
                      <MetricCard label="Days left" value={recommendation.daysOfStock != null ? formatMetricNumber(recommendation.daysOfStock, "d") : "Unknown"} tone="subtle" />
                      <MetricCard label="Reorder qty" value={recommendation.suggestedQty != null ? formatMetricNumber(recommendation.suggestedQty) : "Unknown"} tone="subtle" />
                    </Grid>
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
        ) : (
          <EmptyState
            title="No active recommendations yet"
            body="Complete setup and wait for a completed forecast before expecting a queue here."
          />
        )}
      </Section>
    </AppShell>
  );
}

export function ErrorBoundary() {
  return <ErrorState error={useRouteError()} />;
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
