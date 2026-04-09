import {
  SHOPIFY_SETUP_HISTORY_DAYS_DEFAULT,
  type ShopifyCatalogSyncItem,
  type ShopifyGraphqlAdmin,
  type ShopifyOrderBackfillOrder,
  type ShopifyShopIdentity,
} from "./setup-contract.server";

function buildOrderHistoryQuery(historyDays: number) {
  const safeDays = Number.isFinite(historyDays) && historyDays > 0
    ? Math.floor(historyDays)
    : SHOPIFY_SETUP_HISTORY_DAYS_DEFAULT;

  return `created_at:>=${new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)}`;
}

async function readGraphQLPayload<T>(response: Response, failureMessage: string) {
  const payload = (await response.json()) as {
    data?: T;
    errors?: Array<{ message?: string }>;
  };

  if (!response.ok) {
    throw new Error(failureMessage);
  }

  if (!payload.data) {
    const graphqlMessage = payload.errors?.find((error) => error.message)?.message;
    throw new Error(graphqlMessage || failureMessage);
  }

  return payload.data;
}

export async function loadShopIdentity(
  admin: ShopifyGraphqlAdmin,
  fallbackShop: string,
): Promise<ShopifyShopIdentity> {
  const response = await admin.graphql(
    `#graphql
      query ForestockProvisioningShop {
        shop {
          name
          myshopifyDomain
        }
      }`,
  );

  const result = await readGraphQLPayload<{
    shop?: {
      name?: string | null;
      myshopifyDomain?: string | null;
    } | null;
  }>(response, "Failed to load Shopify shop identity");

  const shop = result.shop;
  return {
    shopName: shop?.name?.trim() || fallbackShop.replace(".myshopify.com", ""),
    shopDomain: shop?.myshopifyDomain?.trim() || fallbackShop,
  };
}

export async function collectCatalogItems(
  admin: ShopifyGraphqlAdmin,
): Promise<ShopifyCatalogSyncItem[]> {
  let hasNextPage = true;
  let cursor: string | null = null;
  const items: ShopifyCatalogSyncItem[] = [];

  while (hasNextPage) {
    const catalogResponse = await admin.graphql(
      `#graphql
        query ForestockCatalogBootstrap($after: String) {
          products(first: 50, after: $after) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              id
              title
              productType
              vendor
              status
              variants(first: 50) {
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
          }
        }`,
      { variables: { after: cursor } },
    );

    const catalogResult = await readGraphQLPayload<{
      products?: {
        pageInfo?: {
          hasNextPage?: boolean | null;
          endCursor?: string | null;
        } | null;
        nodes?: Array<{
          id: string;
          title: string;
          productType?: string | null;
          vendor?: string | null;
          status?: string | null;
          variants?: {
            nodes?: Array<{
              id: string;
              title?: string | null;
              sku?: string | null;
              barcode?: string | null;
              price?: string | null;
              inventoryQuantity?: number | null;
              inventoryItem?: { id?: string | null } | null;
            }> | null;
          } | null;
        }> | null;
      } | null;
    }>(catalogResponse, "Failed to load Shopify catalog");

    const products = catalogResult.products;
    for (const product of products?.nodes ?? []) {
      for (const variant of product.variants?.nodes ?? []) {
        items.push({
          shopifyProductGid: product.id,
          shopifyVariantGid: variant.id,
          shopifyInventoryItemGid: variant.inventoryItem?.id ?? null,
          sku: variant.sku ?? null,
          name: product.title,
          variantTitle: variant.title ?? null,
          category: product.productType ?? null,
          vendor: product.vendor ?? null,
          barcode: variant.barcode ?? null,
          unitCost: variant.price ? Number(variant.price) : null,
          inventoryQuantity: variant.inventoryQuantity ?? 0,
          active: product.status === "ACTIVE",
        });
      }
    }

    hasNextPage = Boolean(products?.pageInfo?.hasNextPage);
    cursor = products?.pageInfo?.endCursor ?? null;
  }

  return items;
}

