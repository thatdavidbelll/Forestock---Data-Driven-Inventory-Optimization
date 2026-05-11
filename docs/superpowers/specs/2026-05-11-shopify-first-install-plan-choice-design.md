# Shopify First-Install Plan Choice Design

## Summary

When a merchant opens the embedded Shopify app for the first time after install, Forestock should stop before setup and require an explicit plan choice. The merchant can either continue on the free tier immediately or open Shopify billing to activate the paid tier. Forestock should not treat the default backend `FREE` plan as merchant intent.

## Goals

- Require an explicit `Free` or `Paid` choice before onboarding/setup starts on a brand new install.
- Keep `Free` as a first-class path, not a disguised paywall.
- Confirm `Paid` only after Shopify billing is actually active and backend plan sync succeeds.
- Avoid re-prompting existing merchants or previously confirmed free-tier merchants on every app load.

## Non-Goals

- No change to the paid billing product itself or Shopify managed pricing configuration.
- No change to forecast, product-limit, or catalog reactivation rules beyond the new gate.
- No redesign of the rest of onboarding beyond inserting the new chooser step.

## Current Constraints

- `ShopifyConnection.planTier` currently defaults to `FREE`, so new installs already look like free-tier stores even though the merchant never chose that plan.
- The root embedded app loader already computes billing state and syncs paid/free status with the backend.
- The embedded app currently routes incomplete stores into onboarding automatically.
- Existing merchants should not suddenly be blocked by a new chooser after deployment.

## Proposed Approach

### 1. Persist explicit plan-choice confirmation

Add a new boolean field on `shopify_connections`, `plan_choice_confirmed`.

- Existing rows are backfilled to `true` during migration so deployed stores are not re-gated.
- New Shopify installs create connections with `plan_choice_confirmed = false`.
- Reinstalls preserve the existing value on the connection record.

### 2. Distinguish billing sync from merchant choice

Keep Shopify billing sync as the source of truth for paid status, but stop letting it imply free-tier consent.

- `syncPlanForShop(..., PAID)` should set `plan_choice_confirmed = true`.
- `syncPlanForShop(..., FREE)` should keep the existing confirmation flag unchanged.
- A separate explicit backend action confirms the free-tier choice and marks `plan_choice_confirmed = true`.

This keeps the states unambiguous:

- default new install: `FREE`, not confirmed
- merchant clicked free: `FREE`, confirmed
- merchant completed billing: `PAID`, confirmed

### 3. Gate embedded routes at the `/app` parent loader

The embedded app root loader should:

- authenticate the merchant
- load billing context and sync paid/free plan state
- load backend app-home overview to read `planChoiceConfirmed`
- redirect all `/app/*` routes except `/app/plan` to `/app/plan` when `planChoiceConfirmed` is false
- redirect `/app/plan` back to `/app` once `planChoiceConfirmed` becomes true

This keeps gating centralized instead of duplicating the check in every child route.

### 4. Add a dedicated `/app/plan` chooser screen

The new screen should:

- explain the free and paid tiers in plain language
- provide a `Continue with Free` form action
- provide a `Choose Paid in Shopify` CTA that opens managed pricing in Shopify Admin
- surface any billing-sync warning when paid billing is active but backend sync is still failing

The root navigation should stay hidden while the chooser gate is active.

### 5. Preserve the existing onboarding and paid recovery behavior

After the merchant chooses a plan:

- free-tier merchants are sent into onboarding and setup
- paid merchants complete billing in Shopify and then return into onboarding/home through the existing setup gating
- the existing paid-plan rerun logic still handles “paid but still capped at 15 products”

## Data / API Changes

### Backend

- Add `planChoiceConfirmed` to `ShopifyConnection`
- Extend `StorePlanService.PlanSnapshot` to include `planChoiceConfirmed`
- Extend Shopify app-home responses to include `planChoiceConfirmed`
- Add a backend endpoint for explicit free-tier confirmation

### Shopify app

- Add `planChoiceConfirmed` to the TypeScript response models
- Add a new `confirmForestockFreePlanChoice(shopDomain)` API helper
- Add a new `app.plan.tsx` route
- Update the `/app` root loader to perform the chooser redirect logic

## Edge Cases

- Existing stores after deploy should never see the chooser because migration backfills confirmation to `true`.
- If Shopify billing is active but backend sync fails, the chooser remains visible with a warning rather than pretending setup can continue as paid.
- If a merchant manually revisits `/app/plan` after confirmation, they should be bounced back into `/app`.
- If the backend connection is missing unexpectedly, the existing reprovisioning recovery path should still recreate it before the chooser logic runs.

## Testing Strategy

- Backend unit/controller tests for:
  - migration-facing default behavior through service snapshots
  - free-tier choice confirmation endpoint
  - paid sync confirming choice while free sync does not auto-confirm a fresh install
- Shopify app tests for:
  - chooser redirect helper behavior
  - billing context / plan choice interactions
  - the free-choice action path

## Rollout Notes

- This is safe to deploy behind a migration because existing merchants are explicitly backfilled to confirmed.
- New installs after deployment will see the chooser immediately without affecting older stores.
