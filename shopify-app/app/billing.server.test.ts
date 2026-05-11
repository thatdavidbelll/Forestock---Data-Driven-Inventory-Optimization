import { describe, expect, it } from "vitest";

import { resolvePlanTier, resolveWebhookPlanTier } from "./billing.server";

describe("billing plan helpers", () => {
  it("maps active subscriptions to the paid tier", () => {
    expect(
      resolvePlanTier({
        activeSubscriptions: [{ id: "1", name: "Forestock", status: "ACTIVE", currentPeriodEnd: null }],
        hasActiveSubscription: true,
      }),
    ).toBe("PAID");
  });

  it("maps missing billing access to the free tier", () => {
    expect(
      resolvePlanTier({
        activeSubscriptions: [],
        hasActiveSubscription: false,
      }),
    ).toBe("FREE");
  });

  it("maps subscription webhook status to a plan tier", () => {
    expect(resolveWebhookPlanTier("ACTIVE")).toBe("PAID");
    expect(resolveWebhookPlanTier("CANCELLED")).toBe("FREE");
  });
});
