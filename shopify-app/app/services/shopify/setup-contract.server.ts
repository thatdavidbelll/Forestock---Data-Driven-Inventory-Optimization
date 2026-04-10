export const SHOPIFY_SETUP_HISTORY_DAYS_DEFAULT = 60;

export interface ShopifyGraphqlAdmin {
  graphql(
    query: string,
    options?: {
      variables?: Record<string, unknown>;
    },
  ): Promise<Response>;
}

export type ShopifyShopIdentity = {
  shopName: string;
  shopDomain: string;
};

export type ShopifyCatalogSyncItem = {
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
};

export type ShopifyOrderBackfillLineItem = {
  shopifyLineItemId: number | null;
  shopifyVariantGid: string | null;
  sku: string | null;
  title: string;
  variantTitle: string | null;
  quantity: number;
  price: number | null;
};

export type ShopifyOrderBackfillOrder = {
  shopifyOrderId: number | null;
  orderNumber: string | null;
  orderName: string | null;
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  totalPrice: number | null;
  subtotalPrice: number | null;
  currency: string | null;
  createdAt: string;
  updatedAt: string | null;
  lineItems: ShopifyOrderBackfillLineItem[];
};

export type ShopifyProvisionResult = {
  storeName: string;
  storeSlug: string;
  createdStore: boolean;
  adminUsername: string | null;
};

export type ShopifyCatalogSyncResult = {
  processedItems: number;
  createdProducts: number;
  updatedProducts: number;
  inventorySnapshotsCreated: number;
};

export type ShopifyOrderBackfillResult = {
  importedOrders: number;
  duplicateOrders: number;
  matchedLineItems: number;
  unmatchedLineItems: number;
  salesRowsUpserted: number;
};

export type ShopifySetupExternalBlock = {
  step: "orders";
  code: "SHOPIFY_PROTECTED_CUSTOMER_DATA_REQUIRED";
  message: string;
};

export type ShopifySetupStepResult = {
  intent: "full";
  ok: boolean;
  message: string;
  provisioned?: ShopifyProvisionResult | null;
  catalogSync?: ShopifyCatalogSyncResult | null;
  orderBackfill?: ShopifyOrderBackfillResult | null;
  forecastTriggered?: boolean | null;
  externalBlock?: ShopifySetupExternalBlock | null;
};

export type ShopifySetupRunRequest = {
  admin: ShopifyGraphqlAdmin;
  shopDomain: string;
  shopName: string;
  historyDays?: number;
};
