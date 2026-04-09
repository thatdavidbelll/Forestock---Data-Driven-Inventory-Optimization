import {
  backfillForestockOrders,
  provisionForestockShop,
  syncForestockCatalog,
  triggerForestockForecast,
} from "../../forestock.server";
import {
  SHOPIFY_SETUP_HISTORY_DAYS_DEFAULT,
  type ShopifySetupRunRequest,
  type ShopifySetupStepResult,
} from "./setup-contract.server";
import {
  collectCatalogItems,
  collectHistoricalOrders,
} from "./setup-collection.server";

export async function runShopifyProvisionStep({
  shopDomain,
  shopName,
}: {
  shopDomain: string;
  shopName: string;
}): Promise<ShopifySetupStepResult> {
  const provisioned = await provisionForestockShop({
    shopDomain,
    shopName,
    email: null,
  });

  return {
    intent: "provision",
    ok: true,
    message: "Workspace linkage completed.",
    provisioned: {
      storeName: provisioned.storeName,
      storeSlug: provisioned.storeSlug,
      createdStore: provisioned.createdStore,
      adminUsername: provisioned.adminUsername,
    },
  };
}

export async function runShopifyCatalogSyncStep({
  shopDomain,
  admin,
}: {
  shopDomain: string;
  admin: Parameters<typeof collectCatalogItems>[0];
}): Promise<ShopifySetupStepResult> {
  const items = await collectCatalogItems(admin);
  const catalogSync = await syncForestockCatalog({
    shopDomain,
    items,
  });

  return {
    intent: "catalog",
    ok: true,
    message: "Catalog and inventory import completed.",
    catalogSync,
  };
}

export async function runShopifyOrderBackfillStep({
  shopDomain,
  admin,
  historyDays = SHOPIFY_SETUP_HISTORY_DAYS_DEFAULT,
}: {
  shopDomain: string;
  admin: Parameters<typeof collectHistoricalOrders>[0];
  historyDays?: number;
}): Promise<ShopifySetupStepResult> {
  const orders = await collectHistoricalOrders(admin, historyDays);
  const orderBackfill = await backfillForestockOrders({
    shopDomain,
    orders,
  });

  return {
    intent: "orders",
    ok: true,
    message: "Order history import completed.",
    orderBackfill,
  };
}

export async function runShopifyForecastStep({
  shopDomain,
}: {
  shopDomain: string;
}): Promise<ShopifySetupStepResult> {
  const forecast = await triggerForestockForecast(shopDomain);

  return {
    intent: "forecast",
    ok: true,
    message: forecast.message,
    forecastTriggered: true,
  };
}

export async function runShopifyFullSetup({
  admin,
  shopDomain,
  shopName,
  historyDays = SHOPIFY_SETUP_HISTORY_DAYS_DEFAULT,
}: {
  admin: Parameters<typeof collectCatalogItems>[0];
  shopDomain: string;
  shopName: string;
  historyDays?: number;
}): Promise<ShopifySetupStepResult> {
  const provisioned = await provisionForestockShop({
    shopDomain,
    shopName,
    email: null,
  });

  const items = await collectCatalogItems(admin);
  const catalogSync = await syncForestockCatalog({
    shopDomain,
    items,
  });

  const orders = await collectHistoricalOrders(admin, historyDays);
  const orderBackfill = await backfillForestockOrders({
    shopDomain,
    orders,
  });

  const forecast = await triggerForestockForecast(shopDomain);

  return {
    intent: "full",
    ok: true,
    message: forecast.message,
    provisioned: {
      storeName: provisioned.storeName,
      storeSlug: provisioned.storeSlug,
      createdStore: provisioned.createdStore,
      adminUsername: provisioned.adminUsername,
    },
    catalogSync,
    orderBackfill,
    forecastTriggered: true,
  };
}

export async function runShopifySetupIntent({
  intent,
  admin,
  shopDomain,
  shopName,
  historyDays = SHOPIFY_SETUP_HISTORY_DAYS_DEFAULT,
}: ShopifySetupRunRequest): Promise<ShopifySetupStepResult> {
  switch (intent) {
    case "provision":
      return runShopifyProvisionStep({ shopDomain, shopName });
    case "catalog":
      return runShopifyCatalogSyncStep({ shopDomain, admin });
    case "orders":
      return runShopifyOrderBackfillStep({ shopDomain, admin, historyDays });
    case "forecast":
      return runShopifyForecastStep({ shopDomain });
    case "full":
      return runShopifyFullSetup({ admin, shopDomain, shopName, historyDays });
    default: {
      const exhaustiveCheck: never = intent;
      throw new Error(`Unsupported Shopify setup intent: ${String(exhaustiveCheck)}`);
    }
  }
}
