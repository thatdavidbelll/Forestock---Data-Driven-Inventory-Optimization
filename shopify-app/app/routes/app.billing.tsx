import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useRouteError, useRouteLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AnchorButton, AppShell, Badge, Card, ErrorState, InsetPanel, KeyValueList, Section } from "../components";
import { authenticate } from "../shopify.server";
import type { loader as appLoader } from "./app";

function managedPricingHref(handle: string) {
  return `shopify://admin/charges/${handle}/pricing_plans`;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const managedPricingHandle = process.env.SHOPIFY_MANAGED_PRICING_HANDLE?.trim() || null;

  return {
    managedPricingHandle,
    managedPricingHref: managedPricingHandle ? managedPricingHref(managedPricingHandle) : null,
  };
};

export default function BillingPage() {
  const { managedPricingHandle, managedPricingHref } = useLoaderData<typeof loader>();
  const data = useRouteLoaderData<typeof appLoader>("routes/app");
  const billing = data?.billing;

  if (!billing) {
    return <ErrorState error={new Error("Billing status is unavailable.")} />;
  }

  return (
    <AppShell
      title="Activate billing"
      subtitle="Billing is the entry gate for the embedded app. Once the plan is active, merchants should move directly into forecast setup and restock review."
      actions={<Badge tone="warning">Subscription required</Badge>}
    >
      <Section title="Before Forestock can run" description="This should feel like one clear next step, not a detour.">
        <Card>
          <div
            style={{
              display: "grid",
              gap: "var(--space-xl)",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))",
              alignItems: "start",
            }}
          >
            <div style={{ display: "grid", gap: "var(--space-md)" }}>
              <div
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "var(--text-2xl)",
                  lineHeight: "var(--leading-tight)",
                  letterSpacing: "-0.02em",
                  fontWeight: "var(--weight-bold)",
                  color: "var(--fs-text)",
                  maxWidth: "18ch",
                }}
              >
                Start the subscription to unlock forecasting, recommendations, and purchase-order export.
              </div>
              <div style={{ maxWidth: "60ch", fontSize: "var(--text-body)", lineHeight: "var(--leading-body)", color: "var(--fs-text-muted)" }}>
                Once the plan is active, Forestock can sync the store, generate restock recommendations, and export purchase orders inside Shopify Admin.
              </div>
              {managedPricingHref ? (
                <div>
                  <AnchorButton href={managedPricingHref} target="_top" rel="noreferrer">
                    Open pricing in Shopify
                  </AnchorButton>
                </div>
              ) : (
                <InsetPanel tone="warning">
                  <div style={{ display: "grid", gap: "var(--space-xs)" }}>
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
                      Billing handle missing
                    </div>
                    <div style={{ fontSize: "var(--text-sm)", lineHeight: "var(--leading-body)", color: "var(--fs-text-muted)" }}>
                      Set <code>SHOPIFY_MANAGED_PRICING_HANDLE</code> in <code>shopify-app/.env</code> to the URL handle of the active Shopify app before opening pricing.
                    </div>
                    <div style={{ fontSize: "var(--text-xs)", lineHeight: "var(--leading-body)", color: "var(--fs-text-muted)" }}>
                      Current handle: {managedPricingHandle ?? "not configured"}
                    </div>
                  </div>
                </InsetPanel>
              )}
            </div>

            <InsetPanel>
              <KeyValueList
                items={[
                  { label: "Forecast guidance", value: "See what to restock and how much" },
                  { label: "Recommendations", value: "Work urgent products before lower-priority ones" },
                  { label: "Purchase orders", value: "Export selected products to PDF" },
                ]}
              />
            </InsetPanel>
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
