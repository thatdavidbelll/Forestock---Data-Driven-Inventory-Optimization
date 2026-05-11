# Free Tier And Paid Plan Design

Date: 2026-05-11
Status: Approved design draft

## Goal

Introduce a two-tier pricing model for Shopify-connected Forestock stores:

- `FREE`: merchants can access the app and track up to 15 active products
- `PAID`: merchants pay `$14.99/month` and can track unlimited active products

This must be enforced consistently across the backend, the embedded Shopify app, Shopify catalog sync, and forecast execution.

## Current State

- The Shopify embedded app treats missing billing as no access and redirects merchants to `/app/billing`.
- Shopify billing state is resolved in the embedded app via GraphQL, but not persisted in the backend.
- The backend has no concept of pricing tier or product cap.
- Product tracking and forecast behavior are driven by `active` products.

## Product Decisions

### Chosen enforcement model

The limit applies to active tracked products, not to total imported product rows.

- Free stores may have unlimited total product rows in the database.
- Free stores may have at most 15 active products.
- Paid stores may have unlimited active products.

### Access behavior

- Free stores keep access to the embedded app.
- Paid status removes the 15-product cap.
- The billing page becomes an upgrade surface, not an access gate.

### Downgrade behavior

Downgrades must be non-destructive.

- If a paid store downgrades to free while already above 15 active products, existing products remain as-is.
- The store is marked as over limit.
- While over limit, the merchant can still use the app, but cannot activate additional products.
- Forecast execution is blocked with a clear message until the store is back at 15 active products or the merchant upgrades again.

## Recommended Architecture

The backend becomes the source of truth for plan enforcement.

### Backend plan state

Persist pricing state on the Shopify-linked store record.

Required fields:

- `plan_tier`: enum-like string, `FREE` or `PAID`
- `product_limit`: integer, `15` for free and `NULL` for unlimited paid

This plan state should live with Shopify-linked store metadata so it can be used by:

- product create and restore flows
- Shopify catalog sync
- forecast orchestration
- app-home and config payloads
- future standalone and admin surfaces

### Shopify as source of billing truth

The Shopify embedded app continues to read live billing from Shopify GraphQL.
That resolved billing state is then synced into the backend.

Sync sources:

- embedded app load path
- `app/subscriptions_update` webhook

Normalization rules:

- active subscription present -> `PAID`
- no active subscription -> `FREE`

### Why backend ownership is required

A frontend-only check would be bypassed by:

- backend product APIs
- scheduled forecasts
- Shopify webhooks and catalog sync
- standalone web flows

Persisting the normalized plan tier in the backend prevents inconsistent behavior across surfaces.

## Data Model Changes

### Shopify connection or linked store metadata

Add persisted plan fields to the backend model used for Shopify-connected stores. The simplest fit in the current codebase is the Shopify connection record because plan state comes directly from Shopify billing.

Expected fields:

- `planTier`
- `productLimit`
- optional derived helper such as `isOverProductLimit` computed at runtime, not necessarily stored

### API response changes

Expose plan metadata in backend responses already used by the embedded app, especially app-home payloads.

Add fields such as:

- `planTier`
- `productLimit`
- `activeProductCount`
- `remainingProductSlots`
- `overProductLimit`
- optional `planMessage`

The embedded UI should render plan state from these backend values instead of duplicating business rules client-side.

## Backend Enforcement Rules

### Manual product creation

`POST /api/products`

- If the incoming product is inactive, allow creation.
- If the incoming product is active and the store is paid, allow creation.
- If the incoming product is active and the store is free:
  - allow when active count is below 15
  - reject with `409 CONFLICT` when active count is already 15

Recommended error message:

`Free plan limit reached. Upgrade to track more than 15 active products.`

### Manual product update

`PUT /api/products/{id}`

- Allow ordinary field edits.
- If the update keeps the product inactive, allow it.
- If the update would transition the product from inactive to active:
  - allow for paid stores
  - allow for free stores only when active count is below 15
  - reject for free stores at limit

### Product restore

`PUT /api/products/{id}/restore`

Treat restore as a reactivation.

- Paid: always allow
- Free: allow only when active count is below 15
- Free at limit: reject with the same pricing-limit message

### Shopify catalog sync

Catalog sync must preserve merchant data without violating the tracked-product cap.

For free stores:

