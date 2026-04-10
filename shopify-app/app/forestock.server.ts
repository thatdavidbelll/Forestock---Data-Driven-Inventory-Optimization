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

type ForecastTriggerResponse = {
  message: string;
};

export type StoreConfigurationResponse = {
  timezone: string;
  currencySymbol: string;
  forecastHorizonDays: number;
  lookbackDays: number;
  minHistoryDays: number;
  seasonalityPeriod: number;
  safetyStockMultiplier: number;
  urgencyCriticalDays: number;
  urgencyHighDays: number;
  urgencyMediumDays: number;
  autoForecastOnImport: boolean;
  updatedAt: string | null;
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
  lowConfidence?: boolean;
  historyDaysAtGeneration?: number | null;
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

async function readApiResponse<T>(response: Response): Promise<{ message?: string; data?: T }> {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      return (await response.json()) as { message?: string; data?: T };
    } catch {
      return { message: "Received invalid JSON from Forestock API" };
    }
  }

  try {
    const text = await response.text();
    const normalized = text.trim();
    const titleMatch = normalized.match(/<title>([^<]+)<\/title>/i);
    const paragraphMatch = normalized.match(/<p>([^<]+)<\/p>/i);

    if (titleMatch || paragraphMatch) {
      const parts = [titleMatch?.[1], paragraphMatch?.[1]]
        .filter((value): value is string => Boolean(value && value.trim()))
        .map((value) => value.replace(/\s+/g, " ").trim());
      return { message: parts.join(" — ") || response.statusText };
    }

    return { message: normalized || response.statusText };
  } catch {
    return { message: response.statusText || "Forestock API request failed" };
  }
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

  const responseBody = await readApiResponse<ProvisionResponse>(response);

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

  const responseBody = await readApiResponse<CatalogSyncResponse>(response);

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

  const responseBody = await readApiResponse<OrderBackfillResponse>(response);

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

  const responseBody = await readApiResponse<ProductDeleteResponse>(response);
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

  const responseBody = await readApiResponse<InventorySyncResponse>(response);
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

  const responseBody = await readApiResponse<DisconnectResponse>(response);
  if (!response.ok || !responseBody.data) {
    throw new Error(responseBody.message || "Failed to disconnect Forestock shop");
  }
  return responseBody.data;
}

export async function triggerForestockForecast(shopDomain: string): Promise<ForecastTriggerResponse> {
  const apiBaseUrl = getApiBaseUrl();
  const provisioningSecret = getProvisioningSecret();

  const response = await fetch(
    `${apiBaseUrl}/api/shopify/forecast-run?shopDomain=${encodeURIComponent(shopDomain)}`,
    {
      method: "POST",
      headers: {
        "X-Forestock-Shopify-Secret": provisioningSecret,
      },
    },
  );

  const responseBody = await readApiResponse<string>(response);

  if (!response.ok) {
    throw new Error(responseBody.message || "Failed to trigger Forestock forecast");
  }

  return {
    message: responseBody.data || responseBody.message || "Forecast started in background",
  };
}

export async function getForestockStoreConfig(shopDomain: string): Promise<StoreConfigurationResponse> {
  const apiBaseUrl = getApiBaseUrl();
  const provisioningSecret = getProvisioningSecret();

  const response = await fetch(
    `${apiBaseUrl}/api/shopify/config?shopDomain=${encodeURIComponent(shopDomain)}`,
    {
      headers: {
        "X-Forestock-Shopify-Secret": provisioningSecret,
      },
    },
  );

  const responseBody = await readApiResponse<StoreConfigurationResponse>(response);

  if (!response.ok || !responseBody.data) {
    throw new Error(responseBody.message || "Failed to load Forestock store config");
  }

  return responseBody.data;
}

export async function updateForestockStoreConfig(
  shopDomain: string,
  payload: Partial<Pick<StoreConfigurationResponse, "forecastHorizonDays">>,
): Promise<StoreConfigurationResponse> {
  const apiBaseUrl = getApiBaseUrl();
  const provisioningSecret = getProvisioningSecret();

  const response = await fetch(
    `${apiBaseUrl}/api/shopify/config?shopDomain=${encodeURIComponent(shopDomain)}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Forestock-Shopify-Secret": provisioningSecret,
      },
      body: JSON.stringify(payload),
    },
  );

  const responseBody = await readApiResponse<StoreConfigurationResponse>(response);

  if (!response.ok || !responseBody.data) {
    throw new Error(responseBody.message || "Failed to update Forestock store config");
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

  const responseBody = await readApiResponse<AppHomeOverviewResponse>(response);
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

  const responseBody = await readApiResponse<RecommendationsResponse>(response);
  if (!response.ok || !responseBody.data) {
    throw new Error(responseBody.message || "Failed to load Forestock recommendations");
  }
  return responseBody.data;
}

export async function notifyCustomerDataRequest(payload: {
  shopDomain: string;
  customerId: number;
  customerEmail: string | null;
  ordersRequestedCount: number | null;
}): Promise<void> {
  const apiBaseUrl = getApiBaseUrl();
  const provisioningSecret = getProvisioningSecret();

  const response = await fetch(
    `${apiBaseUrl}/api/shopify/gdpr/customers/data-request`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forestock-Shopify-Secret": provisioningSecret,
      },
      body: JSON.stringify(payload),
    },
  );

  const responseBody = await readApiResponse<void>(response);
  if (!response.ok) {
    throw new Error(
      responseBody.message || "Failed to log GDPR customer data request",
    );
  }
}

export async function redactCustomerData(payload: {
  shopDomain: string;
  customerId: number;
  customerEmail: string | null;
  ordersToRedact: number[];
}): Promise<void> {
  const apiBaseUrl = getApiBaseUrl();
  const provisioningSecret = getProvisioningSecret();

  const response = await fetch(
    `${apiBaseUrl}/api/shopify/gdpr/customers/redact`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forestock-Shopify-Secret": provisioningSecret,
      },
      body: JSON.stringify(payload),
    },
  );

  const responseBody = await readApiResponse<void>(response);
  if (!response.ok) {
    throw new Error(responseBody.message || "Failed to redact customer data");
  }
}

export async function redactShopData(payload: {
  shopDomain: string;
}): Promise<void> {
  const apiBaseUrl = getApiBaseUrl();
  const provisioningSecret = getProvisioningSecret();

  const response = await fetch(`${apiBaseUrl}/api/shopify/gdpr/shop/redact`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forestock-Shopify-Secret": provisioningSecret,
    },
    body: JSON.stringify(payload),
  });

  const responseBody = await readApiResponse<void>(response);
  if (!response.ok) {
    throw new Error(responseBody.message || "Failed to redact shop data");
  }
}
