import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getForestockAppHome } from "../forestock.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const overview = await getForestockAppHome(session.shop);
  return overview;
};

function statusLabel(status: string | null) {
  if (!status) return "Not run yet";
  return status.replaceAll("_", " ");
}

export default function AppIndex() {
  const data = useLoaderData<typeof loader>();

  return (
    <s-page heading="Forestock overview">
      <s-section heading="Store status">
        <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
          <s-stack direction="block" gap="base">
            <p>Store: {data.storeName}</p>
            <p>Shop domain: {data.shopDomain}</p>
            <p>Shopify connection: {data.shopifyConnectionActive ? "active" : "inactive"}</p>
            <p>Latest forecast: {statusLabel(data.forecastStatus)}</p>
            <p>
              Latest completed forecast: {data.forecastCompletedAt ? new Date(data.forecastCompletedAt).toLocaleString() : "Not available"}
            </p>
          </s-stack>
        </s-box>
      </s-section>

      <s-section heading="What Forestock sees right now">
        <s-stack direction="inline" gap="base">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <p>Active products</p>
            <p>{data.activeProductCount}</p>
          </s-box>
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <p>Critical recommendations</p>
            <p>{data.criticalSuggestions}</p>
          </s-box>
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <p>High recommendations</p>
            <p>{data.highSuggestions}</p>
          </s-box>
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <p>Sales history</p>
            <p>{data.hasSalesHistory ? "Available" : "Missing"}</p>
          </s-box>
        </s-stack>
      </s-section>

      <s-section heading="Top recommendation">
        <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
          {data.topRecommendation ? (
            <s-stack direction="block" gap="base">
              <p>{data.topRecommendation.productName}</p>
              <p>SKU: {data.topRecommendation.productSku}</p>
              <p>Urgency: {data.topRecommendation.urgency}</p>
              <p>Days of stock: {data.topRecommendation.daysOfStock ?? "Unknown"}</p>
              <p>Suggested reorder quantity: {data.topRecommendation.suggestedQty ?? "Unknown"}</p>
              <p>
                Estimated order value: {data.topRecommendation.estimatedOrderValue != null ? data.topRecommendation.estimatedOrderValue : "Unknown"}
              </p>
            </s-stack>
          ) : (
            <s-paragraph>No active reorder recommendations yet.</s-paragraph>
          )}
        </s-box>
      </s-section>

      <s-section heading="Next actions">
        <s-unordered-list>
          {data.nextActions.map((action) => (
            <s-list-item key={action}>{action}</s-list-item>
          ))}
        </s-unordered-list>
      </s-section>

      <s-section heading="Data quality warnings">
        {data.dataQualityWarnings.length > 0 ? (
          <s-unordered-list>
            {data.dataQualityWarnings.map((warning) => (
              <s-list-item key={warning}>{warning}</s-list-item>
            ))}
          </s-unordered-list>
        ) : (
          <s-paragraph>No major data quality warnings detected.</s-paragraph>
        )}
      </s-section>
    </s-page>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
