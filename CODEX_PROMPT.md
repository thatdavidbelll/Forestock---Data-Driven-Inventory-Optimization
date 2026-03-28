# Codex Prompt — Forestock Feature Completions

## Context
You are working on **Forestock**, a multi-tenant SaaS application for retail inventory forecasting. The core product already works: store managers import CSV sales data, the app runs a Holt-Winters forecast, and generates prioritised restocking suggestions.

Your job is to complete the product — fix real gaps, add missing logic, and remove friction from existing workflows. Every task in this prompt comes from `integrations.md`. Read that file as your primary specification.

---

## Read These Files First (in order)

1. `integrations.md` — your primary task specification
2. `forestock-backend/HELP.md` — full architecture, all existing API endpoints, sprint history
3. `forestock-backend/src/main/java/com/forestock/forestock_backend/service/SuggestionEngine.java`
4. `forestock-backend/src/main/java/com/forestock/forestock_backend/service/ForecastingEngine.java`
5. `forestock-backend/src/main/java/com/forestock/forestock_backend/service/ForecastOrchestrator.java`
6. `forestock-backend/src/main/java/com/forestock/forestock_backend/domain/Product.java`
7. `forestock-backend/src/main/java/com/forestock/forestock_backend/domain/OrderSuggestion.java`
8. `forestock-backend/src/main/java/com/forestock/forestock_backend/controller/SuggestionController.java`
9. `forestock-backend/src/main/java/com/forestock/forestock_backend/controller/ProductController.java`
10. `forestock-backend/src/main/resources/db/migration/` — read ALL 10 migrations to understand the full schema before writing new ones

---

## Stack & Conventions

**Backend:** Java 21, Spring Boot 4.0.4, Maven, PostgreSQL 17, Spring Data JPA, Flyway, Redis
**Frontend:** React 19, TypeScript, Vite, TailwindCSS 4, React Router v7, Axios
**Auth:** JWT, roles: ROLE_SUPER_ADMIN / ROLE_ADMIN / ROLE_MANAGER / ROLE_VIEWER
**Multi-tenancy:** `TenantContext.getStoreId()` — every service method and every DB query is scoped to the current store

### Backend patterns (follow exactly)
- Services: `@Slf4j @Service @RequiredArgsConstructor`
- Controllers: `@RestController @RequestMapping @RequiredArgsConstructor @Slf4j`, return `ResponseEntity<ApiResponse<T>>`
- Multi-tenancy: call `TenantContext.getStoreId()` inside service — never trust `storeId` from request params
- DB writes: `@Transactional` on service methods
- Audit: call `auditLogService.log(...)` after every state-changing operation
- Errors: throw domain exceptions (`ResourceNotFoundException`, `ForbiddenException`) — `ApiExceptionHandler` handles them

### Frontend patterns (follow exactly)
- API calls: via the `api` axios instance in `src/lib/api.ts` — never use `fetch` directly
- Auth state: via `useAuth()` hook only
- Styling: TailwindCSS utility classes only — no CSS modules, no inline styles
- Page structure: state → `useEffect` fetch → loading/error early returns → JSX
- New routes: add to `App.tsx` with `<ProtectedRoute>` wrapper matching existing pattern
- New nav items: add to `Layout.tsx` with role guard matching existing pattern

### Flyway migrations
- Next migration is `V11__product_enrichment.sql`
- Never modify V1–V10
- Use `gen_random_uuid()` for UUID primary keys
- All new tables need `store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE`

---

## Implementation Order

Work through `integrations.md` sections **in this order**. Complete each one fully (migration → entity → service → controller → frontend) before moving to the next.

