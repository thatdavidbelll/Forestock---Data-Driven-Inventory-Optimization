import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import {
  notifyCustomerDataRequest,
  redactCustomerData,
  redactShopData,
} from "../forestock.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, topic, shop } = await authenticate.webhook(request);

  if (topic === "CUSTOMERS_DATA_REQUEST") {
    const p = payload as Record<string, unknown>;
    const customer = p.customer as Record<string, unknown> | undefined;
    const ordersRequested = Array.isArray(p.orders_requested)
      ? p.orders_requested
      : null;

    await notifyCustomerDataRequest({
      shopDomain: shop,
      customerId: Number(customer?.id ?? 0),
      customerEmail: (customer?.email as string | null) ?? null,
      ordersRequestedCount: ordersRequested?.length ?? null,
    });
    return new Response();
  }

  if (topic === "CUSTOMERS_REDACT") {
    const p = payload as Record<string, unknown>;
    const customer = p.customer as Record<string, unknown> | undefined;
    const ordersToRedact = Array.isArray(p.orders_to_redact)
      ? (p.orders_to_redact as unknown[]).map((id) => Number(id ?? 0))
      : [];

    await redactCustomerData({
      shopDomain: shop,
      customerId: Number(customer?.id ?? 0),
      customerEmail: (customer?.email as string | null) ?? null,
      ordersToRedact,
    });
    return new Response();
  }

  if (topic === "SHOP_REDACT") {
    await redactShopData({ shopDomain: shop });
    return new Response();
  }

  return new Response("Unhandled compliance topic", { status: 400 });
};
