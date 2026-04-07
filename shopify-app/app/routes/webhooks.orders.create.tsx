import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { backfillForestockOrders } from "../forestock.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, topic, shop } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  await backfillForestockOrders({
    shopDomain: shop,
    orders: [
      {
        shopifyOrderId: payload.id ? Number(payload.id) : null,
        orderNumber: payload.order_number != null ? String(payload.order_number) : null,
        orderName: payload.name ?? null,
        financialStatus: payload.financial_status ?? null,
        fulfillmentStatus: payload.fulfillment_status ?? null,
        customerEmail: payload.customer?.email ?? null,
        customerFirstName: payload.customer?.first_name ?? null,
        customerLastName: payload.customer?.last_name ?? null,
        totalPrice: payload.total_price ? Number(payload.total_price) : null,
        subtotalPrice: payload.subtotal_price ? Number(payload.subtotal_price) : null,
        currency: payload.currency ?? null,
        createdAt: payload.created_at,
        updatedAt: payload.updated_at ?? null,
        lineItems: (payload.line_items ?? []).map(
          (
            lineItem: {
              id?: number | null;
              variant_id?: number | null;
              sku?: string | null;
              title?: string | null;
              variant_title?: string | null;
              quantity?: number | null;
              price?: string | null;
            },
            index: number,
          ) => ({
            shopifyLineItemId:
              lineItem.id ??
              Number(`${payload.id ?? 0}${String(index + 1).padStart(3, "0")}`),
            shopifyVariantGid: lineItem.variant_id
              ? `gid://shopify/ProductVariant/${lineItem.variant_id}`
              : null,
            sku: lineItem.sku ?? null,
            title: lineItem.title ?? "Shopify line item",
            variantTitle: lineItem.variant_title ?? null,
            quantity: lineItem.quantity ?? 0,
            price: lineItem.price ? Number(lineItem.price) : null,
          }),
        ),
      },
    ],
  });

  return new Response();
};
