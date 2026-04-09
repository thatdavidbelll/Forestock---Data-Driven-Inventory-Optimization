type ProvisionRequest = {
  shopDomain: string;
  shopName: string | null;
  email: string | null;
};

type ProvisionResponse = {
  storeId: string;
  storeName: string;
  storeSlug: string;
  shopDomain: string;
  adminUsername: string | null;
  createdStore: boolean;
  createdAdminUser: boolean;
};

type CatalogSyncItem = {
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

type CatalogSyncResponse = {
  shopDomain: string;
  processedItems: number;
  createdProducts: number;
  updatedProducts: number;
  inventorySnapshotsCreated: number;
};

type OrderBackfillLineItem = {
  shopifyLineItemId: number | null;
  shopifyVariantGid: string | null;
  sku: string | null;
  title: string;
  variantTitle: string | null;
  quantity: number;
  price: number | null;
};

type OrderBackfillOrder = {
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
  lineItems: OrderBackfillLineItem[];
};

type OrderBackfillResponse = {
  shopDomain: string;
  importedOrders: number;
  duplicateOrders: number;
  matchedLineItems: number;
  unmatchedLineItems: number;
  salesRowsUpserted: number;
};

type ProductDeleteResponse = {
  shopDomain: string;
  shopifyProductGid: string;
  deactivatedProducts: number;
};

type InventorySyncResponse = {
  shopDomain: string;
  productId: string;
  shopifyInventoryItemGid: string;
  quantity: number;
  inventorySnapshotCreated: boolean;
};

type DisconnectResponse = {
  shopDomain: string;
  active: boolean;
};

export type ForecastProof = {
  status: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  durationSeconds: number | null;
  productsProcessed: number | null;
  productsWithInsufficientData: number | null;
  horizonDays: number | null;
  triggeredBy: string | null;
  errorMessage: string | null;
  readyForRecommendations: boolean;
};

export type AppHomeOverviewResponse = {
  shopDomain: string;
  storeName: string;
  shopifyConnectionActive: boolean;
  activeProductCount: number;
  totalProductCount: number;
  hasSalesHistory: boolean;
  salesTransactionCount: number;
  latestSaleDate: string | null;
  forecastStatus: string | null;
  forecastCompletedAt: string | null;
  lastForecastStartedAt: string | null;
  forecastProof: ForecastProof | null;
  recommendationReadinessReasons: string[];
  criticalSuggestions: number;
  highSuggestions: number;
  totalActiveSuggestions: number;
  topRecommendation: RecommendationCard | null;
  dataQualityWarnings: string[];
  nextActions: string[];
};

type RecommendationCard = {
  id: string;
  productId?: string;
  productName: string;
  productSku: string;
  productCategory?: string | null;
  unit?: string | null;
  urgency: string;
  daysOfStock: number | null;
  suggestedQty: number | null;
  forecastP50?: number | null;
  forecastP90?: number | null;
  currentStock?: number | null;
  leadTimeDaysAtGeneration?: number | null;
  moqApplied?: number | null;
  estimatedOrderValue: number | null;
  supplierName: string | null;
  acknowledged?: boolean;
  acknowledgedAt?: string | null;
  acknowledgedReason?: string | null;
  quantityOrdered?: number | null;
  expectedDelivery?: string | null;
  orderReference?: string | null;
  generatedAt: string | null;
};

type RecommendationsResponse = {
  shopDomain: string;
  forecastStatus: string | null;
  forecastCompletedAt: string | null;
  recommendations: RecommendationCard[];
};

function getApiBaseUrl() {
  const apiBaseUrl = process.env.FORESTOCK_API_BASE_URL;
  if (!apiBaseUrl) {
    throw new Error("FORESTOCK_API_BASE_URL is not configured");
  }
  return apiBaseUrl.replace(/\/$/, "");
}

function getProvisioningSecret() {
  const provisioningSecret = process.env.FORESTOCK_PROVISIONING_SECRET;
  if (!provisioningSecret) {
    throw new Error("FORESTOCK_PROVISIONING_SECRET is not configured");
  }
  return provisioningSecret;
}

export async function provisionForestockShop(
  payload: ProvisionRequest,
): Promise<ProvisionResponse> {
  const apiBaseUrl = getApiBaseUrl();
  const provisioningSecret = getProvisioningSecret();

  const response = await fetch(`${apiBaseUrl}/api/shopify/provision`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forestock-Shopify-Secret": provisioningSecret,
    },
    body: JSON.stringify(payload),
  });

  const responseBody = (await response.json()) as {
    message?: string;
    data?: ProvisionResponse;
  };

  if (!response.ok || !responseBody.data) {
    throw new Error(responseBody.message || "Failed to provision Forestock store");
  }

  return responseBody.data;
}

