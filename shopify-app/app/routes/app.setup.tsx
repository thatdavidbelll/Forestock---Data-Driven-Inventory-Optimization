import { useEffect, useRef } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  ActionButton,
  AppShell,
  Badge,
  Card,
  EmptyState,
  Grid,
  InfoBanner,
  InlineList,
  KeyValueList,
  MetricCard,
  Section,
  formatDateTime,
  toneForReadiness,
} from "../components";
import { getForestockAppHome } from "../forestock.server";
import { getSetupStages, type SetupStage } from "../setup-state";
import { authenticate } from "../shopify.server";
import {
  loadShopIdentity,
  runShopifyAutomaticSetup,
  type ShopifySetupStepResult,
} from "../shopify-sync.server";

type ActionData = ShopifySetupStepResult;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const identity = await loadShopIdentity(admin, session.shop);
  const overview = await getForestockAppHome(session.shop);
  return { ...identity, overview };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const identity = await loadShopIdentity(admin, session.shop);

  try {
    return await runShopifyAutomaticSetup({
      admin,
      shopDomain: identity.shopDomain,
      shopName: identity.shopName,
    });
  } catch (error) {
    return {
      intent: "full",
      ok: false,
      message: error instanceof Error ? error.message : "Automatic setup failed.",
    } satisfies ActionData;
  }
};

function stepTone(status: SetupStage["status"]) {
  if (status === "completed") return "success" as const;
  if (status === "running") return "accent" as const;
  if (status === "failed") return "critical" as const;
  if (status === "blocked") return "warning" as const;
  if (status === "ready_to_run") return "accent" as const;
  return "subtle" as const;
}

function stepStatusLabel(status: SetupStage["status"]) {
  if (status === "completed") return "Completed";
  if (status === "running") return "Running";
  if (status === "failed") return "Failed";
  if (status === "blocked") return "Blocked";
  if (status === "ready_to_run") return "Ready";
  return "Not started";
}

function shouldAutoRunSetup(stages: SetupStage[]) {
  const connection = stages.find((stage) => stage.id === "provision");
  const catalog = stages.find((stage) => stage.id === "catalog");
  const orders = stages.find((stage) => stage.id === "orders");
  const forecast = stages.find((stage) => stage.id === "forecast");

  if (!connection || !catalog || !orders || !forecast) {
    return false;
  }

  if (["running"].includes(forecast.status)) {
    return false;
  }

  return (
    connection.status !== "completed" ||
    catalog.status !== "completed" ||
    orders.status !== "completed" ||
    (forecast.status !== "completed" && forecast.status !== "running")
  );
}

function SetupResult({ data }: { data: ActionData | undefined }) {
  if (!data) return null;

  return (
    <Card tone={data.ok ? "success" : "critical"}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 18, fontWeight: 800 }}>{data.message}</div>
        <Badge tone={data.ok ? "success" : "critical"}>{data.ok ? "Started" : "Failed"}</Badge>
      </div>
      {data.provisioned || data.catalogSync || data.orderBackfill ? (
        <KeyValueList
          items={[
            { label: "Workspace", value: data.provisioned?.storeName ?? "Unchanged" },
            { label: "Products processed", value: data.catalogSync?.processedItems ?? "Not available" },
            { label: "Orders imported", value: data.orderBackfill?.importedOrders ?? "Not available" },
            { label: "Sales rows written", value: data.orderBackfill?.salesRowsUpserted ?? "Not available" },
            { label: "Forecast started", value: data.forecastTriggered ? "Yes" : "No" },
          ]}
        />
      ) : null}
    </Card>
  );
}

