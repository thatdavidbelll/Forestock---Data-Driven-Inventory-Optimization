import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { redirect, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  AppShell,
  Badge,
  Card,
  EmptyState,
  formatDateTime,
  KeyValueList,
  Section,
} from "../components";
import { authenticate } from "../shopify.server";
import { getForestockAppHome } from "../forestock.server";
import { getSetupStages } from "../setup-state";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const overview = await getForestockAppHome(session.shop);
  const stages = getSetupStages(overview);
  const setupIncomplete = stages.some((stage) =>
    stage.id !== "recommendations" &&
    stage.status !== "completed" &&
    stage.status !== "running",
  );

  if (setupIncomplete) {
    throw redirect(`/app/setup${new URL(request.url).search}`);
  }

  return overview;
};

export default function AppIndex() {
  const data = useLoaderData<typeof loader>();

  return (
    <AppShell
      title={data.storeName || "Forestock"}
      actions={
        data.topRecommendation ? (
          <Badge
            tone={
              data.topRecommendation.urgency === "CRITICAL"
                ? "critical"
                : data.topRecommendation.urgency === "HIGH"
                  ? "warning"
                  : "accent"
            }
          >
            {data.topRecommendation.urgency}
          </Badge>
        ) : undefined
      }
    >
      <Section title="Top recommendation" description="Start with this product.">
        {data.topRecommendation ? (
          <Card tone={data.topRecommendation.urgency === "CRITICAL" ? "critical" : data.topRecommendation.urgency === "HIGH" ? "warning" : "success"}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.05 }}>{data.topRecommendation.productName}</div>
                <div style={{ marginTop: 8, fontSize: 15, color: "rgba(226, 232, 240, 0.94)" }}>{data.topRecommendation.productSku}</div>
              </div>
              <Badge tone={data.topRecommendation.urgency === "CRITICAL" ? "critical" : data.topRecommendation.urgency === "HIGH" ? "warning" : "accent"}>
                {data.topRecommendation.urgency}
              </Badge>
            </div>
            <KeyValueList
              items={[
                { label: "Days of stock", value: data.topRecommendation.daysOfStock ?? "Unknown" },
                { label: "Suggested reorder", value: data.topRecommendation.suggestedQty ?? "Unknown" },
                { label: "Estimated value", value: data.topRecommendation.estimatedOrderValue ?? "Unknown" },
                { label: "Generated", value: formatDateTime(data.topRecommendation.generatedAt) },
              ]}
            />
          </Card>
        ) : (
          <EmptyState
            title="No recommendation yet"
            body="When Forestock is ready, your first product to review will appear here."
          />
        )}
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
