import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { notifyCustomerDataRequest } from "../forestock.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, topic, shop } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  const customer = (payload as Record<string, unknown>).customer as
    | Record<string, unknown>
    | undefined;

  await notifyCustomerDataRequest({
    shopDomain: shop,
    customerId: Number((payload as Record<string, unknown>).customer_id ?? 0),
    customerEmail: (customer?.email as string | null) ?? null,
    ordersRequestedCount:
      (payload as Record<string, unknown>).orders_requested != null
        ? Number((payload as Record<string, unknown>).orders_requested)
        : null,
  });

  return new Response();
};
