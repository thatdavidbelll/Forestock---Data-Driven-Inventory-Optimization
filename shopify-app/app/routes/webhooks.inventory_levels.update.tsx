import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { syncForestockInventory } from "../forestock.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, topic, shop } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  const inventoryItemGid =
    payload.inventory_item_admin_graphql_api_id ||
    `gid://shopify/InventoryItem/${payload.inventory_item_id}`;

  await syncForestockInventory({
    shopDomain: shop,
    shopifyInventoryItemGid: inventoryItemGid,
    quantity: Number(payload.available ?? 0),
  });

  return new Response();
};
