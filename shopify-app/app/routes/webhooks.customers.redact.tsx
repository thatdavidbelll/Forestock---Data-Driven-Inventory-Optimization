import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { redactCustomerData } from "../forestock.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, topic, shop } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  const p = payload as Record<string, unknown>;
  const customer = p.customer as Record<string, unknown> | undefined;
  const ordersToRedact = Array.isArray(p.orders_to_redact)
    ? (p.orders_to_redact as { id?: unknown }[]).map((o) => Number(o.id ?? 0))
    : [];

  await redactCustomerData({
    shopDomain: shop,
    customerId: Number(p.customer_id ?? 0),
    customerEmail: (customer?.email as string | null) ?? null,
    ordersToRedact,
  });

  return new Response();
};
