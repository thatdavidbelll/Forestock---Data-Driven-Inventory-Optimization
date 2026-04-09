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
  InlineList,
  KeyValueList,
  MetricCard,
  Section,
  toneForForecast,
  toneForReadiness,
} from "../components";
import { authenticate } from "../shopify.server";
import { getForestockAppHome } from "../forestock.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return getForestockAppHome(session.shop);
};

function statusLabel(status: string | null) {
  if (!status) return "Not run yet";
  return status.replaceAll("_", " ");
}

export default function AppIndex() {
  const data = useLoaderData<typeof loader>();
  const readiness = toneForReadiness({
    activeProductCount: data.activeProductCount,
    hasSalesHistory: data.hasSalesHistory,
    forecastStatus: data.forecastStatus,
  });
  const forecastTone = toneForForecast(data.forecastStatus);

  return (
    <AppShell
      title={data.storeName ? `${data.storeName} inventory command` : "Inventory command"}
      subtitle="Use Shopify as the operating surface for setup, sync verification, and inventory decisions. Forecasting remains on the same backend logic used by the website."
      actions={<Badge tone={readiness.tone}>{readiness.label}</Badge>}
    >
      <InfoBanner
        title="What this app should answer in one glance"
        body="Are products synced, is order history usable, has the shared forecast engine produced a valid run, and which products need action now."
        tone="subtle"
      />

      <Section
        title="Merchant readiness"
        description="These are the four conditions that must be healthy before a merchant should trust reorder recommendations."
      >
        <Grid columns={4}>
          <MetricCard
            label="Shopify connection"
            value={data.shopifyConnectionActive ? "Connected" : "Needs link"}
            hint={data.shopDomain}
            tone={data.shopifyConnectionActive ? "success" : "critical"}
          />
          <MetricCard
            label="Catalog sync"
            value={data.activeProductCount}
            hint={
              data.totalProductCount > 0
                ? `${data.totalProductCount} total products mapped`
                : "No products have been imported yet"
            }
            tone={data.activeProductCount > 0 ? "accent" : "warning"}
          />
          <MetricCard
            label="Sales history"
            value={data.hasSalesHistory ? "Usable" : "Missing"}
            hint={
              data.hasSalesHistory
                ? `${data.salesTransactionCount} sales rows, latest ${data.latestSaleDate ?? "unknown"}`
                : "Import historical orders before trusting demand signals"
            }
            tone={data.hasSalesHistory ? "success" : "warning"}
          />
          <MetricCard
            label="Forecast status"
            value={statusLabel(data.forecastStatus)}
            hint={
              data.forecastCompletedAt
                ? `Completed ${formatDateTime(data.forecastCompletedAt)}`
                : `Last started ${formatDateTime(data.lastForecastStartedAt)}`
            }
            tone={forecastTone === "default" ? "warning" : forecastTone}
          />
        </Grid>
      </Section>

      <Grid columns={2}>
        <Section
          title="Next merchant action"
          description="The embedded app should always make the next step obvious instead of forcing the merchant to interpret internal system state."
        >
          <Card tone={readiness.tone === "success" ? "success" : readiness.tone === "critical" ? "critical" : "warning"}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>
                {readiness.tone === "success" ? "Review recommendations" : "Finish setup before acting"}
              </div>
              <Badge tone={readiness.tone}>{readiness.label}</Badge>
            </div>
            <InlineList items={data.nextActions} />
          </Card>
        </Section>

        <Section
          title="Current top risk"
          description="The first thing a merchant should see is the highest-priority item, not a generic explanation of the system."
        >
          {data.topRecommendation ? (
            <Card tone={data.topRecommendation.urgency === "CRITICAL" ? "critical" : data.topRecommendation.urgency === "HIGH" ? "warning" : "accent"}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>{data.topRecommendation.productName}</div>
                  <div style={{ fontSize: 14, color: "#6d7175" }}>{data.topRecommendation.productSku}</div>
                </div>
                <Badge tone={data.topRecommendation.urgency === "CRITICAL" ? "critical" : data.topRecommendation.urgency === "HIGH" ? "warning" : "accent"}>
                  {data.topRecommendation.urgency}
                </Badge>
              </div>
              <KeyValueList
                items={[
                  { label: "Days of stock", value: data.topRecommendation.daysOfStock ?? "Unknown" },
                  { label: "Suggested reorder", value: data.topRecommendation.suggestedQty ?? "Unknown" },
                  { label: "Estimated order value", value: data.topRecommendation.estimatedOrderValue ?? "Unknown" },
                  { label: "Generated", value: formatDateTime(data.topRecommendation.generatedAt) },
                ]}
              />
            </Card>
          ) : (
            <EmptyState
              title="No actionable recommendation yet"
              body="This usually means setup is incomplete, sales history is too thin, or the forecast engine has not yet produced a usable completed run."
            />
          )}
        </Section>
      </Grid>

      <Grid columns={2}>
        <Section
          title="Decision output"
          description="Merchants need to know whether Forestock is surfacing a manageable queue or an urgent risk cluster."
        >
          <Grid columns={2}>
            <MetricCard
              label="Critical"
              value={data.criticalSuggestions}
              hint="Immediate reorder risks"
              tone={data.criticalSuggestions > 0 ? "critical" : "subtle"}
            />
            <MetricCard
              label="High priority"
              value={data.highSuggestions}
              hint="Important but less urgent"
              tone={data.highSuggestions > 0 ? "warning" : "subtle"}
            />
          </Grid>
        </Section>

        <Section
          title="Forecast proof"
          description="The app should expose evidence of the same forecast engine used by the website, not a separate Shopify-only calculation."
        >
          {data.forecastProof ? (
            <Card tone={data.forecastProof.readyForRecommendations ? "success" : data.forecastProof.errorMessage ? "critical" : "warning"}>
              <KeyValueList
                items={[
                  { label: "Status", value: data.forecastProof.status ?? "Unknown" },
                  { label: "Started", value: formatDateTime(data.forecastProof.startedAt) },
                  { label: "Finished", value: formatDateTime(data.forecastProof.finishedAt) },
                  { label: "Duration", value: data.forecastProof.durationSeconds != null ? `${data.forecastProof.durationSeconds}s` : "Unknown" },
                  { label: "Products processed", value: data.forecastProof.productsProcessed ?? "Unknown" },
                  { label: "Insufficient history", value: data.forecastProof.productsWithInsufficientData ?? "Unknown" },
                  { label: "Horizon", value: data.forecastProof.horizonDays != null ? `${data.forecastProof.horizonDays} days` : "Unknown" },
                ]}
              />
              {data.forecastProof.errorMessage ? (
                <div style={{ marginTop: 12, fontSize: 14, lineHeight: 1.6, color: "#d82c0d" }}>
                  Last forecast error: {data.forecastProof.errorMessage}
                </div>
              ) : null}
            </Card>
          ) : (
            <EmptyState
              title="No forecast evidence yet"
              body="The app can show setup and sync health, but it should not pretend recommendations are ready until the shared forecast engine has actually run."
            />
          )}
        </Section>
      </Grid>

      <Grid columns={2}>
        <Section
          title="Why trust may still be weak"
          description="Convert vague hesitation into explicit blockers the merchant or operator can fix."
        >
          {data.recommendationReadinessReasons.length > 0 ? (
            <Card tone="warning">
              <InlineList items={data.recommendationReadinessReasons} />
            </Card>
          ) : (
            <Card tone="success">
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>Core recommendation prerequisites are in place</div>
              <div style={{ fontSize: 14, lineHeight: 1.6, color: "#4b5563" }}>
                Active products, usable sales history, and a completed forecast run are present for this store.
              </div>
            </Card>
          )}
        </Section>

        <Section
          title="Warnings to review"
          description="These are the data-quality gaps that can still reduce confidence even when the basic pipeline looks healthy."
        >
          {data.dataQualityWarnings.length > 0 ? (
            <Card tone="warning">
              <InlineList items={data.dataQualityWarnings} />
            </Card>
          ) : (
            <EmptyState
              title="No major data-quality warnings detected"
              body="That is a positive signal, but it still does not replace a real dev-store validation of imports, webhooks, and forecast behavior."
            />
          )}
        </Section>
      </Grid>
    </AppShell>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
