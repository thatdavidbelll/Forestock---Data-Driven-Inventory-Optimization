import { AppShell, Card, Grid, Section } from "../components";

export default function AdditionalPage() {
  return (
    <AppShell
      title="How Forestock works in Shopify"
      subtitle="This page explains the intended merchant journey so the product feels deliberate rather than mysterious."
    >
      <Section title="Shopify-first merchant workflow" description="The embedded app should be the primary merchant surface, not a detour into a separate product too early.">
        <Grid columns={3}>
          <Card tone="accent">
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>1. Install</div>
            <div style={{ color: "#52606d", lineHeight: 1.7 }}>
              Installing the app should link your Shopify shop to a Forestock workspace without making the merchant feel like they are leaving Shopify.
            </div>
          </Card>
          <Card tone="success">
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>2. Import</div>
            <div style={{ color: "#52606d", lineHeight: 1.7 }}>
              Forestock brings in products, inventory, and recent order history so demand forecasting has something real to work with.
            </div>
          </Card>
          <Card tone="warning">
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>3. Decide</div>
            <div style={{ color: "#52606d", lineHeight: 1.7 }}>
              Once data quality is good enough, Forestock should highlight what needs reordering and why.
            </div>
          </Card>
        </Grid>
      </Section>

      <Section title="What merchants should expect" description="Set expectations clearly so support burden drops.">
        <Card>
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
            <li>Shopify is the primary entry point for install, setup, and sync visibility.</li>
            <li>Forestock prepares a linked workspace behind the scenes for forecasting and replenishment logic.</li>
            <li>If setup or sync needs intervention during the pilot, support may still assist manually.</li>
          </ul>
        </Card>
      </Section>

      <Section title="Current pilot note" description="Be honest about maturity instead of overselling it.">
        <Card tone="subtle">
          <div style={{ color: "#52606d", lineHeight: 1.7 }}>
            The Shopify experience is being hardened for launch readiness. During the current pilot phase, some merchants may still need operator help for setup, sync validation, or interpreting initial forecasting output.
          </div>
        </Card>
      </Section>
    </AppShell>
  );
}
