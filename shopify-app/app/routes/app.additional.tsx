import { AppShell, Card, Grid, InfoBanner, Section } from "../components";

export default function AdditionalPage() {
  return (
    <AppShell
      title="Support"
      subtitle="Keep merchant expectations clear. This page should reduce confusion during setup, sync validation, and early support interactions."
    >
      <InfoBanner
        title="Current operating model"
        body="Forestock’s Shopify experience is being hardened around setup, sync visibility, and recommendation review. Forecasting remains centralized in the backend so Shopify and web surfaces stay consistent."
        tone="subtle"
      />

      <Section
        title="Merchant journey"
        description="The embedded app should feel like an operational workflow, not a detached technical console."
      >
        <Grid columns={3}>
          <Card tone="accent">
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>1. Install and link</div>
            <div style={{ color: "#52606d", lineHeight: 1.7 }}>
              The merchant installs the app and Forestock links the shop to a workspace without changing the forecast engine.
            </div>
          </Card>
          <Card tone="warning">
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>2. Import and validate</div>
            <div style={{ color: "#52606d", lineHeight: 1.7 }}>
              Products, inventory, and order history are imported so the same backend forecast pipeline has usable demand and stock data.
            </div>
          </Card>
          <Card tone="success">
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>3. Review decisions</div>
            <div style={{ color: "#52606d", lineHeight: 1.7 }}>
              Recommendations appear only after sync and forecast evidence are strong enough to support merchant action.
            </div>
          </Card>
        </Grid>
      </Section>

      <Section
        title="What support should verify"
        description="These are the first things to check when a merchant says the app is not trustworthy yet."
      >
        <Card>
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
            <li>The store is linked and the Shopify connection is active.</li>
            <li>Catalog import completed and products are mapped into Forestock.</li>
            <li>Historical orders were imported and line items matched.</li>
            <li>A forecast run exists and completed successfully.</li>
            <li>The recommendations page shows a plausible queue for the current catalog state.</li>
          </ul>
        </Card>
      </Section>
    </AppShell>
  );
}
