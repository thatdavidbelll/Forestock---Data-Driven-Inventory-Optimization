import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, redirect, useLoaderData, useLocation, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { ErrorState, NavTabs } from "../components";
import { buildManagedPricingUrl, buildPlanSyncErrorMessage, loadBillingContext } from "../billing.server";
import { loadForestockAppHomeWithRecovery } from "../forestock-bootstrap.server";
import { resolvePlanChoiceRedirect } from "../plan-choice.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);

  // eslint-disable-next-line no-undef
  const apiKey = process.env.SHOPIFY_API_KEY;
  const managedPricingUrl = buildManagedPricingUrl();
  if (!apiKey) {
    throw new Response("SHOPIFY_API_KEY is not configured for the embedded app.", {
      status: 500,
      statusText: "Configuration Error",
    });
  }

  const overview = await loadForestockAppHomeWithRecovery(admin, session.shop);
  const billingContext = await loadBillingContext(admin, session.shop);
  const planSyncMessage = billingContext.planSync.ok
    ? null
    : buildPlanSyncErrorMessage(billingContext.billingPlanTier, billingContext.planSync.message);
  const redirectTarget = resolvePlanChoiceRedirect({
    pathname: url.pathname,
    search: url.search,
    planChoiceConfirmed: overview.planChoiceConfirmed,
  });

  if (redirectTarget) {
    throw redirect(redirectTarget);
  }

  const appPlanTier = billingContext.planSync.ok
    ? billingContext.appPlanTier
    : overview.planTier ?? billingContext.appPlanTier;

  return {
    apiKey,
    managedPricingUrl,
    planSyncMessage,
    appPlanTier,
    planChoiceConfirmed: overview.planChoiceConfirmed,
    billing: billingContext.billing,
    billingPlanTier: billingContext.billingPlanTier,
    planSync: billingContext.planSync,
  };
};

export default function App() {
  const { apiKey, planChoiceConfirmed } = useLoaderData<typeof loader>();
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
        {planChoiceConfirmed ? (
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
        ) : null}
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
