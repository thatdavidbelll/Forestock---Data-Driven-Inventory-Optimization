import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useActionData, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  AppShell,
  Badge,
  Card,
  ErrorState,
  FieldLabel,
  InputFrame,
  MetricCard,
  RangeInput,
  Section,
  ValuePill,
} from "../components";
import {
  getForestockStoreConfig,
  updateForestockStoreConfig,
} from "../forestock.server";
import { authenticate } from "../shopify.server";

type ActionData =
  | { ok: true; message: string; config: Awaited<ReturnType<typeof getForestockStoreConfig>> }
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

  if (!Number.isFinite(forecastHorizonDays)) {
    return { ok: false, message: "Forecast horizon must be a number." } satisfies ActionData;
  }

  if (forecastHorizonDays < 3 || forecastHorizonDays > 90) {
    return { ok: false, message: "Forecast horizon must be between 3 and 90 days." } satisfies ActionData;
  }

  try {
    const config = await updateForestockStoreConfig(session.shop, { forecastHorizonDays });
    return { ok: true, message: `Forecast horizon updated to ${config.forecastHorizonDays} days.`, config } satisfies ActionData;
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
  const effectiveConfig = actionData?.ok ? actionData.config : config;
  const [forecastHorizonDays, setForecastHorizonDays] = useState(
    Math.min(90, Math.max(3, effectiveConfig.forecastHorizonDays)),
  );

  useEffect(() => {
    setForecastHorizonDays(Math.min(90, Math.max(3, effectiveConfig.forecastHorizonDays)));
  }, [effectiveConfig.forecastHorizonDays]);

  return (
    <AppShell
      title="Settings"
      subtitle="A minimal settings surface designed around the single forecast control merchants actually need."
      actions={<Badge tone="subtle">Store config</Badge>}
    >
      <Section
        title="Forecast horizon"
        description="This changes how many days the shared backend forecast projects forward for this store."
      >
        <Card style={{ maxWidth: 760 }}>
          <form method="post" style={{ display: "grid", gap: 20 }}>
            <MetricCard
              label="Current horizon"
              value={`${forecastHorizonDays} days`}
              hint={effectiveConfig.updatedAt ? `Updated ${new Date(effectiveConfig.updatedAt).toLocaleString()}` : "Using current store configuration"}
              tone="accent"
            />
            <InputFrame>
              <FieldLabel htmlFor="forecastHorizonDays">Horizon days</FieldLabel>
              <RangeInput
                id="forecastHorizonDays"
                name="forecastHorizonDays"
                min="3"
                max="90"
                step="1"
                value={forecastHorizonDays}
                onChange={setForecastHorizonDays}
              />
              <div style={{ marginTop: 14 }}>
                <ValuePill>{forecastHorizonDays} days</ValuePill>
              </div>
              <div style={{ marginTop: 8, fontSize: 14, color: "#64748b" }}>
                Choose a value between 3 and 90 days.
              </div>
            </InputFrame>
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
  return <ErrorState error={useRouteError()} />;
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
