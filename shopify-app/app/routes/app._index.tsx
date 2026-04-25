import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { data, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  AppShell,
  Badge,
  Card,
  DateText,
  DateTimeText,
  EmptyState,
  ErrorState,
  Grid,
  InsetPanel,
  KeyValueList,
  LinkButton,
  MetricCard,
  Section,
  toneForReadiness,
} from "../components";
import { authenticate } from "../shopify.server";
import type { AppHomeOverviewResponse } from "../forestock.server";
import { getForestockRecommendations } from "../forestock.server";
import { loadForestockAppHomeWithRecovery } from "../forestock-bootstrap.server";

type HomeData = {
  overview: AppHomeOverviewResponse;
  recommendations: Awaited<ReturnType<typeof getForestockRecommendations>>;
};

function showsLowConfidence(
  forecastModel: string | null | undefined,
  lowConfidence: boolean | null | undefined,
) {
  return Boolean(lowConfidence) || forecastModel === "INTERMITTENT_FALLBACK";
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

function homeSummary(overview: AppHomeOverviewResponse) {
  if (overview.recommendationReadinessReasons.length > 0) {
    return overview.recommendationReadinessReasons[0] ?? "Settings still need attention before the forecast can drive restock work confidently.";
  }
  if (overview.totalActiveSuggestions > 0) {
    return "The forecast is ready. Start with the products that need restock attention now.";
  }
  return "The store looks steady right now and no restock pressure stands out.";
}

function queueActionHref(data: HomeData) {
  if (data.recommendations.recommendations.length > 0) {
    return "/app/recommendations";
  }
  return "/app/settings";
}

function queueActionLabel(data: HomeData) {
  if (data.recommendations.recommendations.length > 0) {
    return "Open recommendations";
  }
  return "Open settings";
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const headers = new Headers();
    headers.set("Cache-Control", "no-store");
    const { admin, session } = await authenticate.admin(request);
    const [overview, recommendations] = await Promise.all([
      loadForestockAppHomeWithRecovery(admin, session.shop),
      getForestockRecommendations(session.shop),
    ]);

    return data({ overview, recommendations }, { headers });
  } catch (error) {
    if (error instanceof Response) throw error;
    throw new Response(error instanceof Error ? error.message : "Failed to load app home.", {
      status: 500,
      statusText: "App Home Error",
    });
  }
};

