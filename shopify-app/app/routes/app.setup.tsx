import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import {
  backfillForestockOrders,
  provisionForestockShop,
  syncForestockCatalog,
} from "../forestock.server";

type ShopIdentity = {
  shopName: string;
  shopDomain: string;
};

type ActionData = {
  intent: "provision" | "catalog" | "orders" | "full";
  ok: boolean;
  message: string;
  provisioned?: {
    storeName: string;
    storeSlug: string;
    createdStore: boolean;
    adminUsername: string | null;
  } | null;
  catalogSync?: {
    processedItems: number;
    createdProducts: number;
    updatedProducts: number;
    inventorySnapshotsCreated: number;
  } | null;
  orderBackfill?: {
    importedOrders: number;
    duplicateOrders: number;
    matchedLineItems: number;
    unmatchedLineItems: number;
    salesRowsUpserted: number;
  } | null;
};

async function loadShopIdentity(admin: Awaited<ReturnType<typeof authenticate.admin>>["admin"], fallbackShop: string) {
  const response = await admin.graphql(
    `#graphql
      query ForestockProvisioningShop {
        shop {
          name
          myshopifyDomain
        }
      }`,
  );

  const result = (await response.json()) as {
    data?: {
      shop?: {
        name?: string | null;
        myshopifyDomain?: string | null;
      };
    };
  };

  const shop = result.data?.shop;
  return {
    shopName: shop?.name?.trim() || fallbackShop.replace(".myshopify.com", ""),
    shopDomain: shop?.myshopifyDomain?.trim() || fallbackShop,
  } satisfies ShopIdentity;
}

async function collectCatalogItems(admin: Awaited<ReturnType<typeof authenticate.admin>>["admin"]) {
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

  return items;
}

