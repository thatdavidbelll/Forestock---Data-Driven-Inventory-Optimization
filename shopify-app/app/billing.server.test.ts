import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./forestock.server", () => ({
  syncForestockPlan: vi.fn(),
}));

import { buildManagedPricingUrl, loadBillingContext, resolvePlanTier, resolveWebhookPlanTier } from "./billing.server";
import { syncForestockPlan } from "./forestock.server";

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json",
    },
  });
}

function buildAdmin(activeSubscriptions: Array<{ id: string; name: string; status: string; currentPeriodEnd: string | null }>) {
  return {
    graphql: vi.fn().mockResolvedValue(
      jsonResponse({
        data: {
          currentAppInstallation: {
            activeSubscriptions,
          },
        },
      }),
    ),
  };
}

describe("billing plan helpers", () => {
  const syncForestockPlanMock = vi.mocked(syncForestockPlan);
  const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  beforeEach(() => {
    syncForestockPlanMock.mockReset();
    delete process.env.SHOPIFY_MANAGED_PRICING_HANDLE;
    consoleErrorSpy.mockClear();
  });

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

  it("builds the default managed pricing deep link", () => {
    expect(buildManagedPricingUrl()).toBe("shopify://admin/charges/forestock-inventory-forecast/pricing_plans");
  });

  it("builds the managed pricing deep link from the configured handle", () => {
    process.env.SHOPIFY_MANAGED_PRICING_HANDLE = "custom-pricing-handle";

    expect(buildManagedPricingUrl()).toBe("shopify://admin/charges/custom-pricing-handle/pricing_plans");
  });

  it("uses the synced backend plan when billing sync succeeds", async () => {
    syncForestockPlanMock.mockResolvedValue({
      planTier: "PAID",
      productLimit: null,
      activeProductCount: 42,
      remainingProductSlots: null,
      overProductLimit: false,
      forecastAllowed: true,
      statusMessage: null,
    });

    const result = await loadBillingContext(
      buildAdmin([{ id: "1", name: "Forestock", status: "ACTIVE", currentPeriodEnd: null }]),
      "paid-shop.myshopify.com",
    );

    expect(syncForestockPlanMock).toHaveBeenCalledWith("paid-shop.myshopify.com", "PAID");
    expect(result.billingPlanTier).toBe("PAID");
    expect(result.appPlanTier).toBe("PAID");
    expect(result.planSync).toEqual({
      ok: true,
      syncedPlan: expect.objectContaining({
        planTier: "PAID",
        activeProductCount: 42,
      }),
    });
  });

  it("keeps the app on the free tier until paid billing sync succeeds", async () => {
    syncForestockPlanMock.mockRejectedValue(new Error("Failed to sync Forestock plan"));

    const result = await loadBillingContext(
      buildAdmin([{ id: "1", name: "Forestock", status: "ACTIVE", currentPeriodEnd: null }]),
      "paid-shop.myshopify.com",
    );

    expect(syncForestockPlanMock).toHaveBeenCalledWith("paid-shop.myshopify.com", "PAID");
    expect(result.billingPlanTier).toBe("PAID");
    expect(result.appPlanTier).toBe("FREE");
    expect(result.planSync).toEqual({
      ok: false,
      message: "Failed to sync Forestock plan",
    });
  });
});
