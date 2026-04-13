import { useEffect, useRef, useState } from "react";
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
  FieldLabel,
  InputFrame,
  MetricCard,
  RangeInput,
  Section,
  SummarySplit,
  ValuePill,
  formatDateTime,
  toneForReadiness,
} from "../components";
import {
  getForestockAppHome,
  getForestockStoreConfig,
  updateForestockStoreConfig,
} from "../forestock.server";
import { getBillingStatus } from "../billing.server";
import { getSetupStages, type SetupStage } from "../setup-state";
import { authenticate, registerWebhooks } from "../shopify.server";
import { loadShopIdentity, runShopifyAutomaticSetup, type ShopifySetupStepResult } from "../shopify-sync.server";

type ActionData =
  | { ok: true; message: string; config: Awaited<ReturnType<typeof getForestockStoreConfig>> }
  | { ok: false; message: string };

type WebhookActionData =
  | { ok: true; message: string }
  | { ok: false; message: string };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { admin, session } = await authenticate.admin(request);
    const identity = await loadShopIdentity(admin, session.shop);
    const overview = await getForestockAppHome(session.shop);
    const config = await getForestockStoreConfig(session.shop);
    return { shopDomain: session.shop, config, identity, overview };
  } catch (error) {
    if (error instanceof Response) throw error;
    throw new Response(error instanceof Error ? error.message : "Failed to load store settings.", {
      status: 500,
      statusText: "Settings Error",
    });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "setup") {
    const { admin, session } = await authenticate.admin(request);
    const billing = await getBillingStatus(admin);
    if (!billing.hasActiveSubscription) {
      return {
        intent: "full",
        ok: false,
        message: "Activate a Shopify plan for Forestock before running setup.",
      } satisfies ShopifySetupStepResult;
    }
    const identity = await loadShopIdentity(admin, session.shop);

    try {
      return await runShopifyAutomaticSetup({
        admin,
        shopDomain: identity.shopDomain,
        shopName: identity.shopName,
        currencyCode: identity.currencyCode,
        moneyFormat: identity.moneyFormat,
      });
    } catch (error) {
      return {
        intent: "full",
        ok: false,
        message: error instanceof Error ? error.message : "Automatic setup failed.",
      } satisfies ShopifySetupStepResult;
    }
  }

  if (intent === "reregister-webhooks") {
    const { session } = await authenticate.admin(request);
    try {
      await registerWebhooks({ session });
      return { ok: true, message: "Webhooks re-registered successfully." } satisfies WebhookActionData;
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Failed to re-register webhooks.",
      } satisfies WebhookActionData;
    }
  }

  const { admin, session } = await authenticate.admin(request);
  const billing = await getBillingStatus(admin);
  if (!billing.hasActiveSubscription) {
    return { ok: false, message: "Activate a Shopify plan for Forestock before changing settings." } satisfies ActionData;
  }
  const forecastHorizonDays = Number(formData.get("forecastHorizonDays"));

  if (!Number.isFinite(forecastHorizonDays)) {
    return { ok: false, message: "Forecast horizon must be a number." } satisfies ActionData;
  }

  if (forecastHorizonDays < 3 || forecastHorizonDays > 90) {
    return { ok: false, message: "Forecast horizon must be between 3 and 90 days." } satisfies ActionData;
  }

  try {
    const config = await updateForestockStoreConfig(session.shop, { forecastHorizonDays });
    return { ok: true, message: `Forecast horizon updated to ${config.forecastHorizonDays} days.`, config } satisfies ActionData;
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Failed to update forecast horizon.",
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

export default function SettingsPage() {
  const { config, overview } = useLoaderData<typeof loader>();
  const setupFetcher = useFetcher<ShopifySetupStepResult>();
  const forecastFetcher = useFetcher<ActionData>();
  const webhookFetcher = useFetcher<WebhookActionData>();
  const autoSubmitted = useRef(false);
  const effectiveConfig = forecastFetcher.data?.ok ? forecastFetcher.data.config : config;
  const [forecastHorizonDays, setForecastHorizonDays] = useState(
    Math.min(90, Math.max(3, effectiveConfig.forecastHorizonDays)),
  );
  const readiness = toneForReadiness({
    activeProductCount: overview.activeProductCount,
    hasSalesHistory: overview.hasSalesHistory,
    forecastStatus: overview.forecastStatus,
  });
  const stages = getSetupStages(overview);
  const setupComplete = stages.every((stage) => stage.status === "completed");
  const nextSetupStage = stages.find((stage) => stage.status !== "completed");
  const setupBlockedExternally = Boolean(setupFetcher.data?.externalBlock);
  const shouldAutoBootstrap = !setupBlockedExternally && shouldAutoRunSetup(stages);

  useEffect(() => {
    setForecastHorizonDays(Math.min(90, Math.max(3, effectiveConfig.forecastHorizonDays)));
  }, [effectiveConfig.forecastHorizonDays]);

  useEffect(() => {
    if (autoSubmitted.current || !shouldAutoBootstrap || setupFetcher.state !== "idle") {
      return;
    }

    autoSubmitted.current = true;
    setupFetcher.submit({ intent: "setup" }, { method: "post" });
  }, [setupFetcher, shouldAutoBootstrap]);

  return (
    <AppShell
      title="Settings"
      actions={
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <Badge tone="subtle">Store config</Badge>
        </div>
      }
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
          />
          <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid #E5E7EB" }}>
            <Grid columns={3}>
              <MetricCard label="Products" value={overview.activeProductCount} hint={`${overview.totalProductCount} total synced`} tone="subtle" />
              <MetricCard label="Sales history" value={overview.hasSalesHistory ? "Available" : "Missing"} hint={`${overview.salesTransactionCount} rows`} tone={overview.hasSalesHistory ? "success" : "warning"} />
              <MetricCard label="Forecast" value={overview.forecastStatus ?? "Pending"} hint={overview.forecastCompletedAt ? formatDateTime(overview.forecastCompletedAt) : "No completed run yet"} tone={overview.forecastStatus?.toUpperCase().includes("COMPLETED") ? "success" : "accent"} />
            </Grid>
          </div>
          <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <Badge tone={readiness.tone}>{readiness.label}</Badge>
            <setupFetcher.Form method="post">
              <input type="hidden" name="intent" value="setup" />
              <ActionButton loading={setupFetcher.state !== "idle"}>
                {shouldAutoBootstrap ? "Retry setup" : "Run setup again"}
              </ActionButton>
            </setupFetcher.Form>
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

      {!setupComplete ? (
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
      ) : null}

      <Section
        title="Forecast horizon"
        description="This changes how many days the shared backend forecast projects forward for this store."
      >
        <Card>
          <forecastFetcher.Form method="post" style={{ display: "grid", gap: 20 }}>
            <MetricCard
              label="Current horizon"
              value={`${forecastHorizonDays} days`}
              hint={effectiveConfig.updatedAt ? `Updated ${new Date(effectiveConfig.updatedAt).toLocaleString()}` : "Using current store configuration"}
              tone="accent"
            />
            <InputFrame>
              <FieldLabel htmlFor="forecastHorizonDays">Horizon days</FieldLabel>
              <RangeInput
                id="forecastHorizonDays"
                name="forecastHorizonDays"
                min="3"
                max="90"
                step="1"
                value={forecastHorizonDays}
                onChange={setForecastHorizonDays}
              />
              <div style={{ marginTop: 14 }}>
                <ValuePill>{forecastHorizonDays} days</ValuePill>
              </div>
              <div style={{ marginTop: 8, fontSize: 14, color: "#64748b" }}>
                Choose a value between 3 and 90 days.
              </div>
            </InputFrame>
            <div>
              <s-button type="submit" loading={forecastFetcher.state !== "idle"}>
                Save horizon
              </s-button>
            </div>
          </forecastFetcher.Form>
          {forecastFetcher.data ? (
            <div style={{ marginTop: 16 }}>
              <Badge tone={forecastFetcher.data.ok ? "success" : "critical"}>{forecastFetcher.data.message}</Badge>
            </div>
          ) : null}
        </Card>
      </Section>

      <Section title="Webhook health" description="Re-register Shopify webhooks if delivery has drifted out of sync.">
        <Card>
          <div style={{ display: "grid", gap: 16 }}>
            <webhookFetcher.Form method="post">
              <input type="hidden" name="intent" value="reregister-webhooks" />
              <ActionButton loading={webhookFetcher.state !== "idle"}>Re-register webhooks</ActionButton>
            </webhookFetcher.Form>
            {webhookFetcher.data ? (
              <Badge tone={webhookFetcher.data.ok ? "success" : "critical"}>{webhookFetcher.data.message}</Badge>
            ) : null}
          </div>
        </Card>
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
