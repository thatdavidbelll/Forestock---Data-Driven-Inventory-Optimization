import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { redirect, useLoaderData, useRouteError } from "react-router";
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
import { getSetupStages } from "../setup-state";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const overview = await getForestockAppHome(session.shop);
  const stages = getSetupStages(overview);
  const setupIncomplete = stages.some((stage) =>
    stage.id !== "recommendations" &&
    stage.status !== "completed" &&
    stage.status !== "running",
  );

  if (setupIncomplete) {
    throw redirect(`/app/setup${new URL(request.url).search}`);
  }

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
  const forecastTone = toneForForecast(data.forecastStatus);

  return (
    <AppShell
      title={data.storeName ? `${data.storeName} inventory radar` : "Inventory radar"}
      subtitle="A single place to confirm readiness and review the top reorder risk."
      actions={<Badge tone={readiness.tone}>{readiness.label}</Badge>}
    >
      <InfoBanner
        title="Current state"
        body={data.nextActions[0] ?? "The store is ready for recommendation review."}
        tone={readiness.tone === "success" ? "success" : "accent"}
      />

      <Section title="Readiness" description="If these are healthy, the merchant can trust the queue.">
        <Grid columns={4}>
          <MetricCard
            label="Connection"
            value={data.shopifyConnectionActive ? "Connected" : "Needs link"}
            hint={data.shopDomain}
            tone={data.shopifyConnectionActive ? "success" : "critical"}
          />
          <MetricCard
            label="Products"
            value={data.totalProductCount}
            hint={`${data.activeProductCount} active`}
            tone={data.totalProductCount > 0 ? "accent" : "warning"}
          />
          <MetricCard
            label="Transactions"
            value={data.salesTransactionCount}
            hint={data.latestSaleDate ? `Latest ${data.latestSaleDate}` : "No history yet"}
            tone={data.hasSalesHistory ? "success" : "warning"}
          />
          <MetricCard
            label="Forecast"
            value={statusLabel(data.forecastStatus)}
            hint={
              data.forecastCompletedAt
                ? `Completed ${formatDateTime(data.forecastCompletedAt)}`
                : `Started ${formatDateTime(data.lastForecastStartedAt)}`
            }
            tone={forecastTone === "default" ? "warning" : forecastTone}
          />
        </Grid>
      </Section>

      <Section title="Next action" description="Keep this obvious.">
        <Card tone={readiness.tone === "success" ? "success" : "warning"}>
          <InlineList items={data.nextActions} />
        </Card>
      </Section>

      <Section title="Top recommendation" description="Show the highest-priority item only.">
        {data.topRecommendation ? (
          <Card tone={data.topRecommendation.urgency === "CRITICAL" ? "critical" : data.topRecommendation.urgency === "HIGH" ? "warning" : "success"}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.05 }}>{data.topRecommendation.productName}</div>
                <div style={{ marginTop: 8, fontSize: 15, color: "rgba(226, 232, 240, 0.94)" }}>{data.topRecommendation.productSku}</div>
              </div>
              <Badge tone={data.topRecommendation.urgency === "CRITICAL" ? "critical" : data.topRecommendation.urgency === "HIGH" ? "warning" : "accent"}>
                {data.topRecommendation.urgency}
              </Badge>
            </div>
            <KeyValueList
              items={[
                { label: "Days of stock", value: data.topRecommendation.daysOfStock ?? "Unknown" },
                { label: "Suggested reorder", value: data.topRecommendation.suggestedQty ?? "Unknown" },
                { label: "Estimated value", value: data.topRecommendation.estimatedOrderValue ?? "Unknown" },
                { label: "Generated", value: formatDateTime(data.topRecommendation.generatedAt) },
              ]}
            />
          </Card>
        ) : (
          <EmptyState
            title="No recommendation yet"
            body="Once setup and forecast complete, the highest-priority reorder item appears here."
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

