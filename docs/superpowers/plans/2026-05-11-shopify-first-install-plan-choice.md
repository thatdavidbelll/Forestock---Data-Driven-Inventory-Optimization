# Shopify First-Install Plan Choice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require new Shopify merchants to explicitly choose `Free` or `Paid` before onboarding/setup starts, while keeping existing merchants unaffected.

**Architecture:** Persist a new `planChoiceConfirmed` flag on the backend `ShopifyConnection`, expose it through plan/app-home responses, and gate all embedded `/app/*` routes at the parent loader until the chooser route confirms either a free-tier choice or an actually-synced paid subscription.

**Tech Stack:** Spring Boot, Flyway, React Router 7, Shopify embedded app, Vitest, TypeScript.

---

### Task 1: Add backend persistence for explicit plan choice

**Files:**
- Create: `forestock-backend/src/main/resources/db/migration/V2__add_plan_choice_confirmed_to_shopify_connections.sql`
- Modify: `forestock-backend/src/main/java/com/forestock/forestock_backend/domain/ShopifyConnection.java`
- Modify: `forestock-backend/src/main/java/com/forestock/forestock_backend/service/ShopifyProvisioningService.java`

- [ ] **Step 1: Write the failing backend tests for the new flag**

Add expectations in:
- `forestock-backend/src/test/java/com/forestock/forestock_backend/service/StorePlanServiceTest.java`
- `forestock-backend/src/test/java/com/forestock/forestock_backend/service/ShopifyAppHomeServiceTest.java`

Cover:
- a newly provisioned Shopify connection starts with `planChoiceConfirmed = false`
- existing snapshot builders can expose `planChoiceConfirmed`

- [ ] **Step 2: Run the focused backend tests to watch them fail**

Run:
```bash
cd forestock-backend
./mvnw -Dtest=StorePlanServiceTest,ShopifyAppHomeServiceTest test
```

- [ ] **Step 3: Add the migration and entity field**

Use a migration that backfills old rows to `true` but defaults future rows to `false`.

- [ ] **Step 4: Update provisioning so new installs are unconfirmed and reinstalls preserve state**

Set the builder default for new `ShopifyConnection` rows to `false` and avoid overwriting the flag on existing connections.

- [ ] **Step 5: Re-run the focused backend tests**

Run:
```bash
cd forestock-backend
./mvnw -Dtest=StorePlanServiceTest,ShopifyAppHomeServiceTest test
```

### Task 2: Extend plan services and API responses

**Files:**
- Modify: `forestock-backend/src/main/java/com/forestock/forestock_backend/service/StorePlanService.java`
- Modify: `forestock-backend/src/main/java/com/forestock/forestock_backend/service/ShopifyAppHomeService.java`
- Modify: `forestock-backend/src/main/java/com/forestock/forestock_backend/controller/ShopifyAppHomeController.java`
- Modify: `forestock-backend/src/test/java/com/forestock/forestock_backend/controller/ShopifyAppHomeControllerTest.java`
- Modify: `forestock-backend/src/test/java/com/forestock/forestock_backend/service/StorePlanServiceTest.java`
- Modify: `forestock-backend/src/test/java/com/forestock/forestock_backend/service/ShopifyAppHomeServiceTest.java`

- [ ] **Step 1: Write failing tests for explicit confirmation behavior**

Add tests for:
- `syncPlanForShop(..., FREE)` keeps `planChoiceConfirmed` unchanged
- `syncPlanForShop(..., PAID)` marks `planChoiceConfirmed = true`
- a new `confirmFreePlanChoiceForShop(shopDomain)` service method marks the connection confirmed
- controller responses include `planChoiceConfirmed`

- [ ] **Step 2: Run the focused backend tests to watch them fail**

Run:
```bash
cd forestock-backend
./mvnw -Dtest=StorePlanServiceTest,ShopifyAppHomeServiceTest,ShopifyAppHomeControllerTest test
```

- [ ] **Step 3: Implement the service and controller changes**

