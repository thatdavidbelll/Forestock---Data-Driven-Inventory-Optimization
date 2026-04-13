import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, topic, shop } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  const p = payload as Record<string, unknown>;
  const status = p.status as string | undefined;

  console.log(`[Forestock] Subscription update for ${shop}: status=${status ?? "unknown"}`);

  return new Response();
};
