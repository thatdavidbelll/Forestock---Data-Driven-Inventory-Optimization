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
  Section,
  formatDateTime,
  toneForReadiness,
} from "../components";
import { getForestockAppHome } from "../forestock.server";
import { getSetupStages, type SetupStage } from "../setup-state";
import { authenticate } from "../shopify.server";
import { loadShopIdentity, runShopifyAutomaticSetup, type ShopifySetupStepResult } from "../shopify-sync.server";

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
      subtitle="This page should only answer two questions: is automatic setup running, and what is still blocking readiness."
      actions={<Badge tone={readiness.tone}>{readiness.label}</Badge>}
    >
      <InfoBanner
        title="Automatic setup"
        body={
          shouldAutoBootstrap
            ? "Forestock is responsible for linking the store, importing products and transactions, and starting the forecast. The merchant should not have to run separate setup steps."
            : "Automatic setup has completed its core work for this store."
        }
        tone={shouldAutoBootstrap ? "accent" : "success"}
      />

      <Section title="Bootstrap status" description="Retry only if setup failed or was interrupted.">
        <Card tone={setupFetcher.state !== "idle" ? "accent" : shouldAutoBootstrap ? "warning" : "success"}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
                {setupFetcher.state !== "idle"
                  ? "Preparing store data..."
                  : shouldAutoBootstrap
                    ? "Setup still needs to finish"
                    : "Setup completed"}
              </div>
              <div style={{ color: "rgba(226, 232, 240, 0.92)", lineHeight: 1.65, maxWidth: 760, fontSize: 15 }}>
                {nextSetupStage
                  ? `${nextSetupStage.title}: ${nextSetupStage.summary}`
                  : "Products, transactions, and forecast proof are already in place."}
              </div>
            </div>
            <setupFetcher.Form method="post">
              <ActionButton loading={setupFetcher.state !== "idle"}>
                {shouldAutoBootstrap ? "Retry setup" : "Run setup again"}
              </ActionButton>
            </setupFetcher.Form>
          </div>
          {setupFetcher.data ? (
            <div style={{ marginTop: 16 }}>
              <KeyValueList
                items={[
                  { label: "Result", value: setupFetcher.data.message },
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
            <Card key={stage.id} tone={stepTone(stage.status)}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 10, flexWrap: "wrap" }}>
                <div style={{ fontSize: 19, fontWeight: 800 }}>{stage.title}</div>
                <Badge tone={stepTone(stage.status)}>{stage.status.replaceAll("_", " ")}</Badge>
              </div>
              <div style={{ color: "rgba(226, 232, 240, 0.9)", lineHeight: 1.65, marginBottom: 12, fontSize: 15 }}>{stage.summary}</div>
              {stage.blockers.length > 0 ? <InlineList items={stage.blockers.slice(0, 2)} /> : null}
              {stage.evidenceAt ? (
                <div style={{ marginTop: 10, fontSize: 14, color: "rgba(226, 232, 240, 0.88)" }}>
                  {stage.evidenceLabel ?? "Evidence"}: {formatDateTime(stage.evidenceAt)}
                </div>
              ) : null}
            </Card>
          ))}
        </Grid>
      </Section>

      <Section title="Forecast proof" description="Only show this because recommendations depend on it.">
        {overview.forecastProof ? (
          <Card tone={overview.forecastProof.readyForRecommendations ? "success" : overview.forecastProof.errorMessage ? "critical" : "warning"}>
            <KeyValueList
              items={[
                { label: "Status", value: overview.forecastProof.status ?? "Unknown" },
                { label: "Started", value: formatDateTime(overview.forecastProof.startedAt) },
                { label: "Finished", value: formatDateTime(overview.forecastProof.finishedAt) },
                { label: "Horizon", value: overview.forecastProof.horizonDays != null ? `${overview.forecastProof.horizonDays} days` : "Unknown" },
              ]}
            />
          </Card>
        ) : (
          <EmptyState
            title="No forecast proof yet"
            body="Once imports finish, the next state change should be a running or completed forecast."
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