Add:
- `planChoiceConfirmed` to `PlanSnapshot`
- service support for explicit free choice confirmation
- a new Shopify app endpoint for free-plan confirmation
- `planChoiceConfirmed` exposure in app-home payloads

- [ ] **Step 4: Re-run the focused backend tests**

Run:
```bash
cd forestock-backend
./mvnw -Dtest=StorePlanServiceTest,ShopifyAppHomeServiceTest,ShopifyAppHomeControllerTest test
```

### Task 3: Add Shopify app helpers and chooser gating tests

**Files:**
- Modify: `shopify-app/app/forestock.server.ts`
- Modify: `shopify-app/app/billing.server.ts`
- Modify: `shopify-app/app/billing.server.test.ts`
- Create: `shopify-app/app/plan-choice.server.ts`
- Create: `shopify-app/app/plan-choice.server.test.ts`

- [ ] **Step 1: Write failing Shopify app tests**

Cover:
- plan sync responses now carry `planChoiceConfirmed`
- the parent gate redirects to `/app/plan` when confirmation is false
- `/app/plan` redirects back to `/app` once confirmation is true

- [ ] **Step 2: Run the focused Shopify app tests to watch them fail**

Run:
```bash
cd shopify-app
npm run test -- app/billing.server.test.ts app/plan-choice.server.test.ts
```

- [ ] **Step 3: Implement the TypeScript helpers**

Add:
- `confirmForestockFreePlanChoice(shopDomain)` in `forestock.server.ts`
- a focused route-gating helper in `plan-choice.server.ts`
- updated billing/plan types including `planChoiceConfirmed`

- [ ] **Step 4: Re-run the focused Shopify app tests**

Run:
```bash
cd shopify-app
npm run test -- app/billing.server.test.ts app/plan-choice.server.test.ts
```

### Task 4: Add the `/app/plan` route and root loader gate

**Files:**
- Modify: `shopify-app/app/routes/app.tsx`
- Create: `shopify-app/app/routes/app.plan.tsx`
- Modify: `shopify-app/app/routes/app.billing.tsx`
- Modify: `shopify-app/app/routes/app.onboarding.tsx`
- Modify: `shopify-app/app/routes/app.settings.tsx`
- Modify: `shopify-app/app/routes/app._index.tsx` only if needed for consistency

- [ ] **Step 1: Write failing tests or extend helper tests for route decisions**

Ensure the new route rules are covered before editing route modules:
- new installs are redirected to `/app/plan`
- confirmed merchants are not gated
- confirmed merchants hitting `/app/plan` are bounced to `/app`

- [ ] **Step 2: Run the focused Shopify app tests to verify red**

Run:
```bash
cd shopify-app
npm run test -- app/billing.server.test.ts app/plan-choice.server.test.ts
```

- [ ] **Step 3: Implement the parent loader and chooser route**

Make the root app loader:
- load billing context
- load overview/recovery context for `planChoiceConfirmed`
- hide nav tabs while choice is still required
- redirect into or out of `/app/plan` appropriately

Make `app.plan.tsx`:
- show Free/Paid cards
- POST free-choice confirmation
- link paid choice to Shopify billing
- display sync warnings when needed

- [ ] **Step 4: Re-run the focused Shopify app tests**

Run:
```bash
cd shopify-app
npm run test -- app/billing.server.test.ts app/plan-choice.server.test.ts
```

### Task 5: Verify end-to-end targeted suites

**Files:**
- Verify only

- [ ] **Step 1: Run the backend verification suite**

Run:
```bash
cd forestock-backend
./mvnw -Dtest=StorePlanServiceTest,ShopifyAppHomeControllerTest,ShopifyAppHomeServiceTest test
```

- [ ] **Step 2: Run the Shopify app verification suite**

Run:
```bash
cd shopify-app
npm run test -- app/billing.server.test.ts app/plan-choice.server.test.ts app/setup-state.test.ts
npm run typecheck
npm run lint -- --no-cache
```

- [ ] **Step 3: Sanity-check the worktree diff**

Run:
```bash
git diff --check
git status --short
```
