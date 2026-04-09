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

async function runShopifyProvisionStep({
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
    intent: "full",
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

async function runShopifyCatalogSyncStep({
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
    intent: "full",
    ok: true,
    message: "Catalog and inventory import completed.",
    catalogSync,
  };
}

async function runShopifyOrderBackfillStep({
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
    intent: "full",
    ok: true,
    message: "Order history import completed.",
    orderBackfill,
  };
}

async function runShopifyForecastStep({
  shopDomain,
}: {
  shopDomain: string;
}): Promise<ShopifySetupStepResult> {
  const forecast = await triggerForestockForecast(shopDomain);

  return {
    intent: "full",
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
  const provisionStep = await runShopifyProvisionStep({ shopDomain, shopName });
  const catalogStep = await runShopifyCatalogSyncStep({ shopDomain, admin });
  const ordersStep = await runShopifyOrderBackfillStep({ shopDomain, admin, historyDays });
  const forecastStep = await runShopifyForecastStep({ shopDomain });

  return {
    intent: "full",
    ok: true,
    message: forecastStep.message,
    provisioned: provisionStep.provisioned,
    catalogSync: catalogStep.catalogSync,
    orderBackfill: ordersStep.orderBackfill,
    forecastTriggered: forecastStep.forecastTriggered ?? true,
  };
}

export async function runShopifyAutomaticSetup({
  admin,
  shopDomain,
  shopName,
  historyDays = SHOPIFY_SETUP_HISTORY_DAYS_DEFAULT,
}: ShopifySetupRunRequest): Promise<ShopifySetupStepResult> {
  return runShopifyFullSetup({ admin, shopDomain, shopName, historyDays });
}
