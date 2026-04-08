import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useRouteError } from "react-router";
import { authenticate, registerWebhooks } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  backfillForestockOrders,
  provisionForestockShop,
  syncForestockCatalog,
} from "../forestock.server";

type LoaderData = {
  shopName: string;
  shopDomain: string;
  contactEmail: string | null;
  provisioned: {
    storeId: string;
    storeName: string;
    storeSlug: string;
    shopDomain: string;
    adminUsername: string | null;
    createdStore: boolean;
    createdAdminUser: boolean;
  } | null;
  provisioningError: string | null;
  catalogSync: {
    processedItems: number;
    createdProducts: number;
    updatedProducts: number;
    inventorySnapshotsCreated: number;
  } | null;
  catalogSyncError: string | null;
  orderBackfill: {
    importedOrders: number;
    duplicateOrders: number;
    matchedLineItems: number;
    unmatchedLineItems: number;
    salesRowsUpserted: number;
  } | null;
  orderBackfillError: string | null;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  await registerWebhooks({ session });
  const response = await admin.graphql(
    `#graphql
      query ForestockProvisioningShop {
        shop {
          name
          myshopifyDomain
          contactEmail
        }
      }`,
  );

  const result = (await response.json()) as {
    data?: {
      shop?: {
        name?: string | null;
        myshopifyDomain?: string | null;
        contactEmail?: string | null;
      };
    };
  };

  const shop = result.data?.shop;
  const shopName = shop?.name?.trim() || session.shop.replace(".myshopify.com", "");
  const shopDomain = shop?.myshopifyDomain?.trim() || session.shop;
  const contactEmail = shop?.contactEmail?.trim() || null;

  let provisioned: LoaderData["provisioned"] = null;
  let provisioningError: string | null = null;
  let catalogSync: LoaderData["catalogSync"] = null;
  let catalogSyncError: string | null = null;
  let orderBackfill: LoaderData["orderBackfill"] = null;
  let orderBackfillError: string | null = null;

  try {
    provisioned = await provisionForestockShop({
      shopDomain,
      shopName,
      email: contactEmail,
    });
  } catch (error) {
    provisioningError =
      error instanceof Error ? error.message : "Failed to provision Forestock store";
  }

  if (!provisioningError) {
    try {
      let hasNextPage = true;
      let cursor: string | null = null;
      const items: Array<{
        shopifyProductGid: string;
        shopifyVariantGid: string;
        shopifyInventoryItemGid: string | null;
        sku: string | null;
        name: string;
        variantTitle: string | null;
        category: string | null;
        vendor: string | null;
        barcode: string | null;
        unitCost: number | null;
        inventoryQuantity: number | null;
        active: boolean;
      }> = [];

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

        const catalogResult = (await catalogResponse.json()) as {
          data?: {
            products?: {
              pageInfo?: {
                hasNextPage?: boolean | null;
                endCursor?: string | null;
              };
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
                  }>;
                } | null;
              }>;
            };
          };
        };

        const products = catalogResult.data?.products;
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

      catalogSync = await syncForestockCatalog({
        shopDomain,
        items,
      });
    } catch (error) {
      catalogSyncError =
        error instanceof Error ? error.message : "Failed to sync Shopify catalog";
    }
  }

  if (!provisioningError) {
    try {
      const orders = [];
      let hasNextPage = true;
      let cursor: string | null = null;
      const backfillQuery = `created_at:>=${new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10)}`;

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
                  customer {
                    email
                    firstName
                    lastName
                  }
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

        const ordersResult = (await ordersResponse.json()) as {
          data?: {
            orders?: {
              pageInfo?: {
                hasNextPage?: boolean | null;
                endCursor?: string | null;
              };
              nodes?: Array<{
                legacyResourceId?: string | null;
                displayFulfillmentStatus?: string | null;
                displayFinancialStatus?: string | null;
                createdAt: string;
                updatedAt?: string | null;
                name?: string | null;
                customer?: {
                  email?: string | null;
                  firstName?: string | null;
                  lastName?: string | null;
                } | null;
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
                  }>;
                } | null;
              }>;
            };
          };
        };

        const orderNodes = ordersResult.data?.orders?.nodes ?? [];
        for (const order of orderNodes) {
          orders.push({
            shopifyOrderId: order.legacyResourceId ? Number(order.legacyResourceId) : null,
            orderNumber: order.name ?? null,
            orderName: order.name ?? null,
            financialStatus: order.displayFinancialStatus ?? null,
            fulfillmentStatus: order.displayFulfillmentStatus ?? null,
            customerEmail: order.customer?.email ?? null,
            customerFirstName: order.customer?.firstName ?? null,
            customerLastName: order.customer?.lastName ?? null,
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

        hasNextPage = Boolean(ordersResult.data?.orders?.pageInfo?.hasNextPage);
        cursor = ordersResult.data?.orders?.pageInfo?.endCursor ?? null;
      }

      orderBackfill = await backfillForestockOrders({
        shopDomain,
        orders,
      });
    } catch (error) {
      orderBackfillError =
        error instanceof Error ? error.message : "Failed to backfill Shopify orders";
    }
  }

  return {
    shopName,
    shopDomain,
    contactEmail,
    provisioned,
    provisioningError,
    catalogSync,
    catalogSyncError,
    orderBackfill,
    orderBackfillError,
  } satisfies LoaderData;
};

