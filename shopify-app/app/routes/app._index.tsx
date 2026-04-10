import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { redirect, useLoaderData, useRouteError } from "react-router";
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

export default function AppIndex() {
  const data = useLoaderData<typeof loader>();

  return (
    <AppShell
      title={data.storeName || "Forestock"}
      subtitle="A focused overview of the recommendation that needs attention first, with the forecast state behind it."
      actions={
        data.topRecommendation ? (
          <Badge
            tone={
              data.topRecommendation.urgency === "CRITICAL"
                ? "critical"
                : data.topRecommendation.urgency === "HIGH"
                  ? "warning"
                  : "accent"
            }
          >
            {data.topRecommendation.urgency}
          </Badge>
        ) : undefined
      }
    >
      <Section title="Snapshot" description="The core signals merchants need without extra noise.">
        <Grid columns={3}>
          <MetricCard label="Active products" value={data.activeProductCount} hint={`${data.totalProductCount} total in catalog`} />
          <MetricCard label="Sales history" value={data.hasSalesHistory ? "Connected" : "Missing"} hint={`${data.salesTransactionCount} transactions`} tone={data.hasSalesHistory ? "success" : "warning"} />
          <MetricCard label="Forecast status" value={data.forecastStatus ?? "Not started"} hint={data.forecastCompletedAt ? `Updated ${formatDateTime(data.forecastCompletedAt)}` : "Awaiting forecast output"} tone={data.forecastStatus?.toUpperCase().includes("COMPLETED") ? "success" : data.forecastStatus?.toUpperCase().includes("RUNNING") ? "accent" : "warning"} />
        </Grid>
      </Section>

      <Section title="Top recommendation" description="Start here if you only review one item right now.">
        {data.topRecommendation ? (
          <Card>
            <SummarySplit
              title={data.topRecommendation.productName}
              body={
                <>
                  <div style={{ marginBottom: 10, fontSize: 14, fontWeight: 600, color: "#6B7280" }}>{data.topRecommendation.productSku}</div>
                  This product currently carries the highest restocking priority based on stock cover, demand, and the latest forecast output.
                </>
              }
              aside={
                <Badge tone={data.topRecommendation.urgency === "CRITICAL" ? "critical" : data.topRecommendation.urgency === "HIGH" ? "warning" : "accent"}>
                  {data.topRecommendation.urgency}
                </Badge>
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
                  { label: "Priority", value: data.topRecommendation.urgency },
                  { label: "SKU", value: data.topRecommendation.productSku },
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
