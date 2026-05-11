import { describe, expect, it } from "vitest";

import { resolvePlanChoiceRedirect } from "./plan-choice.server";

describe("resolvePlanChoiceRedirect", () => {
  it("redirects unconfirmed merchants into the chooser", () => {
    expect(
      resolvePlanChoiceRedirect({
        pathname: "/app/settings",
        search: "?shop=test-shop.myshopify.com",
        planChoiceConfirmed: false,
      }),
    ).toBe("/app/plan?shop=test-shop.myshopify.com");
  });

  it("keeps the chooser route accessible while the choice is still required", () => {
    expect(
      resolvePlanChoiceRedirect({
        pathname: "/app/plan",
        search: "?shop=test-shop.myshopify.com",
        planChoiceConfirmed: false,
      }),
    ).toBeNull();
  });

  it("redirects confirmed merchants out of the chooser", () => {
    expect(
      resolvePlanChoiceRedirect({
        pathname: "/app/plan",
        search: "?shop=test-shop.myshopify.com",
        planChoiceConfirmed: true,
      }),
    ).toBe("/app?shop=test-shop.myshopify.com");
  });

  it("does not redirect confirmed merchants on normal app routes", () => {
    expect(
      resolvePlanChoiceRedirect({
        pathname: "/app/recommendations",
        search: "?shop=test-shop.myshopify.com",
        planChoiceConfirmed: true,
      }),
    ).toBeNull();
  });
});
