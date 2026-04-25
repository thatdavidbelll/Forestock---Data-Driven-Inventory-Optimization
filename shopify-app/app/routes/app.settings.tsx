import { useEffect, useRef, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  ActionButton,
  AppShell,
  Badge,
  Card,
  DateTimeText,
  ErrorState,
  FieldLabel,
  InlineList,
  InputFrame,
  KeyValueList,
  RangeInput,
  Section,
  SummarySplit,
  ValuePill,
  toneForReadiness,
} from "../components";
import { updateForestockStoreConfig } from "../forestock.server";
import { loadForestockAppHomeWithRecovery, loadForestockConfigWithRecovery } from "../forestock-bootstrap.server";
import { getBillingStatus } from "../billing.server";
import { getSetupStages, type SetupStage } from "../setup-state";
import { authenticate, registerWebhooks } from "../shopify.server";
import { loadShopIdentity, runShopifyAutomaticSetup, type ShopifySetupStepResult } from "../shopify-sync.server";

type ActionData =
  | { ok: true; message: string; config: Awaited<ReturnType<typeof loadForestockConfigWithRecovery>> }
  | { ok: false; message: string };

type WebhookActionData =
  | { ok: true; message: string }
  | { ok: false; message: string };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { admin, session } = await authenticate.admin(request);
    const overview = await loadForestockAppHomeWithRecovery(admin, session.shop);
    const config = await loadForestockConfigWithRecovery(admin, session.shop);
    return { config, overview };
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
  if (status === "running") return "primary" as const;
  if (status === "failed") return "danger" as const;
  if (status === "blocked") return "warning" as const;
  if (status === "ready_to_run") return "primary" as const;
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
      subtitle="Keep setup healthy, tune the forecast horizon, and recover the Shopify connection if forecast or restock workflows break."
      actions={<Badge tone={readiness.tone}>{readiness.label}</Badge>}
    >
      <Section title="Setup health" description="This area should stay quiet once the store is healthy. Use it when sync, forecast readiness, or store setup needs attention.">
        <Card>
          <div style={{ display: "grid", gap: "var(--space-lg)" }}>
            <SummarySplit
              title={
                setupFetcher.state !== "idle"
                  ? "Forestock is preparing store data."
                  : setupBlockedExternally
                    ? "Setup is blocked outside Forestock."
                    : shouldAutoBootstrap
                      ? "Setup still needs attention."
                      : "Setup looks healthy."
              }
              body={
                setupBlockedExternally
                  ? setupFetcher.data?.externalBlock?.message ?? "Shopify approval is still blocking order import."
                  : nextSetupStage
                    ? `${nextSetupStage.title}: ${nextSetupStage.summary}`
                    : "Catalog sync, sales history, and forecasting are already in place."
              }
              aside={
                <KeyValueList
                  items={[
                    { label: "Products", value: `${overview.activeProductCount} active of ${overview.totalProductCount}` },
                    { label: "Sales history", value: overview.hasSalesHistory ? `${overview.salesTransactionCount} rows available` : "Missing" },
                    { label: "Forecast", value: overview.forecastCompletedAt ? <DateTimeText value={overview.forecastCompletedAt} /> : overview.forecastStatus ?? "Pending" },
                  ]}
                />
              }
            />

            <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap", alignItems: "center" }}>
              <setupFetcher.Form method="post">
                <input type="hidden" name="intent" value="setup" />
                <ActionButton loading={setupFetcher.state !== "idle"}>
                  {shouldAutoBootstrap ? "Run setup now" : "Try setup again"}
                </ActionButton>
              </setupFetcher.Form>
              {setupFetcher.data ? (
                <Badge tone={setupFetcher.data.ok ? "success" : "danger"}>{setupFetcher.data.message}</Badge>
              ) : null}
            </div>
          </div>
        </Card>
      </Section>

      {!setupComplete ? (
        <Section title="Setup stages" description="Show the full stage list only while setup still needs work.">
          <Card style={{ padding: 0, overflow: "hidden" }}>
            {stages.map((stage, index) => (
              <div
                key={stage.id}
                style={{
                  padding: "var(--space-lg) var(--space-xl)",
                  borderTop: index === 0 ? "none" : "1px solid var(--fs-border)",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gap: "var(--space-lg)",
                    gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))",
                    alignItems: "start",
                  }}
                >
                  <div style={{ display: "grid", gap: "var(--space-xs)" }}>
                    <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap", alignItems: "center" }}>
                      <Badge tone={stepTone(stage.status)}>{stage.status.replaceAll("_", " ")}</Badge>
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--fs-text-muted)" }}>{stage.step}</span>
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-heading)",
                        fontSize: "var(--text-lg)",
                        lineHeight: "var(--leading-tight)",
                        letterSpacing: "-0.01em",
                        fontWeight: "var(--weight-bold)",
                        color: "var(--fs-text)",
                      }}
                    >
                      {stage.title}
                    </div>
                    <div style={{ fontSize: "var(--text-sm)", lineHeight: "var(--leading-body)", color: "var(--fs-text-muted)" }}>{stage.summary}</div>
                  </div>
                  {stage.blockers.length > 0 ? (
                    <InlineList items={stage.blockers.slice(0, 2)} />
                  ) : (
                    <div style={{ fontSize: "var(--text-sm)", lineHeight: "var(--leading-body)", color: "var(--fs-text-muted)" }}>{stage.successLooksLike}</div>
                  )}
                </div>
              </div>
            ))}
          </Card>
        </Section>
      ) : null}

      <Section title="Forecast horizon" description="This is the main forecast setting most merchants may want to tune over time.">
        <Card>
          <forecastFetcher.Form method="post" style={{ display: "grid", gap: "var(--space-lg)" }}>
            <div
              style={{
                display: "grid",
                gap: "var(--space-lg)",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))",
                alignItems: "start",
              }}
            >
              <div style={{ display: "grid", gap: "var(--space-xs)" }}>
                <div style={{ fontSize: "var(--text-xs)", fontWeight: "var(--weight-bold)", letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--fs-text-muted)" }}>
                  Current horizon
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontSize: "var(--text-3xl)",
                    lineHeight: "var(--leading-tight)",
                    letterSpacing: "-0.02em",
                    fontWeight: "var(--weight-bold)",
                    color: "var(--fs-text)",
                  }}
                >
                  {forecastHorizonDays} days
                </div>
                <div style={{ fontSize: "var(--text-xs)", lineHeight: "var(--leading-body)", color: "var(--fs-text-muted)" }}>
                  {effectiveConfig.updatedAt ? <>Updated <DateTimeText value={effectiveConfig.updatedAt} /></> : "Using current store configuration"}
                </div>
              </div>
              <InputFrame>
                <FieldLabel htmlFor="forecastHorizonDays">Forecast horizon</FieldLabel>
                <RangeInput
                  id="forecastHorizonDays"
                  name="forecastHorizonDays"
                  min="3"
                  max="90"
                  step="1"
                  value={forecastHorizonDays}
                  onChange={setForecastHorizonDays}
                />
                <div style={{ marginTop: "var(--space-md)", display: "flex", gap: "var(--space-sm)", flexWrap: "wrap" }}>
                  <ValuePill>{forecastHorizonDays} days</ValuePill>
                  <span style={{ fontSize: "var(--text-sm)", lineHeight: "var(--leading-body)", color: "var(--fs-text-muted)" }}>
                    Shorter horizons stay cautious. Longer horizons favor planning further ahead.
                  </span>
                </div>
              </InputFrame>
            </div>
            <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap", alignItems: "center" }}>
              <ActionButton loading={forecastFetcher.state !== "idle"}>
                Save horizon
              </ActionButton>
              {forecastFetcher.data ? (
                <Badge tone={forecastFetcher.data.ok ? "success" : "danger"}>{forecastFetcher.data.message}</Badge>
              ) : null}
            </div>
          </forecastFetcher.Form>
        </Card>
      </Section>

      <Section title="Maintenance" description="Use this only if the Shopify connection broke or reinstall did not finish cleanly.">
        <Card tone="subtle">
          <div style={{ display: "grid", gap: "var(--space-md)" }}>
            <div style={{ fontSize: "var(--text-sm)", lineHeight: "var(--leading-body)", color: "var(--fs-text-muted)", maxWidth: "60ch" }}>
              Re-register webhooks if events stopped arriving after a reinstall or a broken setup cycle.
            </div>
            <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap", alignItems: "center" }}>
              <webhookFetcher.Form method="post">
                <input type="hidden" name="intent" value="reregister-webhooks" />
                <ActionButton loading={webhookFetcher.state !== "idle"} tone="secondary">
                  Register webhooks again
                </ActionButton>
              </webhookFetcher.Form>
              {webhookFetcher.data ? (
                <Badge tone={webhookFetcher.data.ok ? "success" : "danger"}>{webhookFetcher.data.message}</Badge>
              ) : null}
            </div>
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