- Existing products continue to update normally.
- New products are imported as active only while free slots remain.
- Additional new products beyond the 15-active cap are still imported, but saved as inactive.

For paid stores:

- Import and activate normally without a cap.

This keeps catalog visibility and future upgrade paths intact while enforcing the free plan.

### Forecast execution

Forecasting already operates on active products, so no 15-product subset selection should be introduced.

Rules:

- Free and within limit: forecast runs normally.
- Paid: forecast runs normally.
- Free and over limit after downgrade: block forecast execution with a clear error/status message.

Recommended message:

`This store is on the Free plan with more than 15 active products. Reduce active products to 15 or upgrade to resume forecasting.`

This rule should be enforced anywhere forecasts can be triggered:

- embedded app actions
- backend forecast endpoints
- automated/scheduled forecast execution

## Embedded Shopify App Changes

### Routing and access

Remove the current behavior that redirects non-paying merchants away from the app.

New behavior:

- Free merchants can access `/app`
- Free merchants can access onboarding, home, recommendations, and settings
- Billing becomes an upgrade destination, not the only accessible page

### Billing page

Update the billing page to present two plans:

- `Free`: app access and up to 15 active tracked products
- `Paid`: `$14.99/month` and unlimited active tracked products

The page should also show the current store status:

- current plan
- current active product count
- remaining free slots, or unlimited

Important operational note:

The `$14.99/month` amount in app copy must match the actual Shopify managed pricing configuration in the Shopify Partner Dashboard. This repo does not appear to define the managed price itself.

### App surfaces that should expose plan state

Plan status should be visible where merchants already see store readiness and catalog counts:

- app home
- onboarding
- settings

Recommended UI elements:

- plan badge: `Free` or `Paid`
- usage text: `12 / 15 active products` or `Unlimited active products`
- over-limit warning on downgrade
- upgrade CTA that links to Shopify managed pricing

### Billing-to-backend sync

After the embedded app resolves Shopify billing state, it should update the backend plan state through a dedicated sync path.

The subscription webhook should call the same backend updater so the backend stays correct when plan state changes outside the current session.

## Error Handling

### Expected failure modes

- product activation on free store at limit
- restore on free store at limit
- forecast run while free and over limit
- billing sync failure between Shopify app and backend

### Error behavior

- enforcement failures should return factual, actionable messages
- billing sync failures should not crash app rendering
- if billing lookup fails transiently, the system should avoid silently promoting access; plan sync should retry on the next app load or webhook event

### Messaging principles

- no destructive automatic cleanup on downgrade
- no silent deactivation of merchant products
- every pricing-related block should tell the merchant what to do next:
  reduce active products or upgrade

## Testing Strategy

### Backend tests

Add tests for:

- plan sync normalization: no subscription -> free, active subscription -> paid
- manual create at 14 to 15 active products succeeds on free
- manual create above 15 active products fails on free
- inactive create above limit still succeeds
- inactive-to-active update fails when free store is already at limit
- restore fails when free store is already at limit
- paid stores bypass the limit
- Shopify catalog sync imports extra new products as inactive on free
- forecast execution is blocked for free stores that are over limit after downgrade

### Embedded app tests

Verify:

- free merchants are not redirected to billing
- billing page shows both plans and the `$14.99/month` paid copy
- plan usage copy renders from backend metadata
- over-limit warning appears for downgraded stores
- upgrade CTA points to Shopify managed pricing

## Rollout Plan

### Migration

Add a backend migration for the new plan fields.

Initial values:

- existing Shopify-connected stores start as `FREE`
- product limit starts at `15`

### Reconciliation

Existing paid merchants will be reconciled without data loss by:

- embedded app load plan sync
- subscription webhook plan sync

### Safety

- do not auto-deactivate products during rollout
- do not block app access for free merchants
- only block new activations and forecast runs when a free store exceeds the cap

## Out Of Scope

- changing actual Shopify managed pricing configuration in Shopify Partner Dashboard
- introducing multiple paid tiers beyond the single `$14.99/month` plan
- capping total product rows instead of active tracked products
- automatic product-priority selection for the free tier

## Implementation Summary

Implement a backend-owned plan model for Shopify stores, default Shopify merchants to `FREE`, sync `FREE` or `PAID` from Shopify billing, enforce a 15-active-product cap for free stores across product creation, restore, sync, and forecasts, and update the embedded Shopify app to present free access plus a paid `$14.99/month` unlimited upgrade path.