export async function syncForestockCatalog(payload: {
  shopDomain: string;
  items: CatalogSyncItem[];
}): Promise<CatalogSyncResponse> {
  const apiBaseUrl = getApiBaseUrl();
  const provisioningSecret = getProvisioningSecret();

  const response = await fetch(`${apiBaseUrl}/api/shopify/catalog-sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forestock-Shopify-Secret": provisioningSecret,
    },
    body: JSON.stringify(payload),
  });

  const responseBody = (await response.json()) as {
    message?: string;
    data?: CatalogSyncResponse;
  };

  if (!response.ok || !responseBody.data) {
    throw new Error(responseBody.message || "Failed to sync Forestock catalog");
  }

  return responseBody.data;
}

export async function backfillForestockOrders(payload: {
  shopDomain: string;
  orders: OrderBackfillOrder[];
}): Promise<OrderBackfillResponse> {
  const apiBaseUrl = getApiBaseUrl();
  const provisioningSecret = getProvisioningSecret();

  const response = await fetch(`${apiBaseUrl}/api/shopify/order-backfill`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forestock-Shopify-Secret": provisioningSecret,
    },
    body: JSON.stringify(payload),
  });

  const responseBody = (await response.json()) as {
    message?: string;
    data?: OrderBackfillResponse;
  };

  if (!response.ok || !responseBody.data) {
    throw new Error(responseBody.message || "Failed to backfill Forestock orders");
  }

  return responseBody.data;
}

export async function deleteForestockProduct(payload: {
  shopDomain: string;
  shopifyProductGid: string;
}): Promise<ProductDeleteResponse> {
  const apiBaseUrl = getApiBaseUrl();
  const provisioningSecret = getProvisioningSecret();

  const response = await fetch(`${apiBaseUrl}/api/shopify/product-delete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forestock-Shopify-Secret": provisioningSecret,
    },
    body: JSON.stringify(payload),
  });

  const responseBody = (await response.json()) as { message?: string; data?: ProductDeleteResponse };
  if (!response.ok || !responseBody.data) {
    throw new Error(responseBody.message || "Failed to delete Forestock product");
  }
  return responseBody.data;
}

export async function syncForestockInventory(payload: {
  shopDomain: string;
  shopifyInventoryItemGid: string;
  quantity: number;
}): Promise<InventorySyncResponse> {
  const apiBaseUrl = getApiBaseUrl();
  const provisioningSecret = getProvisioningSecret();

  const response = await fetch(`${apiBaseUrl}/api/shopify/inventory-sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forestock-Shopify-Secret": provisioningSecret,
    },
    body: JSON.stringify(payload),
  });

  const responseBody = (await response.json()) as { message?: string; data?: InventorySyncResponse };
  if (!response.ok || !responseBody.data) {
    throw new Error(responseBody.message || "Failed to sync Forestock inventory");
  }
  return responseBody.data;
}

export async function disconnectForestockShop(payload: {
  shopDomain: string;
}): Promise<DisconnectResponse> {
  const apiBaseUrl = getApiBaseUrl();
  const provisioningSecret = getProvisioningSecret();

  const response = await fetch(`${apiBaseUrl}/api/shopify/disconnect`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forestock-Shopify-Secret": provisioningSecret,
    },
    body: JSON.stringify(payload),
  });

  const responseBody = (await response.json()) as { message?: string; data?: DisconnectResponse };
  if (!response.ok || !responseBody.data) {
    throw new Error(responseBody.message || "Failed to disconnect Forestock shop");
  }
  return responseBody.data;
}

export async function getForestockAppHome(shopDomain: string): Promise<AppHomeOverviewResponse> {
  const apiBaseUrl = getApiBaseUrl();
  const provisioningSecret = getProvisioningSecret();

  const response = await fetch(
    `${apiBaseUrl}/api/shopify/app-home?shopDomain=${encodeURIComponent(shopDomain)}`,
    {
      headers: {
        "X-Forestock-Shopify-Secret": provisioningSecret,
      },
    },
  );

  const responseBody = (await response.json()) as {
    message?: string;
    data?: AppHomeOverviewResponse;
  };
  if (!response.ok || !responseBody.data) {
    throw new Error(responseBody.message || "Failed to load Forestock app home");
  }
  return responseBody.data;
}

export async function getForestockRecommendations(shopDomain: string): Promise<RecommendationsResponse> {
  const apiBaseUrl = getApiBaseUrl();
  const provisioningSecret = getProvisioningSecret();

  const response = await fetch(
    `${apiBaseUrl}/api/shopify/recommendations?shopDomain=${encodeURIComponent(shopDomain)}`,
    {
      headers: {
        "X-Forestock-Shopify-Secret": provisioningSecret,
      },
    },
  );

  const responseBody = (await response.json()) as {
    message?: string;
    data?: RecommendationsResponse;
  };
  if (!response.ok || !responseBody.data) {
    throw new Error(responseBody.message || "Failed to load Forestock recommendations");
  }
  return responseBody.data;
}
