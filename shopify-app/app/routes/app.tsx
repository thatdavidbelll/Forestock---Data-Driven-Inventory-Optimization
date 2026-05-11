import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useLocation, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { ErrorState, NavTabs } from "../components";
import { getBillingStatus, resolvePlanTier } from "../billing.server";
import { syncForestockPlan } from "../forestock.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  // eslint-disable-next-line no-undef
  const apiKey = process.env.SHOPIFY_API_KEY;
  const managedPricingHandle = process.env.SHOPIFY_MANAGED_PRICING_HANDLE || "forestock-inventory-forecast";
  const shopHandle = session.shop.split(".")[0];
  const managedPricingUrl = `https://admin.shopify.com/store/${shopHandle}/charges/${managedPricingHandle}/pricing_plans`;
  if (!apiKey) {
    throw new Response("SHOPIFY_API_KEY is not configured for the embedded app.", {
      status: 500,
      statusText: "Configuration Error",
    });
  }

  const billing = await getBillingStatus(admin);
  const planTier = resolvePlanTier(billing);

  try {
    await syncForestockPlan(session.shop, planTier);
  } catch (error) {
    console.error(`[Forestock] Failed to sync plan for ${session.shop}:`, error);
  }

  return { apiKey, billing, planTier, managedPricingHandle, managedPricingUrl };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();
  const location = useLocation();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <div
        style={{
          minHeight: "100vh",
          background:
            "linear-gradient(180deg, rgba(79, 70, 229, 0.03) 0%, rgba(255, 255, 255, 0) 160px), linear-gradient(180deg, #f4f5f7 0%, #f7f7f8 100%)",
        }}
      >
        <NavTabs
          currentPath={location.pathname}
          search={location.search}
          items={[
            { label: "Home", href: "/app" },
            { label: "Recommendations", href: "/app/recommendations" },
            { label: "Settings", href: "/app/settings" },
            { label: "Billing", href: "/app/billing" },
          ]}
        />
        <Outlet />
      </div>
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return <ErrorState error={useRouteError()} />;
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
