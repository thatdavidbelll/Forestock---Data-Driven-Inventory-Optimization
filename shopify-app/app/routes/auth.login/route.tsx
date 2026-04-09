import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";

import { login } from "../../shopify.server";
import { loginErrorMessage } from "./error.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const errors = loginErrorMessage(await login(request));

  return { errors };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const errors = loginErrorMessage(await login(request));

  return {
    errors,
  };
};

export default function Auth() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [shop, setShop] = useState("");
  const { errors } = actionData || loaderData;

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
              <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.05, color: "#111827" }}>Open your Shopify workspace</h1>
              <p style={{ margin: "10px 0 0", color: "#6d7175", lineHeight: 1.6 }}>
                Use the shop domain for a store where Forestock is installed. The app will continue the standard Shopify embedded auth flow from there.
              </p>
            </div>

            <Form method="post">
              <s-section heading="Shop domain">
                <s-text-field
                  name="shop"
                  label="Shop domain"
                  details="example.myshopify.com"
                  value={shop}
                  onChange={(e) => setShop(e.currentTarget.value)}
                  autocomplete="on"
                  error={errors.shop}
                ></s-text-field>
                <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-start" }}>
                  <s-button type="submit">Continue to Shopify</s-button>
                </div>
              </s-section>
            </Form>
          </div>
        </div>
      </div>
    </AppProvider>
  );
}
