import { useEffect, useRef } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  ActionButton,
  AppShell,
  Badge,
  Card,
  ErrorState,
  Grid,
  InlineList,
  KeyValueList,
  MetricCard,
  Section,
  SummarySplit,
  formatDateTime,
  toneForReadiness,
} from "../components";
import { getForestockAppHome } from "../forestock.server";
import { getSetupStages, type SetupStage } from "../setup-state";
import { authenticate } from "../shopify.server";
import { loadShopIdentity, runShopifyAutomaticSetup, type ShopifySetupStepResult } from "../shopify-sync.server";

type ActionData = ShopifySetupStepResult;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { admin, session } = await authenticate.admin(request);
    const identity = await loadShopIdentity(admin, session.shop);
    const overview = await getForestockAppHome(session.shop);
    return { ...identity, overview };
  } catch (error) {
    if (error instanceof Response) throw error;
    throw new Response(error instanceof Error ? error.message : "Failed to load setup state.", {
      status: 500,
      statusText: "Setup Error",
    });
  }
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

function shouldAutoRunSetup(stages: SetupStage[]) {
  return stages.some(
    (stage) =>
      stage.id !== "recommendations" &&
      stage.status !== "completed" &&
      stage.status !== "running",
  );
}

export default function SetupPage() {
  const { overview } = useLoaderData<typeof loader>();
  const setupFetcher = useFetcher<ActionData>();
  const autoSubmitted = useRef(false);

  const readiness = toneForReadiness({
    activeProductCount: overview.activeProductCount,
    hasSalesHistory: overview.hasSalesHistory,
    forecastStatus: overview.forecastStatus,
  });
  const stages = getSetupStages(overview);
  const nextSetupStage = stages.find((stage) => stage.status !== "completed");
  const setupBlockedExternally = Boolean(setupFetcher.data?.externalBlock);
  const shouldAutoBootstrap = !setupBlockedExternally && shouldAutoRunSetup(stages);

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
      subtitle="A clean status view for store readiness, data import, and forecast progress."
      actions={<Badge tone={readiness.tone}>{readiness.label}</Badge>}
    >
      <Section title="Setup status" description="We handle the setup for you.">
        <Card>
          <SummarySplit
            title={
              setupFetcher.state !== "idle"
                ? "Preparing store data..."
                : setupBlockedExternally
                  ? "Setup is externally blocked"
                  : shouldAutoBootstrap
                    ? "Setup still needs to finish"
                    : "Setup completed"
            }
            body={
              setupBlockedExternally
                ? setupFetcher.data?.externalBlock?.message ??
                  "Shopify approval is still blocking order import."
                : nextSetupStage
                  ? `${nextSetupStage.title}: ${nextSetupStage.summary}`
                  : "Everything needed for recommendations is in place."
            }
            aside={
              <setupFetcher.Form method="post">
                <ActionButton loading={setupFetcher.state !== "idle"}>
                  {shouldAutoBootstrap ? "Retry setup" : "Run setup again"}
                </ActionButton>
              </setupFetcher.Form>
            }
          />
          <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid #E5E7EB" }}>
            <Grid columns={3}>
              <MetricCard label="Products" value={overview.activeProductCount} hint={`${overview.totalProductCount} total synced`} tone="subtle" />
              <MetricCard label="Sales history" value={overview.hasSalesHistory ? "Available" : "Missing"} hint={`${overview.salesTransactionCount} rows`} tone={overview.hasSalesHistory ? "success" : "warning"} />
              <MetricCard label="Forecast" value={overview.forecastStatus ?? "Pending"} hint={overview.forecastCompletedAt ? formatDateTime(overview.forecastCompletedAt) : "No completed run yet"} tone={overview.forecastStatus?.toUpperCase().includes("COMPLETED") ? "success" : "accent"} />
            </Grid>
          </div>
          {setupFetcher.data ? (
            <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid #E5E7EB" }}>
              <KeyValueList
                items={[
                  { label: "Result", value: setupFetcher.data.message },
                  { label: "External blocker", value: setupFetcher.data.externalBlock?.message ?? "None" },
                  { label: "Products processed", value: setupFetcher.data.catalogSync?.processedItems ?? "Not available" },
                  { label: "Orders imported", value: setupFetcher.data.orderBackfill?.importedOrders ?? "Not available" },
                  { label: "Forecast started", value: setupFetcher.data.forecastTriggered ? "Yes" : "No" },
                ]}
              />
            </div>
          ) : null}
        </Card>
      </Section>

      <Section title="Progress" description="Keep the stage list compact and factual.">
        <Grid columns={2}>
          {stages.map((stage) => (
            <Card key={stage.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 12, flexWrap: "wrap" }}>
                <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>{stage.title}</div>
                <Badge tone={stepTone(stage.status)}>{stage.status.replaceAll("_", " ")}</Badge>
              </div>
              <div style={{ color: "#6B7280", lineHeight: 1.65, marginBottom: 12, fontSize: 14 }}>{stage.summary}</div>
              {stage.blockers.length > 0 ? <InlineList items={stage.blockers.slice(0, 2)} /> : null}
              {stage.evidenceAt ? (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #E5E7EB", fontSize: 13, color: "#6B7280" }}>
                  {stage.evidenceLabel ?? "Evidence"}: {formatDateTime(stage.evidenceAt)}
                </div>
              ) : null}
            </Card>
          ))}
        </Grid>
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
