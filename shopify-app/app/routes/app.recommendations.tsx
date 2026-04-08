import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getForestockRecommendations } from "../forestock.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return getForestockRecommendations(session.shop);
};

export default function RecommendationsPage() {
  const data = useLoaderData<typeof loader>();

  return (
    <s-page heading="Recommendations">
      <s-section heading="Forecast context">
        <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
          <s-stack direction="block" gap="base">
            <p>Forecast status: {data.forecastStatus ?? "Not run yet"}</p>
            <p>
              Forecast completed: {data.forecastCompletedAt ? new Date(data.forecastCompletedAt).toLocaleString() : "Not available"}
            </p>
            <p>Open recommendations: {data.recommendations.length}</p>
          </s-stack>
        </s-box>
      </s-section>

      <s-section heading="Priority reorder list">
        {data.recommendations.length > 0 ? (
          <s-stack direction="block" gap="base">
            {data.recommendations.map((recommendation) => (
              <s-box key={recommendation.id} padding="base" borderWidth="base" borderRadius="base">
                <s-stack direction="block" gap="base">
                  <p>{recommendation.productName}</p>
                  <p>SKU: {recommendation.productSku}</p>
                  <p>Urgency: {recommendation.urgency}</p>
                  <p>Days of stock: {recommendation.daysOfStock ?? "Unknown"}</p>
                  <p>Suggested reorder quantity: {recommendation.suggestedQty ?? "Unknown"}</p>
                  <p>
                    Estimated order value: {recommendation.estimatedOrderValue != null ? recommendation.estimatedOrderValue : "Unknown"}
                  </p>
                  <p>Supplier: {recommendation.supplierName ?? "Not set"}</p>
                </s-stack>
              </s-box>
            ))}
          </s-stack>
        ) : (
          <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
            <s-paragraph>No active recommendations are ready yet. Complete setup, sync sales history, and run a forecast.</s-paragraph>
          </s-box>
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
