import type { HeadersFunction } from "react-router";
import { useRouteError, useRouteLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppShell, Badge, Card, ErrorState, Section } from "../components";
import type { loader as appLoader } from "./app";

export default function BillingPage() {
  const data = useRouteLoaderData<typeof appLoader>("routes/app");
  const billing = data?.billing;
  const managedPricingUrl = data?.managedPricingUrl;
  const currentPlan = data?.planTier ?? (billing?.hasActiveSubscription ? "PAID" : "FREE");
  const planBadgeTone = currentPlan === "PAID" ? "success" : "accent";

  if (!billing || !managedPricingUrl) {
    return <ErrorState error={new Error("Billing status is unavailable.")} />;
  }

  return (
    <AppShell
      title="Plans"
      subtitle="Free stores can stay in the app with up to 15 active tracked products. Paid stores unlock unlimited active products."
      actions={<Badge tone={planBadgeTone}>{currentPlan} plan</Badge>}
    >
      <Section title="Choose the right plan">
        <Card>
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ display: "grid", gap: 16 }}>
              <div
                style={{
                  padding: 16,
                  border: "1px solid #E5E7EB",
                  borderRadius: 16,
                  background: currentPlan === "FREE" ? "#F8FAFC" : "#FFFFFF",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>Free</div>
                  {currentPlan === "FREE" ? <Badge tone="accent">Current plan</Badge> : null}
                </div>
                <div style={{ marginTop: 6, color: "#64748B", lineHeight: 1.6 }}>
                  Access the app, sync products, and track up to 15 active products.
                </div>
              </div>
              <div
                style={{
                  padding: 16,
                  border: "1px solid #C7D2FE",
                  borderRadius: 16,
                  background: "#EEF2FF",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>Paid</div>
                  {currentPlan === "PAID" ? <Badge tone="success">Current plan</Badge> : null}
                </div>
                <div style={{ marginTop: 6, color: "#4338CA", lineHeight: 1.6 }}>
                  $14.99 / month. Unlimited active products and no free-tier activation cap.
                </div>
              </div>
            </div>
            <div style={{ borderTop: "1px solid #E5E7EB", paddingTop: 20 }}>
              <a
                href={managedPricingUrl}
                target="_top"
                rel="noreferrer"
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  padding: "12px 24px", borderRadius: 12, background: "var(--fs-indigo)",
                  color: "#ffffff", textDecoration: "none", fontSize: 15, fontWeight: 700,
                }}
              >
                Manage Shopify billing
              </a>
              <div style={{ marginTop: 10, fontSize: 13, color: "#9CA3AF" }}>
                Upgrade, downgrade, or review subscription details in Shopify Admin.
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
