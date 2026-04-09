# Shopify Reset Plan

This is the working plan for rebuilding the Shopify app from a clean baseline while preserving the existing website/backend forecast engine.

## Core Rule

The Shopify app must not implement its own forecast algorithm.

The backend remains the single source of truth for:
- product/inventory/sales state after ingestion
- forecast orchestration
- recommendation generation

The Shopify app is responsible for:
- install/auth/session handling
- Shopify data acquisition
- setup/sync orchestration
- webhook forwarding
- merchant-facing setup and recommendation UI

## Reset Decision

Do not scrap the website frontend or backend forecast logic.

Do scrap the current Shopify app as the product baseline.

Treat the Shopify app as a rebuild around a narrow embedded workflow:
1. Home
2. Setup
3. Recommendations

Optional later:
4. Settings

## What We Are Building

The Shopify app should:
- open from Shopify Admin without asking for a manual store link
- read store data from Shopify
- provision/link the store in the backend
- import products, inventory, and historical orders/transactions
- continue syncing through webhooks
- show setup/readiness clearly
- show backend-generated product forecasts and reorder recommendations

## What We Are Not Building In Phase 1

- a separate Shopify-side forecast engine
- a broad support/info app with many pages
- staff/user features unless they are required for a concrete operational need
- cosmetic polish before runtime proof

## Current Main Failures

### Product / UX
- The app feels like an operator console, not a merchant product.
- The first-run path leaks implementation details.
- Manual shop-domain entry is unacceptable in the normal embedded flow.
- Setup is fragmented instead of guided.
- Recommendations are not yet a strong decision surface.

### Architecture
- Shopify data acquisition/orchestration is too route-centric.
- The app/backend lifecycle contract is still too ad hoc.
- Runtime config/env discipline is weak.

### Release
- Install/auth/runtime behavior is not yet validated end to end on a real dev store.
- Webhook continuity, reinstall, and recovery are not yet proven.

## Target Merchant Flow

### Install / Open
1. Merchant installs the app from Shopify.
2. Merchant opens the app from Shopify Admin.
3. The app already knows the store context.
4. No manual store-link or domain entry in the normal path.

### First Run
1. Confirm store connected
2. Import products and inventory
3. Import historical orders/transactions
4. Confirm forecast availability
5. Show recommendations ready, or show blockers clearly

### Steady State
1. Merchant lands on Home
2. Home shows sync freshness, forecast status, and top inventory risk
3. Merchant opens Recommendations to act on the queue

### Failure / Recovery
1. Setup shows exactly which stage failed
2. The app shows retry actions and support guidance
3. No ambiguous “something might have happened” states

## Target Architecture

### Shopify App Responsibilities
- handle install/auth/session/webhooks
- read Shopify Admin API data
- orchestrate initial sync
- forward incremental changes through webhooks
- render setup status and recommendations

### Backend Responsibilities
- own canonical workspace/store model
- own canonical product/inventory/sales/order history after ingestion
- own forecast engine
- own recommendation output used by both website and Shopify

### Ingestion Model

#### Initial bootstrap
- `provisionShop`
- `syncCatalog`
- `syncHistoricalOrders`

#### Incremental sync
- `processWebhookDelta` for:
  - products
  - inventory
  - orders

#### Forecasting
- backend runs the same forecast engine used by the website
- Shopify app only reads resulting forecast/recommendation state

## Information Architecture

### 1. Home
Purpose:
- merchant summary
- setup/sync health
- forecast status
- top risks
- next action

### 2. Setup
Purpose:
- onboarding and recovery
- connection status
- catalog sync status
- orders/history sync status
- forecast readiness
- retry actions

### 3. Recommendations
Purpose:
- action queue
- urgency filters
- product detail/reasoning
- optional acknowledge/review actions

### 4. Settings
Only if needed for merchant-manageable config:
- forecast horizon
- preferences
- support links

### Remove From Primary Navigation
- “How it works”
- generic support/info pages
- any page that mainly explains the prototype

## Phased Rebuild Plan

