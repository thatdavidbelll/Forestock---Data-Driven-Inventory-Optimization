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
          background:
            "radial-gradient(circle at top left, rgba(0, 91, 211, 0.12), transparent 28rem), linear-gradient(180deg, #f6f6f7 0%, #eef1f4 100%)",
          padding: "48px 20px",
        }}
      >
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <div
            style={{
              background: "rgba(255,255,255,0.94)",
              border: "1px solid #d2d5d9",
              borderRadius: 24,
              boxShadow: "0 8px 24px rgba(18, 28, 45, 0.06)",
              padding: 28,
            }}
          >
            <div style={{ marginBottom: 18 }}>
              <div
                style={{
                  display: "inline-flex",
                  padding: "7px 12px",
                  borderRadius: 999,
                  background: "#edf4ff",
                  color: "#005bd3",
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginBottom: 14,
                }}
              >
                Forestock sign in
              </div>
              <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.05, color: "#111827" }}>Open Forestock from Shopify Admin</h1>
              <p style={{ margin: "10px 0 0", color: "#6d7175", lineHeight: 1.6 }}>
                This route is only a recovery surface. The normal flow is to open the app from Shopify Admin, where Forestock should already know the store context.
              </p>
            </div>
            <div
              style={{
                border: "1px solid #d2d5d9",
                borderRadius: 18,
                padding: 18,
                background: "#f6f6f7",
                display: "grid",
                gap: 10,
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>Expected merchant path</div>
              <div style={{ color: "#4b5563", lineHeight: 1.6 }}>
                Shopify Admin {"->"} Apps and sales channels {"->"} Forestock {"->"} Open app
              </div>
              <div style={{ color: "#6d7175", lineHeight: 1.6 }}>
                If you reached this page from Shopify Admin, the app likely lost embedded auth context or has a runtime configuration mismatch. That should be fixed in the app, not worked around by asking for a store link.
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppProvider>
  );
}
