import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useActionData, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  AppShell,
  Badge,
  Card,
  InfoBanner,
  MetricCard,
  Section,
} from "../components";
import {
  getForestockStoreConfig,
  updateForestockStoreConfig,
} from "../forestock.server";
import { authenticate } from "../shopify.server";

type ActionData =
  | { ok: true; message: string }
  | { ok: false; message: string };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const config = await getForestockStoreConfig(session.shop);
  return { shopDomain: session.shop, config };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const forecastHorizonDays = Number(formData.get("forecastHorizonDays"));

  try {
    await updateForestockStoreConfig(session.shop, { forecastHorizonDays });
    return { ok: true, message: "Forecast horizon updated." } satisfies ActionData;
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Failed to update forecast horizon.",
    } satisfies ActionData;
  }
};

export default function SettingsPage() {
  const { config } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();

  return (
    <AppShell
      title="Settings"
      subtitle="Keep settings minimal in Shopify. Forecast horizon is the one store control merchants should be able to adjust here."
      actions={<Badge tone="subtle">Store config</Badge>}
    >
      <InfoBanner
        title="Minimal settings surface"
        body="This page only exposes the forecast horizon. More advanced configuration can stay out of Shopify until there is a strong merchant need for it."
        tone="subtle"
      />

      <Section
        title="Forecast horizon"
        description="This changes how many days the shared backend forecast projects forward for this store."
      >
        <Card>
          <form method="post" style={{ display: "grid", gap: 18 }}>
            <MetricCard
              label="Current horizon"
              value={`${config.forecastHorizonDays} days`}
              hint={config.updatedAt ? `Updated ${new Date(config.updatedAt).toLocaleString()}` : "Using current store configuration"}
              tone="accent"
            />
            <div>
              <label htmlFor="forecastHorizonDays" style={{ display: "block", marginBottom: 8, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
                Horizon days
              </label>
              <input
                id="forecastHorizonDays"
                name="forecastHorizonDays"
                type="range"
                min="7"
                max="365"
                defaultValue={config.forecastHorizonDays}
                style={{ width: "100%" }}
              />
              <div style={{ marginTop: 8, fontSize: 14, color: "#64748b" }}>
                Choose a value between 7 and 365 days.
              </div>
            </div>
            <div>
              <s-button type="submit">Save horizon</s-button>
            </div>
          </form>
          {actionData ? (
            <div style={{ marginTop: 16 }}>
              <Badge tone={actionData.ok ? "success" : "critical"}>{actionData.message}</Badge>
            </div>
          ) : null}
        </Card>
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