export async function collectHistoricalOrders(
  admin: ShopifyGraphqlAdmin,
  historyDays = SHOPIFY_SETUP_HISTORY_DAYS_DEFAULT,
): Promise<ShopifyOrderBackfillOrder[]> {
  let hasNextPage = true;
  let cursor: string | null = null;
  const orders: ShopifyOrderBackfillOrder[] = [];
  const backfillQuery = buildOrderHistoryQuery(historyDays);

  while (hasNextPage) {
    const ordersResponse = await admin.graphql(
      `#graphql
        query ForestockOrderBackfill($after: String, $query: String!) {
          orders(first: 50, after: $after, sortKey: CREATED_AT, query: $query) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              legacyResourceId
              displayFulfillmentStatus
              displayFinancialStatus
              createdAt
              updatedAt
              name
              currentTotalPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              subtotalPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              lineItems(first: 100) {
                nodes {
                  legacyResourceId
                  name
                  quantity
                  sku
                  variantTitle
                  originalUnitPriceSet {
                    shopMoney {
                      amount
                    }
                  }
                  variant {
                    id
                  }
                }
              }
            }
          }
        }`,
      { variables: { after: cursor, query: backfillQuery } },
    );

    const ordersResult = await readGraphQLPayload<{
      orders?: {
        pageInfo?: {
          hasNextPage?: boolean | null;
          endCursor?: string | null;
        } | null;
        nodes?: Array<{
          legacyResourceId?: string | null;
          displayFulfillmentStatus?: string | null;
          displayFinancialStatus?: string | null;
          createdAt: string;
          updatedAt?: string | null;
          name?: string | null;
          currentTotalPriceSet?: {
            shopMoney?: {
              amount?: string | null;
              currencyCode?: string | null;
            } | null;
          } | null;
          subtotalPriceSet?: {
            shopMoney?: {
              amount?: string | null;
              currencyCode?: string | null;
            } | null;
          } | null;
          lineItems?: {
            nodes?: Array<{
              legacyResourceId?: string | null;
              name: string;
              quantity: number;
              sku?: string | null;
              variantTitle?: string | null;
              originalUnitPriceSet?: {
                shopMoney?: {
                  amount?: string | null;
                } | null;
              } | null;
              variant?: {
                id?: string | null;
              } | null;
            }> | null;
          } | null;
        }> | null;
      } | null;
    }>(ordersResponse, "Failed to load Shopify orders");

    const orderNodes = ordersResult.orders?.nodes ?? [];
    for (const order of orderNodes) {
      orders.push({
        shopifyOrderId: order.legacyResourceId ? Number(order.legacyResourceId) : null,
        orderNumber: order.name ?? null,
        orderName: order.name ?? null,
        financialStatus: order.displayFinancialStatus ?? null,
        fulfillmentStatus: order.displayFulfillmentStatus ?? null,
        totalPrice: order.currentTotalPriceSet?.shopMoney?.amount
          ? Number(order.currentTotalPriceSet.shopMoney.amount)
          : null,
        subtotalPrice: order.subtotalPriceSet?.shopMoney?.amount
          ? Number(order.subtotalPriceSet.shopMoney.amount)
          : null,
        currency:
          order.currentTotalPriceSet?.shopMoney?.currencyCode ??
          order.subtotalPriceSet?.shopMoney?.currencyCode ??
          null,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt ?? null,
        lineItems: (order.lineItems?.nodes ?? []).map((lineItem, index) => ({
          shopifyLineItemId: lineItem.legacyResourceId
            ? Number(lineItem.legacyResourceId)
            : Number(`${order.legacyResourceId ?? 0}${String(index + 1).padStart(3, "0")}`),
          shopifyVariantGid: lineItem.variant?.id ?? null,
          sku: lineItem.sku ?? null,
          title: lineItem.name,
          variantTitle: lineItem.variantTitle ?? null,
          quantity: lineItem.quantity,
          price: lineItem.originalUnitPriceSet?.shopMoney?.amount
            ? Number(lineItem.originalUnitPriceSet.shopMoney.amount)
            : null,
        })),
      });
    }

    hasNextPage = Boolean(ordersResult.orders?.pageInfo?.hasNextPage);
    cursor = ordersResult.orders?.pageInfo?.endCursor ?? null;
  }

  return orders;
}

export { buildOrderHistoryQuery };
