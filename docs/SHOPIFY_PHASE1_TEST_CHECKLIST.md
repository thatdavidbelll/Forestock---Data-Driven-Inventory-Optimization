# Shopify Phase 1 Test Checklist

Use this checklist before moving from Phase 1 into broader Shopify rebuild work.

## Rule

Do not advance to the next step unless the current step is validated.

## 1. Embedded Auth Entry

- [ ] Open app from Shopify Admin
- [ ] App lands in embedded flow without asking for manual shop-domain entry
- [ ] Query context survives into `/app`
- [ ] Session survives navigation between Home, Setup, and Recommendations
- [ ] Expired session recovers cleanly

## 2. Config / Runtime

- [ ] `SHOPIFY_APP_URL` matches the live app URL exactly
- [ ] Shopify Partner Dashboard app URL matches runtime
- [ ] Callback URLs match runtime:
  - [ ] `/auth/callback`
  - [ ] `/auth/shopify/callback`
- [ ] Shopify app env is present and complete
- [ ] `SHOPIFY_DEBUG_AUTH=true` can be enabled to inspect auth context when needed

## 3. Setup Flow

- [ ] Store identity loads from Shopify Admin API
- [ ] Provision step links shop to backend workspace
- [ ] Catalog sync imports products/inventory
- [ ] Order backfill imports historical orders
- [ ] Full setup runs all three in sequence
- [ ] Failed step shows deterministic error state
- [ ] Failed step can be retried without corrupting state

## 4. Backend Contract

- [ ] Shopify app can read app home payload
- [ ] Shopify app can read rich recommendations payload
- [ ] Recommendation output matches backend-generated fields
- [ ] No Shopify-side forecast logic exists

## 5. Webhook Readiness

- [ ] Product create/update/delete routes are reachable
- [ ] Inventory update route is reachable
- [ ] Order create route is reachable
- [ ] Webhook-driven updates reflect in backend state

## 6. Regression Gate

- [ ] `npm run typecheck` passes in `shopify-app`
- [ ] Focused backend tests pass for Shopify recommendation contract
- [ ] No new manual shop-link dependency was introduced
- [ ] No route now duplicates sync/orchestration logic unnecessarily

## Notes To Capture

For each failed check, record:
- exact URL
- exact step
- screenshot
- server/app log lines
- whether the issue is code, config, or deployment
