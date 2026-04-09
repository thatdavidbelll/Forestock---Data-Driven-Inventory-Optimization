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
  runShopifySetupIntent,
  type ShopifySetupIntent,
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
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "") as ShopifySetupIntent;

  try {
    if (intent === "provision" || intent === "catalog" || intent === "orders" || intent === "forecast" || intent === "full") {
      return await runShopifySetupIntent({
        intent,
        admin,
        shopDomain: identity.shopDomain,
        shopName: identity.shopName,
      });
    }

    return {
      intent: "full",
      ok: false,
      message: "Unknown setup action.",
    } satisfies ActionData;
  } catch (error) {
    return {
      intent: intent || "full",
      ok: false,
      message: error instanceof Error ? error.message : "Setup action failed.",
    } satisfies ActionData;
  }
};

function StepResult({ data }: { data: ActionData | undefined }) {
  if (!data) return null;

  return (
    <Card tone={data.ok ? "success" : "critical"}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 17, fontWeight: 800 }}>{data.message}</div>
        <Badge tone={data.ok ? "success" : "critical"}>{data.ok ? "Completed" : "Failed"}</Badge>
      </div>
      {data.provisioned ? (
        <KeyValueList
          items={[
            { label: "Workspace", value: data.provisioned.storeName },
            { label: "Workspace slug", value: data.provisioned.storeSlug },
            { label: "Admin username", value: data.provisioned.adminUsername ?? "Pending" },
            { label: "Store created in this run", value: data.provisioned.createdStore ? "Yes" : "No" },
          ]}
        />
      ) : null}
      {data.catalogSync ? (
        <KeyValueList
          items={[
            { label: "Products processed", value: data.catalogSync.processedItems },
            { label: "Products created", value: data.catalogSync.createdProducts },
            { label: "Products updated", value: data.catalogSync.updatedProducts },
            { label: "Inventory snapshots created", value: data.catalogSync.inventorySnapshotsCreated },
          ]}
        />
      ) : null}
      {data.orderBackfill ? (
        <KeyValueList
          items={[
            { label: "Orders imported", value: data.orderBackfill.importedOrders },
            { label: "Duplicates skipped", value: data.orderBackfill.duplicateOrders },
            { label: "Matched line items", value: data.orderBackfill.matchedLineItems },
            { label: "Unmatched line items", value: data.orderBackfill.unmatchedLineItems },
            { label: "Sales rows written", value: data.orderBackfill.salesRowsUpserted },
          ]}
        />
      ) : null}
    </Card>
  );
}

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

function StepStatusBadge({ status }: { status: SetupStage["status"] }) {
  return <Badge tone={stepTone(status)}>{stepStatusLabel(status)}</Badge>;
}

function ActionSection({
  stage,
  description,
  buttonLabel,
  intent,
  fetcher,
  disabled,
}: {
  stage: SetupStage;
  description: string;
  buttonLabel: string;
  intent: ActionData["intent"];
  fetcher: ReturnType<typeof useFetcher<ActionData>>;
  disabled?: boolean;
}) {
  const busy = fetcher.state !== "idle";
  const result = fetcher.data?.intent === intent ? fetcher.data : undefined;
  const status = busy
    ? "running"
    : result
      ? result.ok
        ? "completed"
        : "failed"
      : stage.status;
  const buttonTone = stage.status === "completed" ? "secondary" : "primary";

  return (
    <Card tone={stepTone(status)}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 800, color: "#52606d", marginBottom: 6 }}>
            {stage.step}
          </div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{stage.title}</div>
        </div>
        <StepStatusBadge status={status} />
      </div>
      <div style={{ color: "#52606d", lineHeight: 1.7, marginBottom: 12 }}>{description}</div>
      <div style={{ fontSize: 14, marginBottom: 14 }}>
        <strong>Success looks like:</strong> {stage.successLooksLike}
      </div>
      <div style={{ marginBottom: 14 }}>
        <KeyValueList
          items={[
            { label: "Current state", value: stepStatusLabel(status) },
            { label: "State summary", value: stage.summary },
            {
              label: stage.evidenceLabel ?? "Evidence timestamp",
              value: stage.evidenceAt ? formatDateTime(stage.evidenceAt) : "Not available",
            },
          ]}
        />
      </div>
      {stage.blockers.length > 0 ? (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>Current blockers</div>
          <InlineList items={stage.blockers} />
        </div>
      ) : null}
      <fetcher.Form method="post">
        <input type="hidden" name="intent" value={intent} />
        <ActionButton loading={busy} tone={buttonTone}>{disabled ? "Blocked" : buttonLabel}</ActionButton>
      </fetcher.Form>
      {result ? <div style={{ marginTop: 14 }}><StepResult data={result} /></div> : null}
    </Card>
  );
}

