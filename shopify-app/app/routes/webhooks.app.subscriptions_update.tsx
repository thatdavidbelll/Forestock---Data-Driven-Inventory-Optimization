import type { ActionFunctionArgs } from "react-router";
import { resolveWebhookPlanTier } from "../billing.server";
import { syncForestockPlan } from "../forestock.server";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, topic, shop } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  const p = payload as Record<string, unknown>;
  const status = p.status as string | undefined;
  const planTier = resolveWebhookPlanTier(status);

  console.log(`[Forestock] Subscription update for ${shop}: status=${status ?? "unknown"}`);

  await syncForestockPlan(shop, planTier);

  return new Response();
};
