import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Link, useFetcher, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  ActionButton,
  AppShell,
  Badge,
  Card,
  DateTimeText,
  ErrorState,
  MetricCard,
  Section,
} from "../components";
import { getForestockAppHome, getForestockStoreConfig } from "../forestock.server";
import { getBillingStatus } from "../billing.server";
import { getSetupStages } from "../setup-state";
import { authenticate } from "../shopify.server";
import { loadShopIdentity, runShopifyAutomaticSetup, type ShopifySetupStepResult } from "../shopify-sync.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { admin, session } = await authenticate.admin(request);
    const identity = await loadShopIdentity(admin, session.shop);
    const overview = await getForestockAppHome(session.shop);
    const config = await getForestockStoreConfig(session.shop);
    return { shopDomain: session.shop, config, identity, overview };
  } catch (error) {
    if (error instanceof Response) throw error;
    throw new Response(error instanceof Error ? error.message : "Failed to load onboarding.", {
      status: 500,
      statusText: "Onboarding Error",
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

  return {
    intent: "full",
    ok: false,
    message: "Unsupported onboarding action.",
  } satisfies ShopifySetupStepResult;
};

function stepTone(status: ReturnType<typeof getSetupStages>[number]["status"]) {
  if (status === "completed") return "success" as const;
  if (status === "running") return "accent" as const;
  if (status === "failed") return "critical" as const;
  if (status === "blocked") return "warning" as const;
  if (status === "ready_to_run") return "accent" as const;
  return "subtle" as const;
}

export default function OnboardingPage() {
  const { overview } = useLoaderData<typeof loader>();
  const setupFetcher = useFetcher<ShopifySetupStepResult>();
  const stages = getSetupStages(overview);
  const setupComplete = stages.every((stage) => stage.status === "completed");

  return (
    <AppShell title="Onboarding">
      <Section title="Get started" description="Complete the initial Forestock setup for this store.">
        <Card>
          <div style={{ display: "grid", gap: 24 }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", color: "#0F172A" }}>
                Forestock is getting ready
              </div>
              <div style={{ marginTop: 8, fontSize: 15, lineHeight: 1.6, color: "#64748B" }}>
                Review the setup stages below and run setup when you&apos;re ready.
              </div>
            </div>

            <div style={{ display: "grid", gap: 16 }}>
              {stages.map((stage, index) => (
                <div
                  key={stage.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "40px minmax(0, 1fr)",
                    gap: 16,
                    alignItems: "start",
                    padding: "16px 0",
                    borderTop: index === 0 ? "1px solid #E5E7EB" : "1px solid #E5E7EB",
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 999,
                      background: "#F8FAFC",
                      border: "1px solid #E2E8F0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#334155",
                    }}
                  >
                    {index + 1}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>{stage.title}</div>
                      <Badge tone={stepTone(stage.status)}>{stage.status.replaceAll("_", " ")}</Badge>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 14, lineHeight: 1.6, color: "#64748B" }}>{stage.summary}</div>
                    {stage.blockers.length > 0 ? (
                      <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6, color: "#B45309" }}>
                        {stage.blockers.join(" ")}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gap: 16, borderTop: "1px solid #E5E7EB", paddingTop: 20 }}>
              {setupComplete ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#0F172A" }}>
                    Setup complete — you&apos;re ready to go.
                  </div>
                  <Link to="/app" style={{ fontSize: 14, fontWeight: 600, color: "#2563EB", textDecoration: "none" }}>
                    Go to recommendations →
                  </Link>
                </div>
              ) : (
                <setupFetcher.Form method="post">
                  <input type="hidden" name="intent" value="setup" />
                  <ActionButton loading={setupFetcher.state !== "idle"}>Run setup</ActionButton>
                </setupFetcher.Form>
              )}

              {setupFetcher.data ? (
                <Badge tone={setupFetcher.data.ok ? "success" : "critical"}>{setupFetcher.data.message}</Badge>
              ) : null}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
                <MetricCard
                  label="Products synced"
                  value={overview.activeProductCount}
                  hint={`${overview.totalProductCount} total`}
                  tone="subtle"
                />
                <MetricCard
                  label="Sales history"
                  value={overview.hasSalesHistory ? "Available" : "Missing"}
                  hint={`${overview.salesTransactionCount} rows`}
                  tone={overview.hasSalesHistory ? "success" : "warning"}
                />
                <MetricCard
                  label="Forecast status"
                  value={overview.forecastStatus ?? "Pending"}
                  hint={overview.forecastCompletedAt ? <DateTimeText value={overview.forecastCompletedAt} /> : "No completed run yet"}
                  tone={overview.forecastStatus?.toUpperCase().includes("COMPLETED") ? "success" : "accent"}
                />
              </div>
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
