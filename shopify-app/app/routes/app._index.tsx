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
  toneForForecast,
  toneForReadiness,
} from "../components";
import { authenticate } from "../shopify.server";
import { getForestockAppHome } from "../forestock.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const overview = await getForestockAppHome(session.shop);
  return overview;
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

  return (
    <AppShell
      title={data.storeName ? `${data.storeName} overview` : "Forestock overview"}
      subtitle="See whether your Shopify data is connected, whether Forestock has enough history to forecast demand, and what needs attention next."
      actions={<Badge tone={readiness.tone}>{readiness.label}</Badge>}
    >
      <Section title="Operational snapshot" description="These are the signals a merchant needs before trusting inventory recommendations.">
        <Grid columns={4}>
          <MetricCard
            label="Connection"
            value={data.shopifyConnectionActive ? "Active" : "Inactive"}
            hint={data.shopDomain}
            tone={data.shopifyConnectionActive ? "success" : "critical"}
          />
          <MetricCard
            label="Active products"
            value={data.activeProductCount}
            hint={data.totalProductCount > 0 ? `${data.totalProductCount} total products known` : "No synced products yet"}
            tone={data.activeProductCount > 0 ? "accent" : "warning"}
          />
          <MetricCard
            label="Sales history"
            value={data.hasSalesHistory ? "Ready" : "Missing"}
            hint={data.hasSalesHistory ? `${data.salesTransactionCount} sales rows, latest ${data.latestSaleDate ?? "unknown"}` : "Import orders before trusting forecasts"}
            tone={data.hasSalesHistory ? "success" : "warning"}
          />
          <MetricCard
            label="Forecast"
            value={statusLabel(data.forecastStatus)}
            hint={data.forecastCompletedAt ? `Completed: ${formatDateTime(data.forecastCompletedAt)}` : `Last started: ${formatDateTime(data.lastForecastStartedAt)}`}
            tone={toneForForecast(data.forecastStatus) === "success" ? "success" : toneForForecast(data.forecastStatus) === "critical" ? "critical" : toneForForecast(data.forecastStatus) === "accent" ? "accent" : "warning"}
          />
        </Grid>
      </Section>

      <Grid columns={2}>
        <Section title="What Forestock is ready to act on" description="This is the decision layer, not just a sync screen.">
          {data.topRecommendation ? (
            <Card tone={data.topRecommendation.urgency === "CRITICAL" ? "critical" : data.topRecommendation.urgency === "HIGH" ? "warning" : "accent"}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{data.topRecommendation.productName}</div>
                <Badge tone={data.topRecommendation.urgency === "CRITICAL" ? "critical" : data.topRecommendation.urgency === "HIGH" ? "warning" : "accent"}>
                  {data.topRecommendation.urgency}
                </Badge>
              </div>
              <KeyValueList
                items={[
                  { label: "SKU", value: data.topRecommendation.productSku },
                  { label: "Days of stock", value: data.topRecommendation.daysOfStock ?? "Unknown" },
                  { label: "Suggested reorder quantity", value: data.topRecommendation.suggestedQty ?? "Unknown" },
                  { label: "Estimated order value", value: data.topRecommendation.estimatedOrderValue ?? "Unknown" },
                ]}
              />
              <div style={{ marginTop: 12, color: "#52606d", lineHeight: 1.6 }}>
                This recommendation is only as trustworthy as your imported catalog and order history. If this looks wrong, revisit Setup & Sync first.
              </div>
            </Card>
          ) : (
            <EmptyState
              title="No live reorder action yet"
              body="That usually means one of three things: the catalog has not been synced, sales history is still missing, or a completed forecast has not been produced yet."
            />
          )}
        </Section>

        <Section title="Decision confidence" description="A merchant should know whether Forestock is seeing enough signal to help.">
          <Grid columns={2}>
            <MetricCard label="Critical items" value={data.criticalSuggestions} hint="Urgent reorder signals" tone={data.criticalSuggestions > 0 ? "critical" : "subtle"} />
            <MetricCard label="High priority" value={data.highSuggestions} hint="Important but less urgent" tone={data.highSuggestions > 0 ? "warning" : "subtle"} />
          </Grid>
          <div style={{ height: 16 }} />
          <Card tone="subtle">
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 10 }}>What happens next</div>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
              {data.nextActions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
          </Card>
        </Section>
      </Grid>

      <Grid columns={2}>
        <Section title="Forecast proof" description="This is the evidence layer for whether Forestock has actually run a usable forecast.">
          {data.forecastProof ? (
            <Card tone={data.forecastProof.readyForRecommendations ? "success" : data.forecastProof.errorMessage ? "critical" : "warning"}>
              <KeyValueList
                items={[
                  { label: "Status", value: data.forecastProof.status ?? "Unknown" },
                  { label: "Started", value: formatDateTime(data.forecastProof.startedAt) },
                  { label: "Finished", value: formatDateTime(data.forecastProof.finishedAt) },
                  { label: "Duration", value: data.forecastProof.durationSeconds != null ? `${data.forecastProof.durationSeconds}s` : "Unknown" },
                  { label: "Products processed", value: data.forecastProof.productsProcessed ?? "Unknown" },
                  { label: "Insufficient-history products", value: data.forecastProof.productsWithInsufficientData ?? "Unknown" },
                  { label: "Forecast horizon", value: data.forecastProof.horizonDays != null ? `${data.forecastProof.horizonDays} days` : "Unknown" },
                  { label: "Triggered by", value: data.forecastProof.triggeredBy ?? "Unknown" },
                ]}
              />
              {data.forecastProof.errorMessage ? (
                <div style={{ marginTop: 12, color: "#d64545", lineHeight: 1.6 }}>
                  Last forecast error: {data.forecastProof.errorMessage}
                </div>
              ) : null}
            </Card>
          ) : (
            <EmptyState
              title="No forecast proof yet"
              body="The app does not yet have evidence of a forecast run for this store. Until that changes, any recommendation confidence should stay low."
            />
          )}
        </Section>

        <Section title="Why recommendations may still be weak" description="This turns missing trust into explicit reasons instead of vague unease.">
          {data.recommendationReadinessReasons.length > 0 ? (
            <Card tone="warning">
              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                {data.recommendationReadinessReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </Card>
          ) : (
            <Card tone="success">
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>Recommendation readiness looks healthy</div>
              <div style={{ color: "#52606d", lineHeight: 1.6 }}>
                The main preconditions for trustworthy recommendations appear to be present: active products, sales history, and a usable completed forecast.
              </div>
            </Card>
          )}
        </Section>
      </Grid>

      <Section title="Warnings and trust gaps" description="These are the reasons a merchant might still hesitate to trust the recommendations.">
        {data.dataQualityWarnings.length > 0 ? (
          <Card tone="warning">
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
              {data.dataQualityWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </Card>
        ) : (
          <EmptyState
            title="No major data-quality warnings detected"
            body="That’s a good sign, but it still doesn’t replace validating product import, order history import, and forecast behavior on a real dev store."
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
