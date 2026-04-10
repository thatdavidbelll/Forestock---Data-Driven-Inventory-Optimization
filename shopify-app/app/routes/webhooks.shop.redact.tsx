import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { redactShopData } from "../forestock.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  await redactShopData({ shopDomain: shop });

  return new Response();
};