### Step 1 — Section 1: Product Fields
Add `lead_time_days`, `minimum_order_qty`, `unit_cost`, `supplier_name`, `supplier_contact`, `barcode`, `storage_location`, `notes` to the `Product` entity.
- Write `V11__product_enrichment.sql`
- Update `Product.java` entity
- Update `ProductDto.java` (request and response)
- No new endpoints needed — existing create/update endpoints pick up the new fields automatically
- Update `ProductsPage.tsx` create/edit modal with a collapsible "Advanced" section for the new fields
- Add "Supplier" and "Lead Time" columns to the products table (hidden by default, shown via a column toggle)

### Step 2 — Section 2: Suggestion Engine Logic
Update `SuggestionEngine.java` to incorporate lead time and MOQ.
- Add lead time buffer to the quantity calculation: `effectiveTarget = p90Total + (dailyDemand × leadTimeDays)`
- Round suggested qty up to nearest MOQ multiple when MOQ is set
- Adjust urgency to be lead-time-aware: `adjustedDaysOfStock = daysOfStock − leadTimeDays`
- Write `V12__suggestion_enrichment.sql` adding `lead_time_days_at_generation`, `moq_applied`, `estimated_order_value` to `order_suggestions`
- Update `SuggestionEngine.java` to populate these three new fields
- Update `SuggestionDto.java` to expose them plus `supplierName`
- Update `SuggestionsPage.tsx` to show Lead Time, MOQ, Est. Value, Supplier columns plus a footer "Total estimated order value" sum

### Step 3 — Section 3: Store Configuration
Make forecast parameters configurable per store.
- Write `V13__store_config.sql` creating `store_configurations` table with all config fields; seed defaults for all existing stores
- Create `StoreConfiguration.java` entity, `StoreConfigurationRepository.java`, `StoreConfigurationService.java`
- Update `ForecastingEngine.java` to accept `StoreConfiguration` as a parameter instead of using constants
- Update `ForecastOrchestrator.java` to load `StoreConfiguration` and pass it to the engine
- Update `SuggestionEngine.java` to use config urgency thresholds and safety stock multiplier
- Add `GET /api/store/config` and `PUT /api/store/config` to `StoreController.java`
- Add "Forecast & Restocking" settings section to `SettingsPage.tsx`

### Step 4 — Section 5: CSV Import Preview
Add a preview endpoint and redesign the import UI as a two-step flow.
- Extract CSV parsing logic in `SalesIngestionService.java` into a reusable `parseCsvRows(InputStream, int limit)` method
- Add `POST /api/sales/import/preview` endpoint that calls the parser with limit=20 and returns structural info without writing to DB
- Redesign `ImportPage.tsx`: on file selection, call the preview endpoint immediately; show column check, row sample, SKU match summary; "Confirm Import" button only enabled after successful preview

### Step 5 — Section 8: Suggestion Bulk Actions & Tracking
- Write `V14__suggestion_tracking.sql` adding `acknowledged_reason`, `quantity_ordered`, `expected_delivery`, `order_reference` to `order_suggestions`
- Update `PATCH /api/suggestions/{id}/acknowledge` to accept the new fields
- Add `POST /api/suggestions/acknowledge-bulk` endpoint
- Update `SuggestionsPage.tsx`: add checkbox column, bulk action bar at bottom, updated single-acknowledge popover with reason/qty/date/ref fields, updated acknowledged badge showing reason and order reference

### Step 6 — Section 10: User Invite Workflow
Replace the ad-hoc user creation with a proper invite flow.
- Write `V15__user_invites.sql`
- Create `UserInvite.java` entity, `UserInviteRepository.java`, `UserInviteService.java`
- Add `POST /api/users/invite`, `GET /api/users/invites`, `DELETE /api/users/invites/{id}` to `UserController.java`
- Add `GET /api/auth/invite/verify` and `POST /api/auth/invite/accept` to `AuthController.java`
- Update `UsersPage.tsx`: replace "Add User" with "Invite Team Member" modal, add "Pending Invites" section
- Create new public page `AcceptInvitePage.tsx` at `/accept-invite` route