export default function SetupPage() {
  const { shopName, shopDomain, overview } = useLoaderData<typeof loader>();
  const setupFetcher = useFetcher<ActionData>();
  const autoSubmitted = useRef(false);

  const readiness = toneForReadiness({
    activeProductCount: overview.activeProductCount,
    hasSalesHistory: overview.hasSalesHistory,
    forecastStatus: overview.forecastStatus,
  });
  const stages = getSetupStages(overview);
  const nextSetupStage = stages.find((stage) => stage.status !== "completed");
  const shouldAutoBootstrap = shouldAutoRunSetup(stages);

  useEffect(() => {
    if (autoSubmitted.current || !shouldAutoBootstrap || setupFetcher.state !== "idle") {
      return;
    }

    autoSubmitted.current = true;
    setupFetcher.submit({}, { method: "post" });
  }, [setupFetcher, shouldAutoBootstrap]);

  return (
    <AppShell
      title="Setup"
      subtitle="This page should do the work for the merchant. On first install it links the store, imports products and transactions, and starts the shared forecast automatically."
      actions={<Badge tone={readiness.tone}>{readiness.label}</Badge>}
    >
      <InfoBanner
        title="Automatic bootstrap"
        body={
          shouldAutoBootstrap
            ? "Forestock starts setup automatically when this store is not ready yet. The merchant should not have to trigger catalog import, order import, and forecast as separate tasks."
            : "The automatic bootstrap has already completed its core work for this store. Review the stage tracker below only if trust is still weak."
        }
        tone={shouldAutoBootstrap ? "accent" : "success"}
      />

      <Section title="Shop identity" description="This is the Shopify store Forestock is preparing automatically.">
        <Grid columns={3}>
          <MetricCard label="Shop name" value={shopName} tone="subtle" />
          <MetricCard label="Shop domain" value={shopDomain} tone="subtle" />
          <MetricCard label="Current state" value={readiness.label} tone={readiness.tone} />
        </Grid>
      </Section>

      <Section
        title="Bootstrap status"
        description="This is the only primary setup action left: retry the automatic bootstrap if it fails or if the environment changed."
      >
        <Card tone={setupFetcher.state !== "idle" ? "accent" : shouldAutoBootstrap ? "warning" : "success"}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
                {setupFetcher.state !== "idle"
                  ? "Preparing store data..."
                  : shouldAutoBootstrap
                    ? "Automatic setup needs to finish"
                    : "Automatic setup completed"}
              </div>
              <div style={{ color: "rgba(226, 232, 240, 0.92)", lineHeight: 1.65, maxWidth: 760, fontSize: 15 }}>
                {nextSetupStage
                  ? `${nextSetupStage.step}: ${nextSetupStage.title}. ${nextSetupStage.summary}`
                  : "Products, transactions, and forecast proof are already in place for this store."}
              </div>
            </div>
            <setupFetcher.Form method="post">
              <ActionButton loading={setupFetcher.state !== "idle"}>
                {shouldAutoBootstrap ? "Retry automatic setup" : "Run setup again"}
              </ActionButton>
            </setupFetcher.Form>
          </div>
          {setupFetcher.data ? (
            <div style={{ marginTop: 16 }}>
              <SetupResult data={setupFetcher.data} />
            </div>
          ) : null}
        </Card>
      </Section>

      <Section
        title="Setup runway"
        description="These stages remain visible for operator trust, but the merchant should not have to drive them manually."
      >
        <Grid columns={2}>
          {stages.map((stage) => (
            <Card key={stage.id} tone={stepTone(stage.status)}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 800, color: "rgba(226, 232, 240, 0.82)", marginBottom: 6 }}>
                    {stage.step}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{stage.title}</div>
                </div>
                <Badge tone={stepTone(stage.status)}>{stepStatusLabel(stage.status)}</Badge>
              </div>
              <div style={{ color: "rgba(226, 232, 240, 0.9)", lineHeight: 1.65, marginBottom: 12, fontSize: 15 }}>{stage.summary}</div>
              <KeyValueList
                items={[
                  { label: "Success condition", value: stage.successLooksLike },
                  {
                    label: stage.evidenceLabel ?? "Evidence timestamp",
                    value: stage.evidenceAt ? formatDateTime(stage.evidenceAt) : "Not available",
                  },
                ]}
              />
              {stage.blockers.length > 0 ? (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>Current blockers</div>
                  <InlineList items={stage.blockers} />
                </div>
              ) : null}
            </Card>
          ))}
        </Grid>
      </Section>

      <Section
        title="Forecast evidence"
        description="The app still needs to prove that the shared backend forecast actually ran after the automatic bootstrap."
      >
        {overview.forecastProof ? (
          <Card tone={overview.forecastProof.readyForRecommendations ? "success" : overview.forecastProof.errorMessage ? "critical" : "warning"}>
            <KeyValueList
              items={[
                { label: "Status", value: overview.forecastProof.status ?? "Unknown" },
                { label: "Started", value: formatDateTime(overview.forecastProof.startedAt) },
                { label: "Finished", value: formatDateTime(overview.forecastProof.finishedAt) },
                { label: "Products processed", value: overview.forecastProof.productsProcessed ?? "Unknown" },
                { label: "Insufficient-history products", value: overview.forecastProof.productsWithInsufficientData ?? "Unknown" },
              ]}
            />
            {overview.recommendationReadinessReasons.length > 0 ? (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>Still blocking recommendation trust</div>
                <InlineList items={overview.recommendationReadinessReasons} />
              </div>
            ) : null}
          </Card>
        ) : (
          <EmptyState
            title="No forecast evidence yet"
            body="If setup has already imported products and transactions, the next state change should be a running or completed forecast."
          />
        )}
      </Section>

      <Section
        title="Current setup evidence"
        description="These signals summarize what the backend currently knows about this store after automatic setup."
      >
        <Grid columns={4}>
          <MetricCard label="Connection" value={overview.shopifyConnectionActive ? "Linked" : "Pending"} tone={overview.shopifyConnectionActive ? "success" : "warning"} />
          <MetricCard label="Products mapped" value={overview.totalProductCount} hint={`${overview.activeProductCount} active`} tone={overview.totalProductCount > 0 ? "accent" : "warning"} />
          <MetricCard label="Sales rows" value={overview.salesTransactionCount} hint={overview.latestSaleDate ? `Latest ${overview.latestSaleDate}` : "No sales history yet"} tone={overview.hasSalesHistory ? "success" : "warning"} />
          <MetricCard label="Recommendation ready" value={overview.recommendationReadinessReasons.length === 0 && overview.forecastProof?.readyForRecommendations ? "Yes" : "No"} hint={nextSetupStage ? nextSetupStage.summary : "Automatic bootstrap complete"} tone={overview.recommendationReadinessReasons.length === 0 && overview.forecastProof?.readyForRecommendations ? "success" : "warning"} />
        </Grid>
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
