import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { data, redirect, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  AppShell,
  Badge,
  Card,
  DateText,
  EmptyState,
  ErrorState,
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
  if (forecastModel === "ZERO") return "No demand signal";
  return "Forecast model";
}

function recommendationModelTone(forecastModel: string | null | undefined) {
  if (forecastModel === "HOLT_WINTERS") return "success" as const;
  if (forecastModel === "ZERO") return "warning" as const;
  return "subtle" as const;
}

function shouldShowModelBadge(
  forecastModel: string | null | undefined,
) {
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

function recommendationSummary(recommendation: NonNullable<AppHomeOverviewResponse["topRecommendation"]>) {
  if (showsLowConfidence(recommendation.forecastModel, recommendation.lowConfidence)) {
    return `This recommendation is based on limited sales history${recommendation.historyDaysAtGeneration != null ? ` (${recommendation.historyDaysAtGeneration} observed sales days)` : ""}, so treat the reorder quantity as directional.`;
  }
  if (recommendation.forecastModel === "HOLT_WINTERS") {
    return "This recommendation is backed by the stronger seasonal forecast path and current stock cover.";
  }
  if (recommendation.forecastModel === "ZERO") {
    return "This item currently has no meaningful demand signal, so the recommendation is intentionally conservative.";
  }
  return "This product currently carries the highest restocking priority based on stock cover, demand, and the latest forecast output.";
}

function resolveHomeTitle(storeName: string | null | undefined, shopDomain: string | null | undefined) {
  const normalizedStoreName = storeName?.trim();
  if (normalizedStoreName && normalizedStoreName.toLowerCase() !== "store") {
    return normalizedStoreName;
  }

  const subdomain = shopDomain?.split(".")[0]?.trim();
  if (!subdomain) {
    return "Forestock";
  }

  return subdomain
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function badgeStackStyle() {
  return {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "flex-start",
    gap: 6,
  };
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

  return (
    <AppShell
      title={resolveHomeTitle(data.storeName, data.shopDomain)}
    >
      <Grid columns={2}>
        <MetricCard
          label="Needs attention"
          value={data.totalActiveSuggestions}
          hint={hasAttention ? `${data.criticalSuggestions} critical · ${data.highSuggestions} high` : "No urgent items right now"}
          tone={hasAttention ? "critical" : "subtle"}
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
                    <div style={badgeStackStyle()}>
                      <Badge tone={data.topRecommendation.urgency === "CRITICAL" ? "critical" : data.topRecommendation.urgency === "HIGH" ? "warning" : "accent"}>
                        {data.topRecommendation.urgency}
                      </Badge>
                      {showsLowConfidence(data.topRecommendation.forecastModel, data.topRecommendation.lowConfidence) ? (
                        <Badge tone="warning">Low confidence</Badge>
                      ) : null}
                    </div>
                    {data.topRecommendation.forecastModel && shouldShowModelBadge(data.topRecommendation.forecastModel) ? (
                      <span title={modelTooltip[data.topRecommendation.forecastModel] ?? ""}>
                        <Badge tone={recommendationModelTone(data.topRecommendation.forecastModel)}>
                          {recommendationModelLabel(data.topRecommendation.forecastModel)}
                        </Badge>
                      </span>
                    ) : null}
                  </div>
                  {recommendationSummary(data.topRecommendation)}
                </>
              }
            />
            <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid #E5E7EB" }}>
              <Grid columns={2}>
                <MetricCard label="Days of stock" value={data.topRecommendation.daysOfStock ?? "Unknown"} tone="subtle" />
                <MetricCard label="Suggested reorder" value={data.topRecommendation.suggestedQty ?? "Unknown"} tone="subtle" />
              </Grid>
            </div>
            <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid #E5E7EB" }}>
              <KeyValueList
                items={[
                  { label: "SKU", value: data.topRecommendation.productSku },
                  ...(data.topRecommendation.forecastModel && shouldShowModelBadge(data.topRecommendation.forecastModel)
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
              { label: "Sales history", value: data.hasSalesHistory ? <>Available · latest sale <DateText value={data.latestSaleDate} /></> : "Not imported yet" },
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
