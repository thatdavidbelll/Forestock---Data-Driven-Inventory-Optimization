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
  const stages = getSetupStages(data);
  const nextStage = stages.find((stage) => stage.status !== "completed");

  return (
    <AppShell
      title={data.storeName ? `${data.storeName} inventory radar` : "Inventory radar"}
      subtitle="A modern Shopify command layer for sync confidence, forecast proof, and restock action. The UI stays thin; the forecast engine remains centralized in Forestock."
      actions={<Badge tone={readiness.tone}>{readiness.label}</Badge>}
    >
      <InfoBanner
        title="What should be obvious right now"
        body={
          nextStage
            ? `${nextStage.step} is the current constraint: ${nextStage.summary}`
            : "All setup stages are satisfied. The merchant should be able to act from the recommendation queue without leaving Shopify Admin."
        }
        tone={nextStage ? "accent" : "success"}
      />

      <Grid columns={2}>
        <Card tone="accent">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 8, opacity: 0.8 }}>
                Command Board
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.04em" }}>
                {readiness.tone === "success" ? "Review the queue" : "Finish setup before trusting reorder calls"}
              </div>
            </div>
            <Badge tone={readiness.tone}>{readiness.label}</Badge>
          </div>
          <div style={{ marginBottom: 14, color: "rgba(224, 231, 255, 0.86)", lineHeight: 1.75 }}>
            The merchant should not need to interpret backend internals. This surface should state whether the store is ready, what is missing, and where the highest inventory risk is now.
          </div>
          <InlineList items={data.nextActions} />
        </Card>

        {data.topRecommendation ? (
          <Card tone={data.topRecommendation.urgency === "CRITICAL" ? "critical" : data.topRecommendation.urgency === "HIGH" ? "warning" : "success"}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 8, opacity: 0.82 }}>
                  Risk Spotlight
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1.04 }}>
                  {data.topRecommendation.productName}
                </div>
                <div style={{ marginTop: 8, fontSize: 14, color: "rgba(226, 232, 240, 0.82)" }}>
                  {data.topRecommendation.productSku}
                </div>
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
            title="No risk spotlight yet"
            body="A highlighted recommendation appears here once catalog, order history, and forecast proof are strong enough to produce an actionable queue."
          />
        )}
      </Grid>

      <Section
        title="Merchant readiness"
        description="These four signals should tell the merchant whether Forestock is ready to influence buying decisions."
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

      <Section
        title="Setup runway"
        description="Each stage should move cleanly from blocked to complete. Home should expose that sequence without forcing the merchant onto the setup page just to interpret progress."
      >
        <Grid columns={3}>
          {stages.map((stage) => (
            <Card key={stage.id} tone={stage.status === "completed" ? "success" : stage.status === "running" ? "accent" : stage.status === "failed" ? "critical" : "subtle"}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 6, color: "rgba(226, 232, 240, 0.66)" }}>
                    {stage.step}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.03em" }}>{stage.title}</div>
                </div>
                <Badge tone={stage.status === "completed" ? "success" : stage.status === "running" ? "accent" : stage.status === "failed" ? "critical" : "subtle"}>
                  {stage.status.replaceAll("_", " ")}
                </Badge>
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.7, color: "rgba(226, 232, 240, 0.8)", marginBottom: 12 }}>
                {stage.summary}
              </div>
              {stage.blockers.length > 0 ? <InlineList items={stage.blockers.slice(0, 2)} /> : null}
            </Card>
          ))}
        </Grid>
      </Section>

      <Grid columns={2}>
        <Section
          title="Decision output"
          description="The queue should feel like a controllable workload, not a black-box number dump."
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
          description="Expose enough proof that the merchant can trust the recommendation queue without pretending Shopify runs a separate model."
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
          title="Trust blockers"
          description="Convert vague hesitation into explicit conditions that can be fixed."
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
          title="Data-quality watchlist"
          description="These warnings should stay visible even when the overall setup state looks healthy."
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
