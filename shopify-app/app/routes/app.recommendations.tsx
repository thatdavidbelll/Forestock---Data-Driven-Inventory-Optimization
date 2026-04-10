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
  KeyValueList,
  MetricCard,
  Section,
  SummarySplit,
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
  const criticalCount = data.recommendations.filter((recommendation) => recommendation.urgency === "CRITICAL").length;

  return (
    <AppShell
      title="Recommendations"
      subtitle="A compact review queue with the most urgent products surfaced first."
    >
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
                <Card key={recommendation.id}>
                  <SummarySplit
                    title={recommendation.productName}
                    body={
                      <>
                        <div style={{ marginBottom: 10, fontSize: 14, fontWeight: 600, color: "#6B7280" }}>
                          {recommendation.productSku}
                          {recommendation.productCategory ? ` • ${recommendation.productCategory}` : ""}
                        </div>
                        Review this recommendation to confirm reorder quantity and stock risk before purchasing.
                      </>
                    }
                    aside={<Badge tone={tone}>{recommendation.urgency}</Badge>}
                  />
                  <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid #E5E7EB" }}>
                    <Grid columns={2}>
                      <MetricCard label="Days left" value={recommendation.daysOfStock != null ? formatMetricNumber(recommendation.daysOfStock, "d") : "Unknown"} tone="subtle" />
                      <MetricCard label="Reorder qty" value={recommendation.suggestedQty != null ? formatMetricNumber(recommendation.suggestedQty) : "Unknown"} tone="subtle" />
                    </Grid>
                  </div>
                  <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid #E5E7EB" }}>
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
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
