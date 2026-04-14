import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { data, redirect, useLoaderData, useRouteError } from "react-router";
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
  SummarySplit,
} from "../components";
import { authenticate } from "../shopify.server";
import type { AppHomeOverviewResponse } from "../forestock.server";
import { getForestockAppHome } from "../forestock.server";
import { getSetupStages } from "../setup-state";

function recommendationModelLabel(forecastModel: string | null | undefined) {
  if (forecastModel === "HOLT_WINTERS") return "Seasonal model";
  if (forecastModel === "INTERMITTENT_FALLBACK") return "Conservative fallback";
  if (forecastModel === "ZERO") return "No demand signal";
  return "Forecast model";
}

function recommendationModelTone(forecastModel: string | null | undefined) {
  if (forecastModel === "HOLT_WINTERS") return "success" as const;
  if (forecastModel === "INTERMITTENT_FALLBACK") return "subtle" as const;
  if (forecastModel === "ZERO") return "warning" as const;
  return "subtle" as const;
}

const modelTooltip: Record<string, string> = {
  HOLT_WINTERS: "Seasonal model — uses your past 12 months of sales patterns to forecast demand.",
  INTERMITTENT_FALLBACK: "Conservative fallback — used when demand is uneven or sparse. Treats each sale as a signal.",
  ZERO: "No demand signal — this product has no meaningful recent sales history. The recommendation is intentionally conservative.",
}

function recommendationSummary(recommendation: NonNullable<AppHomeOverviewResponse["topRecommendation"]>) {
  if (recommendation.lowConfidence) {
    return `This recommendation is based on limited sales history${recommendation.historyDaysAtGeneration != null ? ` (${recommendation.historyDaysAtGeneration} observed sales days)` : ""}, so treat the reorder quantity as directional.`;
  }
  if (recommendation.forecastModel === "HOLT_WINTERS") {
    return "This recommendation is backed by the stronger seasonal forecast path and current stock cover.";
  }
  if (recommendation.forecastModel === "INTERMITTENT_FALLBACK") {
    return "This recommendation uses Forestock's conservative fallback model because recent demand is uneven or sparse.";
  }
  if (recommendation.forecastModel === "ZERO") {
    return "This item currently has no meaningful demand signal, so the recommendation is intentionally conservative.";
  }
  return "This product currently carries the highest restocking priority based on stock cover, demand, and the latest forecast output.";
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const headers = new Headers();
    headers.set("Cache-Control", "no-store");
    const { session } = await authenticate.admin(request);
    const overview = await getForestockAppHome(session.shop);
    const stages = getSetupStages(overview);
    const setupIncomplete = stages.some((stage) =>
      stage.id !== "recommendations" &&
      stage.status !== "completed" &&
      stage.status !== "running",
    );

    if (setupIncomplete) {
      throw redirect(`/app/onboarding${new URL(request.url).search}`, { headers });
    }

    return data(overview, { headers });
  } catch (error) {
    if (error instanceof Response) throw error;
    throw new Response(error instanceof Error ? error.message : "Failed to load app home.", {
      status: 500,
      statusText: "App Home Error",
    });
  }
};

