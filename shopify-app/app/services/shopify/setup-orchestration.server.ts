import {
  backfillForestockOrders,
  provisionForestockShop,
  syncForestockCatalog,
  triggerForestockForecast,
} from "../../forestock.server";
import {
  SHOPIFY_SETUP_HISTORY_DAYS_DEFAULT,
  type ShopifySetupExternalBlock,
  type ShopifySetupRunRequest,
  type ShopifySetupStepResult,
} from "./setup-contract.server";
import {
  collectCatalogItems,
  collectHistoricalOrders,
} from "./setup-collection.server";

function currencySymbolFromMoneyFormat(moneyFormat: string | null | undefined): string | null {
  if (!moneyFormat) {
    return null;
  }

  const symbol = moneyFormat.replace(/\{\{.*?\}\}/g, "").trim();
  return symbol || null;
}

function detectOrderAccessExternalBlock(error: unknown): ShopifySetupExternalBlock | null {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();
  const mentionsOrders =
    normalized.includes("order") ||
    normalized.includes("read_orders") ||
    normalized.includes("protected customer data");
  const looksLikePermissionFailure =
    normalized.includes("access denied") ||
    normalized.includes("not approved") ||
    normalized.includes("protected customer data") ||
    normalized.includes("protected data");

  if (!mentionsOrders || !looksLikePermissionFailure) {
    return null;
  }

  return {
    step: "orders",
    code: "SHOPIFY_PROTECTED_CUSTOMER_DATA_REQUIRED",
    message:
      "Shopify blocked order-history access for this app. Protected customer data approval is still required before Forestock can import orders or validate the order webhook in a real store.",
  };
}

async function runShopifyProvisionStep({
  shopDomain,
  shopName,
  currencyCode,
  moneyFormat,
}: {
  shopDomain: string;
  shopName: string;
  currencyCode: string | null;
  moneyFormat: string | null;
}): Promise<ShopifySetupStepResult> {
  const provisioned = await provisionForestockShop({
    shopDomain,
    shopName,
    email: null,
    currencyCode,
    currencySymbol: currencySymbolFromMoneyFormat(moneyFormat),
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
  try {
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
  } catch (error) {
    const externalBlock = detectOrderAccessExternalBlock(error);
    if (!externalBlock) {
      throw error;
    }

    return {
      intent: "full",
      ok: true,
      message: externalBlock.message,
      externalBlock,
    };
  }
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
  currencyCode,
  moneyFormat,
  historyDays = SHOPIFY_SETUP_HISTORY_DAYS_DEFAULT,
}: {
  admin: Parameters<typeof collectCatalogItems>[0];
  shopDomain: string;
  shopName: string;
  currencyCode: string | null;
  moneyFormat: string | null;
  historyDays?: number;
}): Promise<ShopifySetupStepResult> {
  const provisionStep = await runShopifyProvisionStep({ shopDomain, shopName, currencyCode, moneyFormat });
  const catalogStep = await runShopifyCatalogSyncStep({ shopDomain, admin });
  const ordersStep = await runShopifyOrderBackfillStep({ shopDomain, admin, historyDays });
  const forecastStep = ordersStep.externalBlock
    ? {
        intent: "full" as const,
        ok: true,
        message: ordersStep.message,
        forecastTriggered: false,
        externalBlock: ordersStep.externalBlock,
      }
    : await runShopifyForecastStep({ shopDomain });

  return {
    intent: "full",
    ok: true,
    message: ordersStep.externalBlock
      ? "Automatic setup completed as far as Shopify approval currently allows."
      : forecastStep.message,
    provisioned: provisionStep.provisioned,
    catalogSync: catalogStep.catalogSync,
    orderBackfill: ordersStep.orderBackfill,
    forecastTriggered: forecastStep.forecastTriggered ?? false,
    externalBlock: ordersStep.externalBlock ?? forecastStep.externalBlock ?? null,
  };
}

export async function runShopifyAutomaticSetup({
  admin,
  shopDomain,
  shopName,
  currencyCode,
  moneyFormat,
  historyDays = SHOPIFY_SETUP_HISTORY_DAYS_DEFAULT,
}: ShopifySetupRunRequest): Promise<ShopifySetupStepResult> {
  return runShopifyFullSetup({ admin, shopDomain, shopName, currencyCode, moneyFormat, historyDays });
}