### Step 7 — Section 7: Dashboard Charts
- Add `getAlertTrend`, `getTopCritical`, `getSalesVelocityTrend`, `getDataQualityWarnings` to `DashboardService.java`
- Add corresponding endpoints to `DashboardController.java`
- Install `recharts` in the frontend (`npm install recharts`)
- Redesign `DashboardPage.tsx`: 4 KPI cards (including new Forecast Accuracy placeholder), Top 5 Critical widget, Alert History bar chart, Sales Volume area chart, Data Quality warnings strip

### Step 8 — Section 4: Forecast Accuracy
- Write `V16__forecast_accuracy.sql`
- Create `ForecastAccuracyService.java` with MAPE computation
- Add accuracy computation call to `DailyForecastJob.java`
- Surface accuracy score in dashboard KPI card (wired up from Step 7 placeholder)
- Update `GET /api/forecast/runs/{id}` to include `mape`, `durationSeconds`, `productsWithInsufficientData`

### Step 9 — Section 6: Inventory Adjustments
- Write `V17__inventory_enrichment.sql` adding `adjustment_reason`, `adjustment_note`, `adjusted_by` to `inventory`
- Update `PUT /api/inventory/{productId}` to accept and persist these fields
- Create `InventoryHistoryModal.tsx` with a recharts line chart
- Add "History" icon button and "Days of Stock" column to `InventoryPage.tsx`
- Update stock update form to include Reason dropdown and Note input

### Step 10 — Section 11: Slow Movers
- Add `getSlowMovers` to `InventoryService.java` and `GET /api/inventory/slow-movers` endpoint
- Add slow mover counts to `DashboardService.java` KPI response
- Create `SlowMoversPage.tsx` at `/slow-movers` with inactive days filter, table, estimated value footer
- Add nav item to `Layout.tsx`

### Step 11 — Section 9: Product Bulk Import & Search
- Create `ProductBulkImportService.java` modelled on `SalesIngestionService`
- Add `POST /api/products/import` and `GET /api/products/export/csv` to `ProductController.java`
- Add `?search=` param to `GET /api/products`
- Update `ProductsPage.tsx`: search input, Import CSV modal, Export CSV button, sortable column headers

### Step 12 — Section 12: Report Expansions
- Add inventory valuation, sales performance, and slow movers report methods to `ReportService.java`
- Add new report endpoints to a `ReportController.java`
- Fix hardcoded `dd.MM.yyyy` locale in `ReportService.java`
- Expand export options on `SuggestionsPage.tsx` with the three new report types

### Step 13 — Section 13: Audit Log Improvements
- Update `AuditLogService.java` with structured before/after diff helper
- Update callers (inventory, product, user services) to use the new helper
- Add `?actor=` search param and `GET /api/audit-logs/export/csv` to `AuditLogController.java`
- Update `AuditLogPage.tsx` with actor search input, smart diff rendering, export button

### Step 14 — Section 14: Settings Page
- Add `AppUser.lastLoginAt` field (`V18__last_login.sql`), populate on login in `AuthController.java`
- Restructure `SettingsPage.tsx` into 4 clearly labelled sections: Store Profile, Forecast & Restocking, Account, Data & Privacy

---

## For Each Step, Deliver

1. **Flyway migration** (if schema changes) — show full SQL
2. **Backend** — entity → repository → service → controller → DTOs, in that order
3. **Frontend** — updated or new React components
4. **List any new environment variables** with descriptions (for Steps 6, 8 only — other steps don't need them)

---

## Rules

- Never modify V1–V10 migrations
- Never skip `TenantContext.getStoreId()` scoping on any new query
- Never accept `storeId` as a trusted parameter from the request body or URL — always read from `TenantContext`
- Do not add features beyond what `integrations.md` specifies for each section
- Do not refactor surrounding code that isn't part of the current step
- Audit log every state-changing operation using the existing `AuditLogService`

## Where to Start

Begin with **Step 1 (Section 1 — Product Fields)**. State every file you will create or modify before writing any code.