export default function SetupPage() {
  const { shopName, shopDomain, overview } = useLoaderData<typeof loader>();
  const fullSetupFetcher = useFetcher<ActionData>();
  const provisionFetcher = useFetcher<ActionData>();
  const catalogFetcher = useFetcher<ActionData>();
  const ordersFetcher = useFetcher<ActionData>();
  const forecastFetcher = useFetcher<ActionData>();
  const readiness = toneForReadiness({
    activeProductCount: overview.activeProductCount,
    hasSalesHistory: overview.hasSalesHistory,
    forecastStatus: overview.forecastStatus,
  });
  const provisioned = overview.shopifyConnectionActive;
  const catalogReady = overview.totalProductCount > 0;
  const ordersReady = overview.hasSalesHistory;
  const recommendationsReady = overview.recommendationReadinessReasons.length === 0 && overview.forecastProof?.readyForRecommendations;
  const stages = getSetupStages(overview);
  const provisionStage = stages.find((stage) => stage.id === "provision")!;
  const catalogStage = stages.find((stage) => stage.id === "catalog")!;
  const ordersStage = stages.find((stage) => stage.id === "orders")!;
  const forecastStage = stages.find((stage) => stage.id === "forecast")!;
  const recommendationsStage = stages.find((stage) => stage.id === "recommendations")!;
  const nextSetupStage = stages.find((stage) => stage.status !== "completed");

  return (
    <AppShell
      title="Setup"
      subtitle="Guide the merchant from install to usable recommendations. This page should make linkage, imports, and forecast readiness explicit and recoverable."
      actions={<Badge tone={readiness.tone}>{readiness.label}</Badge>}
    >
      <InfoBanner
        title="Forecast parity rule"
        body="The Shopify app does not implement a separate forecast algorithm. It provisions data, exposes sync health, and displays the same backend forecast and recommendation output used by the website."
        tone="subtle"
      />

      <InfoBanner
        title="Canonical setup state"
        body={
          nextSetupStage
            ? `${nextSetupStage.step}: ${nextSetupStage.title}. ${nextSetupStage.summary}`
            : "All five setup stages are currently satisfied. The merchant can move to recommendation review with explicit forecast proof."
        }
        tone={nextSetupStage ? stepTone(nextSetupStage.status) : "success"}
      />

      <Section title="Shop identity" description="This is the Shopify store Forestock is linking and importing from.">
        <Grid columns={3}>
          <MetricCard label="Shop name" value={shopName} tone="subtle" />
          <MetricCard label="Shop domain" value={shopDomain} tone="subtle" />
          <MetricCard label="Current state" value={readiness.label} tone={readiness.tone} />
        </Grid>
      </Section>

      <Section
        title="Canonical setup tracker"
        description="Each stage has an explicit state, evidence timestamp when available, and retry path. This should behave like a state machine, not a loose checklist."
      >
        <Grid columns={2}>
          {stages.map((stage) => (
            <Card key={stage.id} tone={stepTone(stage.status)}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 800, color: "#52606d", marginBottom: 6 }}>
                    {stage.step}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{stage.title}</div>
                </div>
                <StepStatusBadge status={stage.status} />
              </div>
              <div style={{ color: "#52606d", lineHeight: 1.7, marginBottom: 12 }}>{stage.summary}</div>
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
                  <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>Blockers</div>
                  <InlineList items={stage.blockers} />
                </div>
              ) : null}
            </Card>
          ))}
        </Grid>
      </Section>

      <Section
        title="Recommended first-run path"
        description="Run the full setup for a fresh install. Use the individual controls only when you are retrying a failed stage or validating one part of the pipeline."
      >
        <Card tone="accent">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Run complete setup</div>
              <div style={{ color: "#52606d", lineHeight: 1.7, maxWidth: 760 }}>
                This links the Forestock workspace, imports the Shopify catalog and inventory snapshot, and backfills the most recent 60 days of order history so the existing forecast engine has usable data.
                It then starts a forecast run in the backend.
              </div>
            </div>
            <fullSetupFetcher.Form method="post">
              <input type="hidden" name="intent" value="full" />
              <ActionButton loading={fullSetupFetcher.state !== "idle"}>Run complete setup</ActionButton>
            </fullSetupFetcher.Form>
          </div>
          {fullSetupFetcher.data ? (
            <div style={{ marginTop: 16 }}>
              <StepResult data={fullSetupFetcher.data} />
            </div>
          ) : null}
        </Card>
      </Section>

      <Section
        title="Stage controls"
        description="These controls intentionally mirror the state machine above. Use them to retry a blocked or failed stage without re-running unrelated work."
      >
        <Grid columns={2}>
          <ActionSection
            stage={provisionStage}
            description="Create or reconnect the store workspace without importing catalog or order history yet."
            buttonLabel="Link workspace"
            intent="provision"
            fetcher={provisionFetcher}
          />
          <ActionSection
            stage={catalogStage}
            description="Pull the live Shopify catalog and inventory positions into the backend so products can be forecasted and matched."
            buttonLabel="Import catalog"
            intent="catalog"
            fetcher={catalogFetcher}
          />
          <ActionSection
            stage={ordersStage}
            description="Backfill the most recent 60 days of Shopify order history so the shared forecast engine has demand history to learn from."
            buttonLabel="Import orders"
            intent="orders"
            fetcher={ordersFetcher}
          />
          <ActionSection
            stage={forecastStage}
            description="Start the backend forecast cycle after catalog and order history are ready so recommendations can be generated."
            buttonLabel="Run forecast"
            intent="forecast"
            fetcher={forecastFetcher}
          />
        </Grid>
      </Section>

      <Section
        title="Forecast evidence"
        description="Once a run has started, this card should show whether the backend actually processed products and finished cleanly."
      >
        {overview.forecastProof ? (
          <Card tone={stepTone(forecastStage.status)}>
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
                <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>Still blocking recommendation trust:</div>
                <InlineList items={overview.recommendationReadinessReasons} />
              </div>
            ) : null}
          </Card>
        ) : (
          <EmptyState
            title={`${forecastStage.step}: ${forecastStage.title} missing`}
            body="Imports alone are not enough. We still need evidence that a forecast has actually started or completed for this store before treating recommendations as trustworthy."
          />
        )}
      </Section>

      <Section
        title="Current setup evidence"
        description="These signals summarize what the backend currently knows about this store after provisioning and sync activity."
      >
        <Grid columns={4}>
          <MetricCard label="Connection" value={provisioned ? "Linked" : "Pending"} tone={provisioned ? "success" : "warning"} />
          <MetricCard label="Products mapped" value={overview.totalProductCount} hint={`${overview.activeProductCount} active`} tone={catalogReady ? "accent" : "warning"} />
          <MetricCard label="Sales rows" value={overview.salesTransactionCount} hint={overview.latestSaleDate ? `Latest ${overview.latestSaleDate}` : "No sales history yet"} tone={ordersReady ? "success" : "warning"} />
          <MetricCard label="Recommendation ready" value={recommendationsReady ? "Yes" : "No"} hint={recommendationsStage.summary} tone={recommendationsReady ? "success" : "warning"} />
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
