import { describe, expect, it } from "vitest";

import { resolveMerchantSafeSetupErrorMessage } from "./forestock.server";

describe("resolveMerchantSafeSetupErrorMessage", () => {
  it("hides backend auth details for unauthorized setup calls", () => {
    expect(
      resolveMerchantSafeSetupErrorMessage(401, "Unauthorized — please log in.", "Failed to sync Forestock plan"),
    ).toBe("Forestock could not finish setup right now. Please try again in a moment.");

    expect(
      resolveMerchantSafeSetupErrorMessage(403, "Invalid provisioning secret", "Failed to confirm Forestock free plan choice"),
    ).toBe("Forestock could not finish setup right now. Please try again in a moment.");
  });

  it("keeps specific backend details for non-auth setup failures", () => {
    expect(
      resolveMerchantSafeSetupErrorMessage(500, "Store plan sync timed out", "Failed to sync Forestock plan"),
    ).toBe("Store plan sync timed out");

    expect(
      resolveMerchantSafeSetupErrorMessage(422, undefined, "Failed to confirm Forestock free plan choice"),
    ).toBe("Failed to confirm Forestock free plan choice");
  });
});
