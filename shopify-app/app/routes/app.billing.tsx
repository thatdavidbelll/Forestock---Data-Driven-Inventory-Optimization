import type { HeadersFunction } from "react-router";
import { useRouteError, useRouteLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppShell, Badge, Card, ErrorState, Section } from "../components";
import type { loader as appLoader } from "./app";

export default function BillingPage() {
  const data = useRouteLoaderData<typeof appLoader>("routes/app");
  const billing = data?.billing;
  const managedPricingUrl = data?.managedPricingUrl;

  if (!billing || !managedPricingUrl) {
    return <ErrorState error={new Error("Billing status is unavailable.")} />;
  }

  return (
    <AppShell
      title="Choose a plan"
      subtitle="Forestock needs an active Shopify app subscription before inventory forecasting and recommendations can run."
      actions={<Badge tone="warning">Subscription required</Badge>}
    >
      <Section title="What you get with Forestock">
        <Card>
          <div style={{ display: "grid", gap: 20 }}>
            <div style={{ display: "grid", gap: 12 }}>
              {[
                { icon: "📦", title: "AI-powered reorder forecasting", body: "Holt-Winters seasonal forecasting tells you exactly what to reorder and when — before you run out." },
                { icon: "🚨", title: "CRITICAL & HIGH stock alerts", body: "Automatic urgency scoring so you always know which products need attention today." },
                { icon: "📉", title: "Slow mover detection", body: "Identify dead stock tying up cash. Filter by 30, 60, or 90 days of inactivity." },
                { icon: "📊", title: "Sales velocity & forecast accuracy", body: "Track how well forecasts match real sales. Model accuracy shown on every recommendation." },
              ].map((feature) => (
                <div key={feature.title} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 20 }}>{feature.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 14 }}>{feature.title}</div>
                    <div style={{ color: "#6B7280", fontSize: 13, lineHeight: 1.6 }}>{feature.body}</div>
                  </div>
                </div>
              ))}
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
                View plans and start free trial
              </a>
              <div style={{ marginTop: 10, fontSize: 13, color: "#9CA3AF" }}>
                Free trial available · Cancel anytime · No lock-in
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
