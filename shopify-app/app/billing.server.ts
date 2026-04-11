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
  };

  const activeSubscriptions = body.data?.currentAppInstallation?.activeSubscriptions ?? [];

  return {
    activeSubscriptions,
    hasActiveSubscription: activeSubscriptions.some((subscription) => subscription.status === "ACTIVE"),
  };
}
