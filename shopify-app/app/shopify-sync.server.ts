import {
  loadShopIdentity,
  runShopifyCatalogSyncStep,
  runShopifyFullSetup,
  runShopifyOrderBackfillStep,
  runShopifyProvisionStep,
  runShopifySetupIntent,
  SHOPIFY_SETUP_HISTORY_DAYS_DEFAULT,
} from "./services/shopify/index.server";

export type {
  ShopifyCatalogSyncItem as CatalogBootstrapItem,
  ShopifyGraphqlAdmin as AdminContext,
  ShopifyOrderBackfillOrder as OrderBackfillPayload,
  ShopifySetupIntent,
  ShopifySetupRunRequest,
  ShopifySetupStepResult,
  ShopifyShopIdentity as ShopIdentity,
} from "./services/shopify/index.server";

export {
  loadShopIdentity,
  runShopifyFullSetup,
  runShopifySetupIntent,
  SHOPIFY_SETUP_HISTORY_DAYS_DEFAULT,
};

export async function runProvisionShop(
  identity: import("./services/shopify/index.server").ShopifyShopIdentity,
) {
  const result = await runShopifyProvisionStep(identity);
  if (!result.provisioned) {
    throw new Error("Provision step did not return workspace data");
  }
  return result.provisioned;
}

export async function runCatalogSync(
  admin: import("./services/shopify/index.server").ShopifyGraphqlAdmin,
  identity: import("./services/shopify/index.server").ShopifyShopIdentity,
) {
  const result = await runShopifyCatalogSyncStep({ admin, shopDomain: identity.shopDomain });
  if (!result.catalogSync) {
    throw new Error("Catalog sync step did not return catalog data");
  }
  return result.catalogSync;
}

export async function runOrderBackfill(
  admin: import("./services/shopify/index.server").ShopifyGraphqlAdmin,
  identity: import("./services/shopify/index.server").ShopifyShopIdentity,
  historyDays = SHOPIFY_SETUP_HISTORY_DAYS_DEFAULT,
) {
  const result = await runShopifyOrderBackfillStep({
    admin,
    shopDomain: identity.shopDomain,
    historyDays,
  });
  if (!result.orderBackfill) {
    throw new Error("Order backfill step did not return order data");
  }
  return result.orderBackfill;
}
