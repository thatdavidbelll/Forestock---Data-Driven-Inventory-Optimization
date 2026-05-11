import type { ActionFunctionArgs, HeadersFunction } from "react-router";
import { Form, redirect, useActionData, useNavigation, useRouteError, useRouteLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { ActionButton, AppShell, Badge, Card, ErrorState, Grid, Section } from "../components";
import { confirmForestockFreePlanChoice } from "../forestock.server";
import { authenticate } from "../shopify.server";
import type { loader as appLoader } from "./app";

type ActionData = {
  ok: false;
  message: string;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);

  try {
    await confirmForestockFreePlanChoice(session.shop);
    throw redirect(`/app/onboarding${url.search}`);
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    return {
      ok: false,
      message: error instanceof Error ? error.message : "Failed to confirm the free plan choice.",
    } satisfies ActionData;
  }
};

export default function PlanChoicePage() {
  const data = useRouteLoaderData<typeof appLoader>("routes/app");
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const submitting = navigation.state !== "idle";
  const currentPlan = data?.appPlanTier ?? "FREE";
  const planBadgeTone = currentPlan === "PAID" ? "success" : "accent";

  if (!data) {
    return <ErrorState error={new Error("Plan choice data is unavailable.")} />;
  }

  return (
    <AppShell
      title="Choose your starting plan"
      subtitle="Pick the free tier to begin setup immediately, or choose the paid tier in Shopify if you want unlimited active products from the start."
      actions={<Badge tone={planBadgeTone}>{currentPlan} plan</Badge>}
    >
      <Section title="Start here" description="Forestock needs one explicit plan choice before setup continues for this store.">
        <div style={{ display: "grid", gap: 18 }}>
          {data.planSyncMessage ? <Badge tone="warning">{data.planSyncMessage}</Badge> : null}
          {actionData ? <Badge tone="critical">{actionData.message}</Badge> : null}

          <Grid columns={2}>
            <Card tone="subtle" style={{ height: "100%" }}>
              <div style={{ display: "grid", gap: 14, height: "100%" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>Free</div>
                  <Badge tone="accent">Start now</Badge>
                </div>
                <div style={{ color: "#475569", lineHeight: 1.7, fontSize: 14 }}>
                  Track up to 15 active products, run setup immediately, and upgrade later from the billing screen if the store outgrows the free cap.
                </div>
                <div style={{ color: "#64748B", fontSize: 13, lineHeight: 1.7 }}>
                  Choosing Free confirms that this store should continue onboarding on the free tier.
                </div>
                <Form method="post" style={{ marginTop: "auto" }}>
                  <ActionButton loading={submitting}>Continue with Free</ActionButton>
                </Form>
              </div>
            </Card>

            <Card tone="accent" style={{ height: "100%" }}>
              <div style={{ display: "grid", gap: 14, height: "100%" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>Paid</div>
                  <Badge tone="success">$14.99 / month</Badge>
                </div>
                <div style={{ color: "#4338CA", lineHeight: 1.7, fontSize: 14 }}>
                  Unlock unlimited active products from the beginning. The paid choice is only confirmed after Shopify billing completes and Forestock syncs that result successfully.
                </div>
                <div style={{ color: "#5B21B6", fontSize: 13, lineHeight: 1.7 }}>
                  If Shopify billing is already active but Forestock still shows a warning here, reopen the app or retry after a moment so the paid state can sync.
                </div>
                <div style={{ marginTop: "auto" }}>
                  <a
                    href={data.managedPricingUrl}
                    target="_top"
                    rel="noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "12px 24px",
                      borderRadius: 12,
                      background: "var(--fs-indigo)",
                      color: "#ffffff",
                      textDecoration: "none",
                      fontSize: 15,
                      fontWeight: 700,
                    }}
                  >
                    Choose Paid in Shopify
                  </a>
                </div>
              </div>
            </Card>
          </Grid>
        </div>
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
