import type { ActionFunctionArgs } from "react-router";
import { authenticate, registerWebhooks } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
    const { payload, session, topic, shop } = await authenticate.webhook(request);
    console.log(`Received ${topic} webhook for ${shop}`);

    const current = payload.current as string[];
    if (session) {
        await db.session.update({   
            where: {
                id: session.id
            },
            data: {
                scope: current.toString(),
            },
        });
    }
    try {
        if (session) {
            await registerWebhooks({ session });
        }
    } catch (e) {
        console.error(`[Forestock] Failed to re-register webhooks after scope update for ${shop}:`, e);
    }
    return new Response();
};
