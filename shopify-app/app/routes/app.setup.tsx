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
    if (intent === "provision" || intent === "catalog" || intent === "orders" || intent === "full") {
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

function StepStatusBadge({
  completed,
  failed,
  running,
}: {
  completed: boolean;
  failed?: boolean;
  running?: boolean;
}) {
  if (running) return <Badge tone="accent">Running</Badge>;
  if (failed) return <Badge tone="critical">Needs attention</Badge>;
  if (completed) return <Badge tone="success">Completed</Badge>;
  return <Badge tone="warning">Pending</Badge>;
}

function ActionSection({
  step,
  title,
  description,
  buttonLabel,
  intent,
  fetcher,
  successLooksLike,
  complete,
}: {
  step: string;
  title: string;
  description: string;
  buttonLabel: string;
  intent: ActionData["intent"];
  fetcher: ReturnType<typeof useFetcher<ActionData>>;
  successLooksLike: string;
  complete: boolean;
}) {
  const busy = fetcher.state !== "idle";
  const result = fetcher.data?.intent === intent ? fetcher.data : undefined;
  const failed = Boolean(result && !result.ok);

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 800, color: "#52606d", marginBottom: 6 }}>
            {step}
          </div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{title}</div>
        </div>
        <StepStatusBadge completed={complete || Boolean(result?.ok)} failed={failed} running={busy} />
      </div>
      <div style={{ color: "#52606d", lineHeight: 1.7, marginBottom: 12 }}>{description}</div>
      <div style={{ fontSize: 14, marginBottom: 14 }}>
        <strong>Success looks like:</strong> {successLooksLike}
      </div>
      <fetcher.Form method="post">
        <input type="hidden" name="intent" value={intent} />
        <ActionButton loading={busy}>{buttonLabel}</ActionButton>
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
  const readiness = toneForReadiness({
    activeProductCount: overview.activeProductCount,
    hasSalesHistory: overview.hasSalesHistory,
    forecastStatus: overview.forecastStatus,
  });
  const provisioned = overview.shopifyConnectionActive;
  const catalogReady = overview.totalProductCount > 0;
  const ordersReady = overview.hasSalesHistory;
  const forecastReady = Boolean(overview.forecastProof);
  const recommendationsReady = overview.recommendationReadinessReasons.length === 0 && overview.forecastProof?.readyForRecommendations;

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

      <Section title="Shop identity" description="This is the Shopify store Forestock is linking and importing from.">
        <Grid columns={3}>
          <MetricCard label="Shop name" value={shopName} tone="subtle" />
          <MetricCard label="Shop domain" value={shopDomain} tone="subtle" />
          <MetricCard label="Current state" value={readiness.label} tone={readiness.tone} />
        </Grid>
      </Section>

      <Section
        title="Recommended first-run path"
        description="Run the full setup for a fresh install. Use the individual controls only when you are retrying a failed step or validating a single sync stage."
      >
        <Card tone="accent">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Run complete setup</div>
              <div style={{ color: "#52606d", lineHeight: 1.7, maxWidth: 760 }}>
                This links the Forestock workspace, imports the Shopify catalog and inventory snapshot, and backfills the most recent 60 days of order history so the existing forecast engine has usable data.
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
        title="Setup tracker"
        description="A merchant or operator should be able to tell which stages are complete, which can be retried, and whether recommendations are actually trustworthy."
      >
        <Grid columns={2}>
          <ActionSection
            step="Step 1"
            title="Link store to Forestock"
            description="Create or reconnect the store workspace without importing catalog or order history yet."
            buttonLabel="Link workspace"
            intent="provision"
            fetcher={provisionFetcher}
            successLooksLike="The store is linked to a Forestock workspace and the connection remains active."
            complete={provisioned}
          />
          <ActionSection
            step="Step 2"
            title="Import catalog and inventory"
            description="Pull the live Shopify catalog and inventory positions into the backend so products can be forecasted and matched."
            buttonLabel="Import catalog"
            intent="catalog"
            fetcher={catalogFetcher}
            successLooksLike="Products are processed, created or updated, and inventory snapshots are recorded."
            complete={catalogReady}
          />
          <ActionSection
            step="Step 3"
            title="Import order history"
            description="Backfill the most recent 60 days of Shopify order history so the shared forecast engine has demand history to learn from."
            buttonLabel="Import orders"
            intent="orders"
            fetcher={ordersFetcher}
            successLooksLike="Orders are imported, line items are matched, and sales rows are written for forecasting."
            complete={ordersReady}
          />
          {overview.forecastProof ? (
            <Card tone={overview.forecastProof.readyForRecommendations ? "success" : overview.forecastProof.errorMessage ? "critical" : "warning"}>
              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 800, color: "#52606d", marginBottom: 6 }}>
                Step 4
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 10 }}>Forecast proof</div>
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
              title="Step 4: Forecast proof missing"
              body="Imports alone are not enough. We still need evidence that a forecast has actually started or completed for this store before treating recommendations as trustworthy."
            />
          )}
        </Grid>
      </Section>

      <Section
        title="Current setup evidence"
        description="These signals summarize what the backend currently knows about this store after provisioning and sync activity."
      >
        <Grid columns={4}>
          <MetricCard label="Connection" value={provisioned ? "Linked" : "Pending"} tone={provisioned ? "success" : "warning"} />
          <MetricCard label="Products mapped" value={overview.totalProductCount} hint={`${overview.activeProductCount} active`} tone={catalogReady ? "accent" : "warning"} />
          <MetricCard label="Sales rows" value={overview.salesTransactionCount} hint={overview.latestSaleDate ? `Latest ${overview.latestSaleDate}` : "No sales history yet"} tone={ordersReady ? "success" : "warning"} />
          <MetricCard label="Recommendation ready" value={recommendationsReady ? "Yes" : "No"} hint={forecastReady ? "Forecast evidence found" : "Forecast evidence missing"} tone={recommendationsReady ? "success" : "warning"} />
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
