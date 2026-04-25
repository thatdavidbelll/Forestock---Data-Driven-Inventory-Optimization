import { AppProvider } from "@shopify/shopify-app-react-router/react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import {
  embeddedAppRedirectTarget,
  hasShopifyEmbeddedContext,
  logEmbeddedAuthContext,
} from "../../embedded-auth.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  logEmbeddedAuthContext(request, "auth-login-loader");
  const url = new URL(request.url);
  if (hasShopifyEmbeddedContext(url)) {
    throw redirect(embeddedAppRedirectTarget(url));
  }
  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  logEmbeddedAuthContext(request, "auth-login-action");
  const url = new URL(request.url);
  if (hasShopifyEmbeddedContext(url)) {
    throw redirect(embeddedAppRedirectTarget(url));
  }

  return null;
};

export default function Auth() {
  return (
    <AppProvider embedded={false}>
      <div
        style={{
          minHeight: "100vh",
          background: "var(--fs-base)",
          padding: "var(--space-4xl) var(--space-lg)",
        }}
      >
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div
            style={{
              background: "var(--fs-surface)",
              border: "1px solid var(--fs-border)",
              borderRadius: "var(--space-md)",
              boxShadow: "var(--fs-shadow-md)",
              padding: "var(--space-2xl)",
              display: "grid",
              gap: "var(--space-lg)",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                width: "fit-content",
                padding: "var(--space-xs) var(--space-md)",
                borderRadius: 999,
                background: "color-mix(in oklab, var(--fs-primary) 5%, var(--fs-surface))",
                color: "var(--fs-primary)",
                fontSize: "var(--text-xs)",
                fontWeight: "var(--weight-bold)",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              Forestock recovery
            </div>
            <div style={{ display: "grid", gap: "var(--space-sm)" }}>
              <h1 style={{ margin: 0, fontFamily: "var(--font-heading)", fontSize: "var(--text-2xl)", lineHeight: "var(--leading-tight)", letterSpacing: "-0.02em", fontWeight: "var(--weight-bold)", color: "var(--fs-text)" }}>
                Open Forestock from Shopify Admin
              </h1>
              <p style={{ margin: 0, color: "var(--fs-text-muted)", lineHeight: "var(--leading-body)", maxWidth: "58ch" }}>
                This route is only a recovery surface. The normal path is Shopify Admin, where Forestock should already know the store context.
              </p>
            </div>
            <div
              style={{
                border: "1px solid var(--fs-border)",
                borderRadius: "var(--space-md)",
                padding: "var(--space-lg)",
                background: "var(--fs-surface-muted)",
                display: "grid",
                gap: "var(--space-sm)",
              }}
            >
              <div style={{ fontFamily: "var(--font-heading)", fontSize: "var(--text-lg)", fontWeight: "var(--weight-bold)", color: "var(--fs-text)" }}>Expected merchant path</div>
              <div style={{ color: "var(--fs-text)", lineHeight: "var(--leading-body)" }}>
                Shopify Admin {"->"} Apps and sales channels {"->"} Forestock {"->"} Open app
              </div>
              <div style={{ color: "var(--fs-text-muted)", lineHeight: "var(--leading-body)" }}>
                If you reached this page from Shopify Admin, the app likely lost embedded auth context or has a runtime configuration mismatch. That should be fixed inside the app rather than worked around with manual store entry.
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppProvider>
  );
}
