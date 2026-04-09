# Shopify Resume

## Plan

- Master plan: [SHOPIFY_RESET_PLAN.md](/Users/davidbell/DAVE%20MAIN/06%20DEV/Forestock/docs/SHOPIFY_RESET_PLAN.md)
- Phase gate: [SHOPIFY_PHASE1_TEST_CHECKLIST.md](/Users/davidbell/DAVE%20MAIN/06%20DEV/Forestock/docs/SHOPIFY_PHASE1_TEST_CHECKLIST.md)

Stay on the reset plan:
- keep forecast logic in backend only
- Shopify app is embedded UI + orchestration only
- validate each phase before expanding scope

## Current Status

- Shopify app shell is rebuilt enough to load and navigate.
- Shopify runtime/auth/session storage on EC2 was repaired.
- Shopify app session storage now uses Neon/Postgres schema `shopify_app`.
- Backend runtime was repaired and is currently pointed at the direct Neon URL instead of the pooler.
- Shopify app can load from Shopify Admin when install/auth state is healthy.
- Product and inventory flows are partly working.
- Order-based forecasting is still externally blocked by Shopify protected customer data approval.

## Known External Blockers

- Shopify protected customer data approval is still required for `Order` access.
- Without that approval:
  - order history import is blocked
  - `ORDERS_CREATE` webhook registration is rejected
  - full demand/forecast workflow cannot be considered publish-ready

## Latest Code State

Recent important commits:
- `35d6406` Fix Shopify order backfill and deploy runtime
- `b1210bc` Fix backend deploy on dirty EC2 checkout

Important code/workflow changes already in `main`:
- Shopify order backfill no longer queries invalid GraphQL `LineItem.legacyResourceId`
- Shopify deploy workflow no longer ships `node_modules`
- Shopify deploy installs runtime deps on EC2 and runs Prisma generate/migrate
- Backend deploy no longer depends on `git pull` from a dirty EC2 repo checkout

## EC2 Runtime Notes

- Shopify app runtime path:
  - `/home/ubuntu/forestock/shopify-runtime`
- Backend repo/runtime path:
  - `/home/ubuntu/forestock/forestock-backend`
- Shopify systemd service:
  - `forestock-shopify`
- Backend container:
  - `forestock-app`

## Database Notes

- Shopify app Prisma/session tables:
  - Neon schema `shopify_app`
  - tables: `Session`, `_prisma_migrations`
- Backend business tables:
  - Neon `public` schema
  - includes `shopify_connections`, `shopify_orders`, `shopify_order_line_items`, `audit_logs`, `products`, `stores`, `users`, etc.

Important runtime decision:
- backend currently uses the direct Neon JDBC URL instead of the pooler
- reason: the pooler path caused schema-resolution problems during production startup/runtime

## Most Recent Runtime Findings

- Shopify “Unexpected Server Error” was traced to backend DB/schema/runtime issues and repaired.
- Backend health was verified as `UP` after runtime correction.
- Shopify `app-home` endpoint was verified returning `200`.
- After switching to custom distribution, a white-screen issue appeared that looked like stale install/auth state rather than a hard server crash.
- Logs showed:
  - mostly `200` responses for embedded routes
  - some `401` responses during auth/session transitions
  - an `APP_UNINSTALLED` webhook after the distribution switch
  - likely app identity change / stale install state

## Current Session Findings — 2026-04-09

- Local repo state is clean except for untracked `resume.txt`.
- `shopify-app` still matches the reset-plan shape:
  - embedded auth redirect helper exists
  - debug auth logging exists behind `SHOPIFY_DEBUG_AUTH=true`
  - no new normal-path manual shop-link dependency was introduced
- Local validation gates passed:
  - `npm run typecheck`
  - `npm run build`
- No unfinished local code change is indicated by the handoff state.
- The remaining critical work is live environment validation, not local compilation repair.

## Next Step To Resume

1. Uninstall the app from the dev store.
2. Reinstall it from the current custom distribution link.
3. Open it in an incognito/private window.
4. Verify the deployed Shopify secrets match the current Partner app exactly:
   - `SHOPIFY_API_KEY`
   - `SHOPIFY_API_SECRET`
   - `SHOPIFY_APP_URL`
5. Enable `SHOPIFY_DEBUG_AUTH=true` temporarily if embedded auth still fails or lands on the wrong route.
6. Re-test:
   - app opens from Shopify Admin
   - `Home`
   - `Setup`
   - catalog sync
   - recommendations
7. Capture evidence in:
   - `docs/SHOPIFY_DEV_STORE_VALIDATION_PLAN.md`
   - `docs/SHOPIFY_VALIDATION_EVIDENCE_TEMPLATE.md`
8. Do not expect order-history import to fully work until protected customer data approval is granted.

## Immediate Resume Decision

If working locally only, no code change is currently required.

If working against live Shopify/runtime, continue with reinstall + auth validation before touching broader setup/recommendation logic.

## If White Screen Persists

Check in this order:
- stale install in dev store
- stale browser session
- mismatched Partner app API key/secret vs deployed secrets
- embedded auth redirect behavior from Shopify Admin

## Resume Prompt

Next time, say:

`Resume from docs/SHOPIFY_RESUME.md`
