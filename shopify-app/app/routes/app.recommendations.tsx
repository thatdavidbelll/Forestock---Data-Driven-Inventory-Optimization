import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppShell, Badge, Card, EmptyState, formatDateTime, Grid, KeyValueList, MetricCard, Section, toneForForecast } from "../components";
import { authenticate } from "../shopify.server";
import { getForestockRecommendations } from "../forestock.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return getForestockRecommendations(session.shop);
};

export default function RecommendationsPage() {
  const data = useLoaderData<typeof loader>();
  const forecastTone = toneForForecast(data.forecastStatus);

  return (
    <AppShell
      title="Recommendations"
      subtitle="This page should help a merchant trust why Forestock is suggesting a reorder, not just list numbers without context."
      actions={<Badge tone={forecastTone}>{data.forecastStatus ?? "No forecast yet"}</Badge>}
    >
      <Section title="Forecast context" description="Recommendations are only as useful as the forecast and sales history behind them.">
        <Grid columns={3}>
          <MetricCard label="Forecast status" value={data.forecastStatus ?? "Not run yet"} hint={`Completed: ${formatDateTime(data.forecastCompletedAt)}`} tone={forecastTone === "success" ? "success" : forecastTone === "critical" ? "critical" : forecastTone === "accent" ? "accent" : "warning"} />
          <MetricCard label="Open recommendations" value={data.recommendations.length} hint={data.recommendations.length > 0 ? "Products currently needing attention" : "Nothing actionable surfaced yet"} tone={data.recommendations.length > 0 ? "accent" : "subtle"} />
          <MetricCard label="Merchant trust" value={data.recommendations.length > 0 ? "Building" : "Low"} hint={data.recommendations.length > 0 ? "There is decision output to review" : "Missing setup, forecast, or sales context"} tone={data.recommendations.length > 0 ? "success" : "warning"} />
        </Grid>
      </Section>

      <Section title="Priority reorder list" description="Each card should tell a merchant what to buy, why, and how urgent the problem is.">
        {data.recommendations.length > 0 ? (
          <Grid columns={2}>
            {data.recommendations.map((recommendation) => {
              const tone = recommendation.urgency === "CRITICAL" ? "critical" : recommendation.urgency === "HIGH" ? "warning" : "accent";
              return (
                <Card key={recommendation.id} tone={tone}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 20, fontWeight: 800 }}>{recommendation.productName}</div>
                    <Badge tone={tone}>{recommendation.urgency}</Badge>
                  </div>
                  <KeyValueList
                    items={[
                      { label: "SKU", value: recommendation.productSku },
                      { label: "Days of stock", value: recommendation.daysOfStock ?? "Unknown" },
                      { label: "Suggested reorder quantity", value: recommendation.suggestedQty ?? "Unknown" },
                      { label: "Estimated order value", value: recommendation.estimatedOrderValue ?? "Unknown" },
                      { label: "Supplier", value: recommendation.supplierName ?? "Not set" },
                      { label: "Generated", value: formatDateTime(recommendation.generatedAt) },
                    ]}
                  />
                  <div style={{ marginTop: 12, color: "#52606d", lineHeight: 1.6 }}>
                    This recommendation should be reviewed against your latest Shopify sales reality. If it feels off, validate setup, imports, and recent order history before acting.
                  </div>
                </Card>
              );
            })}
          </Grid>
        ) : (
          <EmptyState
            title="No active recommendations are ready yet"
            body="Complete setup, import sales history, and confirm a completed forecast before expecting reliable reorder suggestions here."
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
