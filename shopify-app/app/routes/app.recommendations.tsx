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
  Section,
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
      subtitle="A short queue of products that currently need review."
    >
      <InfoBanner
        title="Queue summary"
        body={
          data.recommendations.length > 0
            ? `${data.recommendations.length} products need review, including ${criticalCount} critical items.`
            : "No active recommendations yet."
        }
        tone={data.recommendations.length > 0 ? "accent" : "subtle"}
      />

      <Section title="Queue" description="Keep the list direct and easy to scan.">
        {data.recommendations.length > 0 ? (
          <Grid columns={2}>
            {data.recommendations.map((recommendation) => {
              const tone = urgencyTone(recommendation.urgency);
              return (
                <Card key={recommendation.id} tone={tone}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 6, lineHeight: 1.05 }}>{recommendation.productName}</div>
                      <div style={{ fontSize: 15, color: "#475569" }}>
                        {recommendation.productSku}
                        {recommendation.productCategory ? ` • ${recommendation.productCategory}` : ""}
                      </div>
                    </div>
                    <Badge tone={tone}>{recommendation.urgency}</Badge>
                  </div>
                  <KeyValueList
                    items={[
                      { label: "Days left", value: recommendation.daysOfStock != null ? formatMetricNumber(recommendation.daysOfStock, "d") : "Unknown" },
                      { label: "Reorder qty", value: recommendation.suggestedQty != null ? formatMetricNumber(recommendation.suggestedQty) : "Unknown" },
                      { label: "Current stock", value: recommendation.currentStock != null ? formatMetricNumber(recommendation.currentStock) : "Not available" },
                      { label: "Estimated value", value: recommendation.estimatedOrderValue != null ? recommendation.estimatedOrderValue.toFixed(2) : "Unknown" },
                      { label: "Supplier", value: recommendation.supplierName ?? "Not set" },
                      { label: "Generated", value: formatDateTime(recommendation.generatedAt) },
                    ]}
                  />
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
