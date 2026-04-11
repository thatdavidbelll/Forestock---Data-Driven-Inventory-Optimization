import type { HeadersFunction } from "react-router";
import { useRouteError, useRouteLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppShell, Badge, Card, ErrorState, Section } from "../components";
import type { loader as appLoader } from "./app";

function managedPricingHref() {
  // eslint-disable-next-line no-undef
  const handle = process.env.SHOPIFY_MANAGED_PRICING_HANDLE || "forestock-inventory-forecast";
  return `shopify://admin/charges/${handle}/pricing_plans`;
}

export default function BillingPage() {
  const data = useRouteLoaderData<typeof appLoader>("routes/app");
  const billing = data?.billing;

  if (!billing) {
    return <ErrorState error={new Error("Billing status is unavailable.")} />;
  }

  return (
    <AppShell
      title="Choose a plan"
      subtitle="Forestock needs an active Shopify app subscription before inventory forecasting and recommendations can run."
      actions={<Badge tone="warning">Subscription required</Badge>}
    >
      <Section title="Activate Forestock" description="Use Shopify's hosted pricing page to start, upgrade, or change your plan.">
        <Card>
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ color: "#475569", lineHeight: 1.65, fontSize: 15 }}>
              {billing.activeSubscriptions.length > 0
                ? "A plan exists for this store, but it is not currently active. Open Shopify pricing to review or update it."
                : "No active plan is attached to this store yet. Open Shopify pricing to activate Forestock and continue."}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <a
                href={managedPricingHref()}
                target="_top"
                rel="noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "12px 16px",
                  borderRadius: 12,
                  background: "var(--fs-indigo)",
                  color: "#ffffff",
                  textDecoration: "none",
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                Open pricing
              </a>
            </div>
            {billing.activeSubscriptions.length > 0 ? (
              <div style={{ paddingTop: 16, borderTop: "1px solid #E5E7EB", color: "#64748b", fontSize: 14, lineHeight: 1.65 }}>
                Current Shopify subscription records:
                <div style={{ marginTop: 8 }}>
                  {billing.activeSubscriptions.map((subscription) => (
                    <div key={subscription.id}>
                      {subscription.name} · {subscription.status}
                    </div>
                  ))}
                </div>
              </div>
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
