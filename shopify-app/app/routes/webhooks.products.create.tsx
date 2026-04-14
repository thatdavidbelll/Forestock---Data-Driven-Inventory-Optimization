import type { ActionFunctionArgs } from "react-router";
import { authenticate, unauthenticated } from "../shopify.server";
import { syncForestockCatalog } from "../forestock.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, topic, shop } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  const productId = payload.admin_graphql_api_id || `gid://shopify/Product/${payload.id}`;
  const { admin } = await unauthenticated.admin(shop);
  const response = await admin.graphql(
    `#graphql
      query ForestockWebhookProduct($id: ID!) {
        product(id: $id) {
          id
          title
          productType
          vendor
          status
          featuredImage {
            url
          }
          variants(first: 100) {
            nodes {
              id
              title
              sku
              barcode
              price
              inventoryQuantity
              inventoryItem {
                id
              }
            }
          }
        }
      }`,
    { variables: { id: productId } },
  );

  const result = (await response.json()) as {
    data?: {
      product?: {
        id: string;
        title: string;
        productType?: string | null;
        vendor?: string | null;
        status?: string | null;
        featuredImage?: {
          url?: string | null;
        } | null;
        variants?: {
          nodes?: Array<{
            id: string;
            title?: string | null;
            sku?: string | null;
            barcode?: string | null;
            price?: string | null;
            inventoryQuantity?: number | null;
            inventoryItem?: { id?: string | null } | null;
          }>;
        } | null;
      } | null;
    };
  };

  const product = result.data?.product;
  if (!product) {
    return new Response();
  }

  await syncForestockCatalog({
    shopDomain: shop,
    items: (product.variants?.nodes ?? []).map((variant) => ({
      shopifyProductGid: product.id,
      shopifyVariantGid: variant.id,
      shopifyInventoryItemGid: variant.inventoryItem?.id ?? null,
      productImageUrl: product.featuredImage?.url ?? null,
      sku: variant.sku ?? null,
      name: product.title,
      variantTitle: variant.title ?? null,
      category: product.productType ?? null,
      vendor: product.vendor ?? null,
      barcode: variant.barcode ?? null,
      unitCost: variant.price ? Number(variant.price) : null,
      inventoryQuantity: variant.inventoryQuantity ?? 0,
      active: product.status === "ACTIVE",
    })),
  });

  return new Response();
};
