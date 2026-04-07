import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { deleteForestockProduct } from "../forestock.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, topic, shop } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  const shopifyProductGid =
    payload.admin_graphql_api_id || `gid://shopify/Product/${payload.id}`;

  await deleteForestockProduct({
    shopDomain: shop,
    shopifyProductGid,
  });

  return new Response();
};