export default function Index() {
  const {
    shopName,
    shopDomain,
    contactEmail,
    provisioned,
    provisioningError,
    catalogSync,
    catalogSyncError,
    orderBackfill,
    orderBackfillError,
  } =
    useLoaderData<typeof loader>();

  return (
    <s-page heading="Forestock setup">
      <s-section heading="Shop connected">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            Forestock is preparing your Shopify store so product data, inventory, and sales history can power forecasting and restocking suggestions.
          </s-paragraph>
          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
            background="subdued"
          >
            <s-stack direction="block" gap="base">
              <p>Shop name: {shopName}</p>
              <p>Shop domain: {shopDomain}</p>
              <p>Contact email: {contactEmail ?? "Not available from Shopify"}</p>
            </s-stack>
          </s-box>
        </s-stack>
      </s-section>

      {provisioningError ? (
        <s-section heading="Store setup needs attention">
          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
            background="subdued"
          >
            <s-paragraph>{provisioningError}</s-paragraph>
            <s-paragraph>
              Forestock could not finish linking this Shopify store automatically. The Shopify app is installed, but Forestock setup is incomplete until this is resolved.
            </s-paragraph>
          </s-box>
        </s-section>
      ) : provisioned ? (
        <s-section heading="Store setup">
          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
            background="subdued"
          >
            <s-paragraph>
              {provisioned.createdStore
                ? "A new Forestock workspace was created for this Shopify store."
                : "This Shopify store is already linked to an existing Forestock workspace."}
            </s-paragraph>
          </s-box>
          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
            background="subdued"
          >
            <s-stack direction="block" gap="base">
              <p>Forestock workspace: {provisioned.storeName}</p>
              <p>Workspace slug: {provisioned.storeSlug}</p>
              <p>Admin username: {provisioned.adminUsername ?? "Pending"}</p>
              <p>Admin user created during setup: {provisioned.createdAdminUser ? "yes" : "no"}</p>
            </s-stack>
          </s-box>
        </s-section>
      ) : null}

      {!provisioningError && (
        <s-section heading="Catalog and inventory import">
          {catalogSyncError ? (
            <s-box
              padding="base"
              borderWidth="base"
              borderRadius="base"
              background="subdued"
            >
              <s-paragraph>{catalogSyncError}</s-paragraph>
              <s-paragraph>
                Your store connection is in place, but Forestock has not finished importing products and inventory yet.
              </s-paragraph>
            </s-box>
          ) : catalogSync ? (
            <s-box
              padding="base"
              borderWidth="base"
              borderRadius="base"
              background="subdued"
            >
              <s-stack direction="block" gap="base">
                <p>Products processed: {catalogSync.processedItems}</p>
                <p>Products created in Forestock: {catalogSync.createdProducts}</p>
                <p>Products updated in Forestock: {catalogSync.updatedProducts}</p>
                <p>Inventory snapshots captured: {catalogSync.inventorySnapshotsCreated}</p>
              </s-stack>
            </s-box>
          ) : null}
        </s-section>
      )}

      {!provisioningError && (
        <s-section heading="Sales history import">
          {orderBackfillError ? (
            <s-box
              padding="base"
              borderWidth="base"
              borderRadius="base"
              background="subdued"
            >
              <s-paragraph>{orderBackfillError}</s-paragraph>
              <s-paragraph>
                Products and inventory were prepared, but Forestock has not finished importing historical Shopify orders yet.
              </s-paragraph>
            </s-box>
          ) : orderBackfill ? (
            <s-box
              padding="base"
              borderWidth="base"
              borderRadius="base"
              background="subdued"
            >
              <s-stack direction="block" gap="base">
                <p>Orders imported: {orderBackfill.importedOrders}</p>
                <p>Duplicate orders skipped: {orderBackfill.duplicateOrders}</p>
                <p>Matched line items: {orderBackfill.matchedLineItems}</p>
                <p>Unmatched line items: {orderBackfill.unmatchedLineItems}</p>
                <p>Sales rows written to Forestock: {orderBackfill.salesRowsUpserted}</p>
              </s-stack>
            </s-box>
          ) : null}
        </s-section>
      )}

      <s-section heading="What happens next">
        <s-stack direction="block" gap="base">
          <p>1. Forestock keeps this Shopify store linked for ongoing product, inventory, and order updates.</p>
          <p>2. Once enough data is available, Forestock can generate forecasting and restocking suggestions.</p>
          <p>3. If setup needs manual help, support can use the workspace and sync status shown above to continue onboarding.</p>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