async function collectOrders(admin: Awaited<ReturnType<typeof authenticate.admin>>["admin"]) {
  let hasNextPage = true;
  let cursor: string | null = null;
  const orders = [];
  const backfillQuery = `created_at:>=${new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
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

  return orders;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  return loadShopIdentity(admin, session.shop);
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const identity = await loadShopIdentity(admin, session.shop);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "") as ActionData["intent"];

  try {
    if (intent === "provision") {
      const provisioned = await provisionForestockShop({
        shopDomain: identity.shopDomain,
        shopName: identity.shopName,
        email: null,
      });

      return {
        intent,
        ok: true,
        message: "Workspace linkage completed.",
        provisioned: {
          storeName: provisioned.storeName,
          storeSlug: provisioned.storeSlug,
          createdStore: provisioned.createdStore,
          adminUsername: provisioned.adminUsername,
        },
      } satisfies ActionData;
    }

    if (intent === "catalog") {
      const items = await collectCatalogItems(admin);
      const catalogSync = await syncForestockCatalog({
        shopDomain: identity.shopDomain,
        items,
      });

      return {
        intent,
        ok: true,
        message: "Catalog and inventory import completed.",
        catalogSync,
      } satisfies ActionData;
    }

    if (intent === "orders") {
      const orders = await collectOrders(admin);
      const orderBackfill = await backfillForestockOrders({
        shopDomain: identity.shopDomain,
        orders,
      });

      return {
        intent,
        ok: true,
        message: "Order history import completed.",
        orderBackfill,
      } satisfies ActionData;
    }

    if (intent === "full") {
      const provisioned = await provisionForestockShop({
        shopDomain: identity.shopDomain,
        shopName: identity.shopName,
        email: null,
      });
      const items = await collectCatalogItems(admin);
      const catalogSync = await syncForestockCatalog({
        shopDomain: identity.shopDomain,
        items,
      });
      const orders = await collectOrders(admin);
      const orderBackfill = await backfillForestockOrders({
        shopDomain: identity.shopDomain,
        orders,
      });

      return {
        intent,
        ok: true,
        message: "Full setup completed.",
        provisioned: {
          storeName: provisioned.storeName,
          storeSlug: provisioned.storeSlug,
          createdStore: provisioned.createdStore,
          adminUsername: provisioned.adminUsername,
        },
        catalogSync,
        orderBackfill,
      } satisfies ActionData;
    }

    return {
      intent: "full",
      ok: false,
      message: "Unknown setup action.",
    } satisfies ActionData;
  } catch (error) {
    return {
      intent: intent || "full",
      ok: false,
      message: error instanceof Error ? error.message : "Setup action failed.",
    } satisfies ActionData;
  }
};

function StepResult({ data }: { data: ActionData | undefined }) {
  if (!data) return null;

  return (
    <s-box
      padding="base"
      borderWidth="base"
      borderRadius="base"
      background="subdued"
    >
      <s-stack direction="block" gap="base">
        <s-paragraph>{data.message}</s-paragraph>
        {data.provisioned ? (
          <s-stack direction="block" gap="base">
            <p>Workspace: {data.provisioned.storeName}</p>
            <p>Workspace slug: {data.provisioned.storeSlug}</p>
            <p>Admin username: {data.provisioned.adminUsername ?? "Pending"}</p>
          </s-stack>
        ) : null}
        {data.catalogSync ? (
          <s-stack direction="block" gap="base">
            <p>Products processed: {data.catalogSync.processedItems}</p>
            <p>Products created: {data.catalogSync.createdProducts}</p>
            <p>Products updated: {data.catalogSync.updatedProducts}</p>
            <p>Inventory snapshots: {data.catalogSync.inventorySnapshotsCreated}</p>
          </s-stack>
        ) : null}
        {data.orderBackfill ? (
          <s-stack direction="block" gap="base">
            <p>Orders imported: {data.orderBackfill.importedOrders}</p>
            <p>Duplicates skipped: {data.orderBackfill.duplicateOrders}</p>
            <p>Matched line items: {data.orderBackfill.matchedLineItems}</p>
            <p>Unmatched line items: {data.orderBackfill.unmatchedLineItems}</p>
            <p>Sales rows written: {data.orderBackfill.salesRowsUpserted}</p>
          </s-stack>
        ) : null}
      </s-stack>
    </s-box>
  );
}

function ActionSection({
  title,
  description,
  buttonLabel,
  intent,
  fetcher,
}: {
  title: string;
  description: string;
  buttonLabel: string;
  intent: ActionData["intent"];
  fetcher: ReturnType<typeof useFetcher<ActionData>>;
}) {
  const busy = fetcher.state !== "idle";
  const result = fetcher.data?.intent === intent ? fetcher.data : undefined;

  return (
    <s-section heading={title}>
      <s-stack direction="block" gap="base">
        <s-paragraph>{description}</s-paragraph>
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value={intent} />
          <s-button type="submit" loading={busy}>
            {busy ? "Running..." : buttonLabel}
          </s-button>
        </fetcher.Form>
        <StepResult data={result} />
      </s-stack>
    </s-section>
  );
}

export default function SetupPage() {
  const { shopName, shopDomain } = useLoaderData<typeof loader>();
  const fullSetupFetcher = useFetcher<ActionData>();
  const provisionFetcher = useFetcher<ActionData>();
  const catalogFetcher = useFetcher<ActionData>();
  const ordersFetcher = useFetcher<ActionData>();

  return (
    <s-page heading="Setup and sync">
      <s-section heading="Shop identity">
        <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
            <s-stack direction="block" gap="base">
              <p>Shop name: {shopName}</p>
              <p>Shop domain: {shopDomain}</p>
            </s-stack>
          </s-box>
      </s-section>

      <ActionSection
        title="Run complete setup"
        description="Link the Forestock workspace, import the Shopify catalog, and backfill the recent 60 days of order history in one explicit action."
        buttonLabel="Run complete setup"
        intent="full"
        fetcher={fullSetupFetcher}
      />

      <ActionSection
        title="Link workspace"
        description="Create or reconnect the Forestock workspace for this Shopify store without importing data."
        buttonLabel="Link workspace"
        intent="provision"
        fetcher={provisionFetcher}
      />

      <ActionSection
        title="Import catalog and inventory"
        description="Pull the latest Shopify product catalog and inventory levels into Forestock."
        buttonLabel="Import catalog"
        intent="catalog"
        fetcher={catalogFetcher}
      />

      <ActionSection
        title="Import order history"
        description="Backfill the recent 60 days of Shopify order history so forecasts and recommendations have sales context."
        buttonLabel="Import orders"
        intent="orders"
        fetcher={ordersFetcher}
      />
    </s-page>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
