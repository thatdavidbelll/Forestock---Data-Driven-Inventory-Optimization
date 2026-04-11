import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { redirect, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  AppShell,
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

function recommendationSummary(recommendation: NonNullable<Awaited<ReturnType<typeof loader>>["topRecommendation"]>) {
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
    const { session } = await authenticate.admin(request);
    const overview = await getForestockAppHome(session.shop);
    const stages = getSetupStages(overview);
    const setupIncomplete = stages.some((stage) =>
      stage.id !== "recommendations" &&
      stage.status !== "completed" &&
      stage.status !== "running",
    );

    if (setupIncomplete) {
      throw redirect(`/app/settings${new URL(request.url).search}`);
    }

    return overview;
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

  return (
    <AppShell
      title={data.storeName || "Forestock"}
    >
      <Section title="Top recommendation" description="Start here if you only review one item right now.">
        {data.topRecommendation ? (
          <Card>
            <SummarySplit
              title={data.topRecommendation.productName}
              body={
                <>
                  <div style={{ marginBottom: 10, fontSize: 14, fontWeight: 600, color: "#6B7280" }}>{data.topRecommendation.productSku}</div>
                  {recommendationSummary(data.topRecommendation)}
                </>
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
                        value: (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-start" }}>
                            <span>{recommendationModelLabel(data.topRecommendation.forecastModel)}</span>
                            <span
                              style={{
                                display: "inline-flex",
                                padding: "4px 8px",
                                borderRadius: 999,
                                fontSize: 11,
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: "0.08em",
                                background: recommendationModelTone(data.topRecommendation.forecastModel) === "success" ? "rgba(31, 122, 92, 0.08)" : recommendationModelTone(data.topRecommendation.forecastModel) === "warning" ? "rgba(161, 98, 7, 0.08)" : "#F8FAFC",
                                color: recommendationModelTone(data.topRecommendation.forecastModel) === "success" ? "#1F7A5C" : recommendationModelTone(data.topRecommendation.forecastModel) === "warning" ? "#A16207" : "#475569",
                                border: recommendationModelTone(data.topRecommendation.forecastModel) === "success" ? "1px solid rgba(31, 122, 92, 0.12)" : recommendationModelTone(data.topRecommendation.forecastModel) === "warning" ? "1px solid rgba(161, 98, 7, 0.12)" : "1px solid #E2E8F0",
                              }}
                            >
                              {data.topRecommendation.forecastModel.replaceAll("_", " ")}
                            </span>
                          </span>
                        ),
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
    </AppShell>
  );
}

export function ErrorBoundary() {
  return <ErrorState error={useRouteError()} />;
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
