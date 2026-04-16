import { getForestockAppHome, getForestockStoreConfig, provisionForestockShop } from "./forestock.server";
import { loadShopIdentity } from "./shopify-sync.server";

function isMissingShopifyConnectionError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("No active Shopify connection found for this shop")
  );
}

async function reprovisionShop(admin: Parameters<typeof loadShopIdentity>[0], shopDomain: string) {
  const identity = await loadShopIdentity(admin, shopDomain);
  await provisionForestockShop({
    shopDomain: identity.shopDomain,
    shopName: identity.shopName,
    email: null,
    currencyCode: identity.currencyCode,
    currencySymbol: identity.moneyFormat,
  });
  return identity;
}

export async function loadForestockAppHomeWithRecovery(
  admin: Parameters<typeof loadShopIdentity>[0],
  shopDomain: string,
) {
  try {
    return await getForestockAppHome(shopDomain);
  } catch (error) {
    if (!isMissingShopifyConnectionError(error)) {
      throw error;
    }

    await reprovisionShop(admin, shopDomain);
    return getForestockAppHome(shopDomain);
  }
}

export async function loadForestockConfigWithRecovery(
  admin: Parameters<typeof loadShopIdentity>[0],
  shopDomain: string,
) {
  try {
    return await getForestockStoreConfig(shopDomain);
  } catch (error) {
    if (!isMissingShopifyConnectionError(error)) {
      throw error;
    }

    await reprovisionShop(admin, shopDomain);
    return getForestockStoreConfig(shopDomain);
  }
}