### Phase 0 — Reset Scope
- Freeze Shopify scope to Home, Setup, Recommendations
- Defer nonessential features
- Reaffirm backend forecast engine as single source of truth

### Phase 1 — Auth / Install Hardening
- Make embedded Shopify Admin entry the only primary path
- Remove manual shop-link dependency from normal merchant flow
- Validate app URL, callbacks, session persistence, and reinstall behavior
- Add request-level logging/instrumentation around auth redirects so context loss is diagnosable

### Phase 2 — Ingestion Architecture Cleanup
- Extract Shopify data acquisition/orchestration out of UI-heavy route code
- Create dedicated server-side sync/orchestration helpers in the Shopify app
- Keep UI routes thin: trigger action, show status, read backend state

### Phase 3 — Setup Flow Rebuild
- Build a canonical setup state machine:
  - linked
  - catalog imported
  - inventory synced
  - orders imported
  - forecast available
  - recommendations ready
- Every step needs machine-readable status, timestamps, error states, and retry support

### Phase 4 — Home Rebuild
- Rebuild Home as the merchant command center
- Show only the highest-signal information:
  - connection
  - sync freshness
  - forecast status
  - top inventory risk
  - next action

### Phase 5 — Recommendations Rebuild
- Use backend recommendation output only
- Present a proper review queue/table + detail pattern
- Show:
  - urgency
  - current stock
  - demand forecast
  - suggested reorder
  - supplier
  - confidence blockers
- Add acknowledge/review actions if supported

### Phase 6 — Validation and Publish Path
- Run real dev-store validation
- Verify install -> setup -> sync -> recommendations flow
- Verify webhooks, uninstall, reinstall, and scope changes
- Fix only launch-critical failures
- Produce review/support material only after runtime proof

## Validation Matrix

### Install / Auth
- fresh install from dev store admin
- open app from Shopify Admin
- expired session recovery
- reinstall after uninstall
- callback URL mismatch detection

### Provisioning
- new store linkage
- existing store re-link/idempotency
- backend unreachable failure handling
- secret mismatch handling

### Initial Sync
- product import
- inventory snapshot import
- order backfill import
- duplicate prevention
- partial failure retry

### Ongoing Sync
- product create/update/delete webhooks
- inventory update webhook
- order create webhook
- verify backend state changes and recommendation freshness

### Forecast / Recommendations
- no history state
- forecast running state
- forecast failed state
- completed forecast with no recommendations
- completed forecast with actionable recommendations
- confirm Shopify UI matches backend output

### Operational
- deployed runtime env is correct
- webhooks register after auth
- logs are sufficient for support/debugging
- health/runbook path is documented

## Recommended Next 2 Sprints

### Sprint 1 — Foundation Reset
- Lock IA and scope
- Rebuild embedded auth entry path
- Rebuild Setup around provision/import/backfill
- Define exact backend contracts Shopify consumes
- Add deterministic error/retry states
- Add auth request instrumentation

### Sprint 2 — Runtime Proof
- Run full dev-store install -> sync -> recommendation journey
- Fix auth/context/runtime failures
- Validate webhook continuity and reinstall
- Capture screenshots and reviewer notes
- Prepare submission/support artifacts only if validation is solid

## High-Risk Unknowns

- Whether the current live auth failure is still code-path-related or mostly deployment/runtime config drift
- Whether current backend ingestion endpoints need a more explicit sync job/status model
- Whether current order-backfill depth is sufficient for forecast quality
- Whether “users” is really required for launch, or should be deferred
- Whether Shopify should become the primary merchant surface for Shopify stores, with the website remaining secondary

## Working Rules For Every Next Step

- Do not add Shopify-side forecast logic
- Do not widen scope before dev-store validation proves the core flow
- Prefer merchant tasks over system diagnostics in the UI
- Fix runtime truth before polish
- Keep this document updated whenever the plan changes

## Immediate Next Action

Start with Phase 1 and Phase 2 together:
- harden embedded auth/install flow
- formalize Shopify sync orchestration

Only after that should we continue rebuilding the Setup and Recommendations surfaces in earnest.
