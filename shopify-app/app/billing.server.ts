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
