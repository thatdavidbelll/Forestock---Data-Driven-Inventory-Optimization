import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { generateForestockPurchaseOrder } from "../forestock.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const idsParam = url.searchParams.get("ids") ?? "";
  const suggestionIds = idsParam.split(",").filter(Boolean);

  if (suggestionIds.length === 0) {
    return new Response("No suggestion IDs provided", { status: 400 });
  }

  try {
    const pdfBuffer = await generateForestockPurchaseOrder({
      shopDomain: session.shop,
      suggestionIds,
    });

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=\"forestock-purchase-order.pdf\"",
      },
    });
  } catch (error) {
    return new Response(
      error instanceof Error ? error.message : "Failed to generate purchase order",
      { status: 500 },
    );
  }
};
