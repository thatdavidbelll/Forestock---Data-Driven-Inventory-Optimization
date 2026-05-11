import {
  MERCHANT_SETUP_RETRY_MESSAGE,
  syncForestockPlan,
  type PlanSyncResponse,
} from "./forestock.server";

type ActiveSubscription = {
  id: string;
  name: string;
  status: string;
  currentPeriodEnd: string | null;
};

export type BillingStatus = {
  activeSubscriptions: ActiveSubscription[];
  hasActiveSubscription: boolean;
};

export type PlanTier = "FREE" | "PAID";

export type BillingContext = {
  billing: BillingStatus;
  billingPlanTier: PlanTier;
  appPlanTier: PlanTier;
  planSync:
    | {
        ok: true;
        syncedPlan: PlanSyncResponse;
      }
    | {
        ok: false;
        message: string;
      };
};

const DEFAULT_MANAGED_PRICING_HANDLE = "forestock-inventory-forecast";

export function shouldEnforceBilling() {
  return process.env.NODE_ENV === "production" || process.env.FORESTOCK_ENFORCE_BILLING === "true";
}

export function hasBillingAccess(billing: BillingStatus) {
  return billing.hasActiveSubscription || !shouldEnforceBilling();
}

export function resolvePlanTier(billing: BillingStatus): PlanTier {
  return billing.hasActiveSubscription ? "PAID" : "FREE";
}

export function resolveWebhookPlanTier(status: string | undefined): PlanTier {
  return status === "ACTIVE" ? "PAID" : "FREE";
}

export function buildManagedPricingUrl(
  managedPricingHandle = process.env.SHOPIFY_MANAGED_PRICING_HANDLE || DEFAULT_MANAGED_PRICING_HANDLE,
) {
  return `shopify://admin/charges/${managedPricingHandle}/pricing_plans`;
}

export function buildPlanSyncErrorMessage(billingPlanTier: PlanTier, detail: string) {
  const normalizedDetail = detail.trim().toLowerCase();
  if (
    detail === MERCHANT_SETUP_RETRY_MESSAGE
    || normalizedDetail.includes("unauthorized")
    || normalizedDetail.includes("please log in")
    || normalizedDetail.includes("invalid provisioning secret")
  ) {
    return MERCHANT_SETUP_RETRY_MESSAGE;
  }

  const prefix = billingPlanTier === "PAID"
    ? "Shopify billing is active, but Forestock could not sync the paid plan yet. Refresh the app or rerun setup in a moment."
    : "Forestock could not sync this store plan yet. Try again in a moment.";

  return detail ? `${prefix} ${detail}` : prefix;
}

export async function getBillingStatus(admin: { graphql: (query: string) => Promise<Response> }): Promise<BillingStatus> {
  try {
    const response = await admin.graphql(`
      #graphql
      query ForestockBillingStatus {
        currentAppInstallation {
          activeSubscriptions {
            id
            name
            status
            currentPeriodEnd
          }
        }
      }
    `);

    const body = await response.json() as {
      data?: {
        currentAppInstallation?: {
          activeSubscriptions?: ActiveSubscription[];
        } | null;
      };
      errors?: unknown[];
    };

    if (Array.isArray(body.errors) && body.errors.length > 0) {
      console.error("[Forestock] Billing GraphQL errors:", JSON.stringify(body.errors));
      return {
        activeSubscriptions: [],
        hasActiveSubscription: true,
      };
    }

    const activeSubscriptions = body.data?.currentAppInstallation?.activeSubscriptions ?? [];

    return {
      activeSubscriptions,
      hasActiveSubscription: activeSubscriptions.some((subscription) => subscription.status === "ACTIVE"),
    };
  } catch (error) {
    console.error("[Forestock] Failed to load billing status:", error);
    return {
      activeSubscriptions: [],
      hasActiveSubscription: true,
    };
  }
}

export async function loadBillingContext(
  admin: { graphql: (query: string) => Promise<Response> },
  shopDomain: string,
): Promise<BillingContext> {
  const billing = await getBillingStatus(admin);
  const billingPlanTier = resolvePlanTier(billing);

  try {
    const syncedPlan = await syncForestockPlan(shopDomain, billingPlanTier);
    return {
      billing,
      billingPlanTier,
      appPlanTier: syncedPlan.planTier,
      planSync: {
        ok: true,
        syncedPlan,
      },
    };
  } catch (error) {
    console.error(`[Forestock] Failed to sync plan for ${shopDomain}:`, error);
    return {
      billing,
      billingPlanTier,
      appPlanTier: "FREE",
      planSync: {
        ok: false,
        message: error instanceof Error ? error.message : "Failed to sync Forestock plan",
      },
    };
  }
}