export default function AppIndex() {
  const { overview, recommendations } = useLoaderData<typeof loader>();
  const readiness = toneForReadiness({
    activeProductCount: overview.activeProductCount,
    hasSalesHistory: overview.hasSalesHistory,
    forecastStatus: overview.forecastStatus,
  });
  const previewRecommendations = recommendations.recommendations.slice(0, 3);
  const lowConfidenceCount = recommendations.recommendations.filter((recommendation) =>
    showsLowConfidence(recommendation.forecastModel, recommendation.lowConfidence),
  ).length;

  return (
    <AppShell
      title={resolveHomeTitle(overview.storeName, overview.shopDomain)}
      subtitle="Check forecast freshness, confirm the store is ready, and move straight into the next restock decision."
      actions={<Badge tone={readiness.tone}>{readiness.label}</Badge>}
    >
      <Card>
        <div
          style={{
            display: "grid",
            gap: "var(--space-xl)",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))",
            alignItems: "start",
          }}
        >
          <div style={{ display: "grid", gap: "var(--space-md)" }}>
            <div style={{ display: "grid", gap: "var(--space-sm)", maxWidth: "60ch" }}>
              <div
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "var(--text-2xl)",
                  lineHeight: "var(--leading-tight)",
                  letterSpacing: "-0.02em",
                  fontWeight: "var(--weight-bold)",
                  color: "var(--fs-text)",
                }}
              >
                {homeSummary(overview)}
              </div>
              <div style={{ fontSize: "var(--text-body)", lineHeight: "var(--leading-body)", color: "var(--fs-text-muted)" }}>
                {overview.totalActiveSuggestions > 0
                  ? "Recommendations are the working screen. Use this dashboard to check readiness, forecast freshness, and what changed since the last review."
                  : "This dashboard should stay calm when the store is healthy, and only pull attention when setup, data quality, or stock pressure needs work."}
              </div>
            </div>

            <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap", alignItems: "center" }}>
              <LinkButton to={queueActionHref({ overview, recommendations })}>
                {queueActionLabel({ overview, recommendations })}
              </LinkButton>
              <LinkButton to="/app/settings" tone="secondary">
                Review forecast settings
              </LinkButton>
            </div>
          </div>

          <InsetPanel style={{ alignSelf: "stretch" }}>
            <KeyValueList
              items={[
                { label: "Recommendations", value: `${recommendations.recommendations.length} products` },
                {
                  label: "Forecast",
                  value: overview.forecastCompletedAt ? <DateTimeText value={overview.forecastCompletedAt} /> : overview.forecastStatus ?? "Pending",
                },
                { label: "Latest sale", value: overview.latestSaleDate ? <DateText value={overview.latestSaleDate} /> : "Unknown" },
                { label: "Catalog", value: `${overview.activeProductCount} active` },
              ]}
            />
          </InsetPanel>
        </div>
      </Card>

      <Section title="Store pulse" description="This should tell you whether to work recommendations now or fix forecast readiness first.">
        <Grid columns={4}>
          <MetricCard label="Urgent" value={overview.criticalSuggestions} hint="Critical products waiting now" tone={overview.criticalSuggestions > 0 ? "danger" : "subtle"} />
          <MetricCard label="High priority" value={overview.highSuggestions} hint="Review these after urgent items" tone={overview.highSuggestions > 0 ? "warning" : "subtle"} />
          <MetricCard label="Low confidence" value={lowConfidenceCount} hint="Suggestions that need extra review" tone={lowConfidenceCount > 0 ? "warning" : "subtle"} />
          <MetricCard label="Sales rows" value={overview.salesTransactionCount} hint={overview.hasSalesHistory ? "History is available" : "History still missing"} tone={overview.hasSalesHistory ? "success" : "warning"} />
        </Grid>
      </Section>

      <Section title="Recommendation preview" description="A short look at the next forecast-backed restock calls before you open the full list.">
        {previewRecommendations.length > 0 ? (
          <Card style={{ padding: 0, overflow: "hidden" }}>
            {previewRecommendations.map((recommendation, index) => (
              <div
                key={recommendation.id}
                style={{
                  display: "grid",
                  gap: "var(--space-lg)",
                  padding: "var(--space-lg) var(--space-xl)",
                  borderTop: index === 0 ? "none" : "1px solid var(--fs-border)",
                }}
              >
                <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap" }}>
                  <Badge tone={recommendation.urgency === "CRITICAL" ? "danger" : recommendation.urgency === "HIGH" ? "warning" : "primary"}>
                    {recommendation.urgency}
                  </Badge>
                  {showsLowConfidence(recommendation.forecastModel, recommendation.lowConfidence) ? (
                    <Badge tone="warning">Low confidence</Badge>
                  ) : (
                    <Badge tone="success">Higher confidence</Badge>
                  )}
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: "var(--space-lg)",
                    gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
                    alignItems: "start",
                  }}
                >
                  <div style={{ display: "grid", gap: "var(--space-xs)" }}>
                    <div
                      style={{
                        fontSize: "var(--text-xs)",
                        fontWeight: "var(--weight-bold)",
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        color: "var(--fs-text-muted)",
                      }}
                    >
                      {recommendation.productSku}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-heading)",
                        fontSize: "var(--text-xl)",
                        lineHeight: "var(--leading-tight)",
                        letterSpacing: "-0.01em",
                        fontWeight: "var(--weight-bold)",
                        color: "var(--fs-text)",
                      }}
                    >
                      {recommendation.productName}
                    </div>
                    <div style={{ fontSize: "var(--text-sm)", lineHeight: "var(--leading-body)", color: "var(--fs-text-muted)", maxWidth: "56ch" }}>
                      {showsLowConfidence(recommendation.forecastModel, recommendation.lowConfidence)
                        ? "Treat the suggested quantity as a starting point and check recent context before ordering."
                        : "This product is ready for review in the main recommendations list."}
                    </div>
                  </div>

                  <KeyValueList
                    items={[
                      { label: "Reorder", value: recommendation.suggestedQty != null ? `${Number(recommendation.suggestedQty).toFixed(1)}` : "Unknown" },
                      { label: "Stockout", value: recommendation.daysOfStock != null ? `About ${Math.round(recommendation.daysOfStock)} days` : "Unknown" },
                    ]}
                  />
                </div>
              </div>
            ))}

            <div style={{ padding: "var(--space-lg) var(--space-xl)", borderTop: "1px solid var(--fs-border)" }}>
              <LinkButton to="/app/recommendations">Open full recommendations</LinkButton>
            </div>
          </Card>
        ) : (
          <EmptyState
            title={overview.forecastStatus === "RUNNING" ? "Forecast is still running" : "Nothing needs recommendation review right now"}
            body={
              overview.forecastStatus === "RUNNING"
                ? "Forestock is still calculating the next restock list. Recommendations will refresh when the current run finishes."
                : "The store looks stable at the moment. Come back here when stock or demand changes push products into the recommendations list."
            }
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
