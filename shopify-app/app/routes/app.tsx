import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, redirect, useLoaderData, useLocation, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { ErrorState, NavTabs } from "../components";
import { getBillingStatus } from "../billing.server";
import { authenticate } from "../shopify.server";

const TEST_APP_API_KEY = "dadbec5afb4fbddb896fe55a7ea3ff9b";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  // eslint-disable-next-line no-undef
  const apiKey = process.env.SHOPIFY_API_KEY;
  if (!apiKey) {
    throw new Response("SHOPIFY_API_KEY is not configured for the embedded app.", {
      status: 500,
      statusText: "Configuration Error",
    });
  }

  const billingBypassEnabled = process.env.SHOPIFY_BILLING_REQUIRED === "false" || apiKey === TEST_APP_API_KEY;
  const billing = billingBypassEnabled
    ? {
        activeSubscriptions: [],
        hasActiveSubscription: true,
      }
    : await getBillingStatus(admin);
  const url = new URL(request.url);
  const onBillingRoute = url.pathname === "/app/billing";

  if (!billing.hasActiveSubscription && !onBillingRoute) {
    throw redirect(`/app/billing${url.search}`);
  }

  if (billing.hasActiveSubscription && onBillingRoute) {
    throw redirect(`/app${url.search}`);
  }

  return { apiKey, billing, billingBypassEnabled };
};

export default function App() {
  const { apiKey, billing } = useLoaderData<typeof loader>();
  const location = useLocation();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <div
        style={{
          minHeight: "100vh",
          background: "var(--fs-base)",
          color: "var(--fs-text)",
        }}
      >
        <NavTabs
          currentPath={location.pathname}
          search={location.search}
          items={billing.hasActiveSubscription
            ? [
                { label: "Dashboard", href: "/app" },
                { label: "Recommendations", href: "/app/recommendations" },
                { label: "Settings", href: "/app/settings" },
              ]
            : [
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