export default function AppIndex() {
  const data = useLoaderData<typeof loader>();
  const hasAttention = data.criticalSuggestions > 0 || data.highSuggestions > 0;
  const readinessBody = data.recommendationReadinessReasons.length > 0
    ? data.recommendationReadinessReasons.join(" • ")
    : "Recommendations are ready to review.";

  return (
    <AppShell
      title={data.storeName || "Forestock"}
    >
      <Grid columns={3}>
        <MetricCard
          label="Needs attention"
          value={data.totalActiveSuggestions}
          hint={hasAttention ? `${data.criticalSuggestions} critical · ${data.highSuggestions} high` : "No urgent items right now"}
          tone={hasAttention ? "critical" : "subtle"}
        />
        <MetricCard
          label="Forecast freshness"
          value={data.forecastCompletedAt ? formatDateTime(data.forecastCompletedAt) : "Not run yet"}
          hint={data.forecastStatus === "RUNNING" ? "A fresh run is in progress." : readinessBody}
          tone={data.forecastStatus === "RUNNING" ? "accent" : data.forecastCompletedAt ? "success" : "warning"}
        />
        <MetricCard
          label="Active catalog"
          value={data.activeProductCount}
          hint={data.hasSalesHistory ? `${data.salesTransactionCount} sales rows available` : "No sales history imported yet"}
          tone={data.activeProductCount > 0 ? "subtle" : "warning"}
        />
      </Grid>

      <div style={{ marginTop: 16 }}>
      <Section title="Top recommendation">
        {data.topRecommendation ? (
          <Card>
            <SummarySplit
              title={data.topRecommendation.productName}
              body={
                <>
                  <div style={{ marginBottom: 10, fontSize: 14, fontWeight: 600, color: "#6B7280" }}>
                    {data.topRecommendation.productSku}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                    <Badge tone={data.topRecommendation.urgency === "CRITICAL" ? "critical" : data.topRecommendation.urgency === "HIGH" ? "warning" : "accent"}>
                      {data.topRecommendation.urgency}
                    </Badge>
                    {data.topRecommendation.forecastModel ? (
                      <span title={modelTooltip[data.topRecommendation.forecastModel] ?? ""}>
                        <Badge tone={recommendationModelTone(data.topRecommendation.forecastModel)}>
                          {recommendationModelLabel(data.topRecommendation.forecastModel)}
                        </Badge>
                      </span>
                    ) : null}
                    {data.topRecommendation.lowConfidence ? (
                      <Badge tone="warning">Low confidence</Badge>
                    ) : null}
                  </div>
                  {recommendationSummary(data.topRecommendation)}
                </>
              }
              aside={
                <Card tone="subtle" style={{ padding: 18 }}>
                  <div style={{ fontFamily: '"Space Grotesk", "Manrope", sans-serif', fontSize: 42, fontWeight: 700, lineHeight: 0.95, letterSpacing: "-0.05em", marginBottom: 8 }}>
                    {data.topRecommendation.suggestedQty ?? "—"}
                  </div>
                </Card>
              }
            />
            <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid #E5E7EB" }}>
              <Grid columns={4}>
                <MetricCard label="Days of stock" value={data.topRecommendation.daysOfStock ?? "Unknown"} tone="subtle" />
                <MetricCard label="Suggested reorder" value={data.topRecommendation.suggestedQty ?? "Unknown"} tone="subtle" />
                <MetricCard label="Estimated value" value={data.topRecommendation.estimatedOrderValue ?? "Unknown"} tone="subtle" />
                <MetricCard label="Generated" value={formatDateTime(data.topRecommendation.generatedAt)} tone="subtle" />
              </Grid>
            </div>
            <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid #E5E7EB" }}>
              <KeyValueList
                items={[
                  { label: "SKU", value: data.topRecommendation.productSku },
                  ...(data.topRecommendation.lowConfidence
                    ? [{
                        label: "Confidence",
                        value: data.topRecommendation.historyDaysAtGeneration != null
                          ? `Low (${data.topRecommendation.historyDaysAtGeneration} sales days observed)`
                          : "Low",
                      }]
                    : []),
                  ...(data.topRecommendation.forecastModel
                    ? [{
                        label: "Model",
                        value: <span title={modelTooltip[data.topRecommendation.forecastModel] ?? ""}>{recommendationModelLabel(data.topRecommendation.forecastModel)}</span>,
                      }]
                    : []),
                ]}
              />
            </div>
          </Card>
        ) : (
          <EmptyState
            title="No recommendation yet"
            body="When Forestock is ready, your first product to review will appear here."
          />
        )}
      </Section>
      </div>
      <div style={{ marginTop: 16 }}>
        <Card tone="subtle">
          <div style={{ fontFamily: '"Space Grotesk", "Manrope", sans-serif', fontSize: 20, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 10 }}>
            Readiness snapshot
          </div>
          <KeyValueList
            items={[
              { label: "Recommendations", value: data.totalActiveSuggestions > 0 ? `${data.totalActiveSuggestions} in queue` : "No active queue" },
              { label: "Catalog", value: `${data.activeProductCount} active of ${data.totalProductCount} total` },
              { label: "Sales history", value: data.hasSalesHistory ? `Available · latest sale ${formatDateTime(data.latestSaleDate)}` : "Not imported yet" },
              { label: "Warnings", value: data.dataQualityWarnings.length > 0 ? data.dataQualityWarnings.join(" • ") : "No current data quality warnings" },
            ]}
          />
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
