# Forestock — Feature Completions Roadmap

> This document defines exactly what needs to be built to take Forestock from "solid foundation" to "production-ready product."
> Every item is derived from a gap in the existing codebase — no new product areas, only completing what's already here.
>
> **Stack:** Java 21 + Spring Boot 4, React 19 + TypeScript + TailwindCSS 4, PostgreSQL 17, Redis, AWS S3/SNS.
> **Conventions:** All services `@Slf4j @Service @RequiredArgsConstructor`. All controllers return `ResponseEntity<ApiResponse<T>>`.
> Multi-tenancy via `TenantContext.getStoreId()`. All DB queries scoped by `store_id`.

---

## Table of Contents

1. [Product Fields — Lead Time, MOQ, Cost, Supplier](#1-product-fields--lead-time-moq-cost-supplier)
2. [Suggestion Engine — Lead Time & MOQ Logic](#2-suggestion-engine--lead-time--moq-logic)
3. [Store Configuration — Make Hardcoded Values Configurable](#3-store-configuration--make-hardcoded-values-configurable)
4. [Forecast Accuracy Tracking](#4-forecast-accuracy-tracking)
5. [CSV Import — Preview & Smarter Error Handling](#5-csv-import--preview--smarter-error-handling)
6. [Inventory — Adjustment Reasons & Stock History Chart](#6-inventory--adjustment-reasons--stock-history-chart)
7. [Dashboard — Charts & Actionable Metrics](#7-dashboard--charts--actionable-metrics)
8. [Suggestions — Bulk Actions & Post-Acknowledgement Tracking](#8-suggestions--bulk-actions--post-acknowledgement-tracking)
9. [Products — Bulk Import & Search](#9-products--bulk-import--search)
10. [User Invite Workflow](#10-user-invite-workflow)
11. [Slow-Moving & Dead Stock Detection](#11-slow-moving--dead-stock-detection)
12. [Report Expansions](#12-report-expansions)
13. [Audit Log — Richer Detail & Export](#13-audit-log--richer-detail--export)
14. [Settings Page — Store Configuration UI](#14-settings-page--store-configuration-ui)

---

## 1. Product Fields — Lead Time, MOQ, Cost, Supplier

### The Problem
The `Product` entity is missing four fields the suggestion engine desperately needs:
- **Lead time:** If it takes 7 days to receive an order, you need to reorder 7 days earlier than the algorithm currently suggests. Right now the engine ignores this entirely.
- **Minimum order quantity (MOQ):** The algorithm might suggest ordering 150 units, but if the vendor ships in cases of 200, the suggestion is unfulfillable as-is. No warning exists.
- **Unit cost:** Without cost per unit, the app cannot show total order value, cannot prioritise by financial impact, and cannot compute inventory valuation.
- **Supplier name:** Managers need to know *who to call* when they see a critical suggestion. Currently there is nowhere to store this.

### Backend Changes

**Flyway migration `V11__product_enrichment.sql`:**
```sql
ALTER TABLE products
    ADD COLUMN lead_time_days       INTEGER,
    ADD COLUMN minimum_order_qty    NUMERIC(12, 2),
    ADD COLUMN unit_cost            NUMERIC(12, 4),
    ADD COLUMN supplier_name        VARCHAR(255),
    ADD COLUMN supplier_contact     VARCHAR(255),
    ADD COLUMN barcode              VARCHAR(100),
    ADD COLUMN storage_location     VARCHAR(100),
    ADD COLUMN notes                TEXT;
```

**`Product.java` entity** — add the corresponding JPA fields (nullable, no defaults except lead_time_days default null).

**`ProductDto.java` (request/response)** — add all new fields. All nullable.

**`ProductController.java`** — no new endpoints needed; the existing `POST /api/products` and `PUT /api/products/{id}` should accept and return the new fields automatically once the DTO and entity are updated.

**`ProductRepository.java`** — no changes needed.

### Frontend Changes

**`ProductsPage.tsx`** — Update the product create/edit modal to include new fields in a collapsible "Advanced" section:
- **Lead Time (days):** number input, min=0, max=365, placeholder="e.g. 7"
- **Minimum Order Qty:** number input, min=0, placeholder="e.g. 200"
- **Unit Cost:** decimal input, placeholder="e.g. 4.99", prefixed with currency symbol
- **Supplier Name:** text input, placeholder="e.g. Metro Cash & Carry"
- **Supplier Contact:** text input, placeholder="email or phone"
- **Storage Location:** text input, placeholder="e.g. A-12"
- **Notes:** textarea, optional

**Table view** — add a "Supplier" column (show supplier_name, truncated) and a "Lead Time" column next to the existing columns. Both hidden by default; show via a "Columns" toggle button.

---

## 2. Suggestion Engine — Lead Time & MOQ Logic

### The Problem
`SuggestionEngine.java` currently computes:
```
suggestedQty = max(0, p90_14days − currentStock)
urgency = based on currentStock / (p50_14days / 14) = daysOfStock
```

This ignores two critical real-world constraints:
1. **Lead time:** If a product takes 7 days to arrive, the effective "buffer needed" is `p90_14days + (leadTimeDays / 14 * p50_14days)`. Without this, critical alerts fire too late.
2. **MOQ:** If `suggestedQty = 150` but `minimumOrderQty = 200`, the correct suggestion is 200 (round up to nearest MOQ multiple). Currently the suggestion is just 150, which creates a bad order.

### Backend Changes

**`SuggestionEngine.java`** — update `buildSuggestion()` method:

```java
// Step 1: Adjust for lead time
// leadTimeDays comes from product entity; null = 0
int leadTime = product.getLeadTimeDays() != null ? product.getLeadTimeDays() : 0;
double dailyDemand = p50Total / 14.0;
double leadTimeBuffer = dailyDemand * leadTime;
double effectiveTarget = p90Total + leadTimeBuffer;

// Step 2: Compute suggested qty
double rawQty = Math.max(0, effectiveTarget - currentStock);

// Step 3: Round up to MOQ multiple
BigDecimal moq = product.getMinimumOrderQty();
double finalQty;
if (moq != null && moq.doubleValue() > 0 && rawQty > 0) {
    double moqVal = moq.doubleValue();
    finalQty = Math.ceil(rawQty / moqVal) * moqVal;
} else {
    finalQty = Math.ceil(rawQty);
}

// Step 4: Urgency uses lead-time-adjusted days of stock
// If lead time is 7 days, a product with 8 days of stock is effectively CRITICAL
double adjustedDaysOfStock = daysOfStock - leadTime;
// Map adjustedDaysOfStock to urgency thresholds (same as now but on adjusted value)
```

**`OrderSuggestion.java` entity** — add two new fields (migration `V12__suggestion_enrichment.sql`):
```sql
ALTER TABLE order_suggestions
    ADD COLUMN lead_time_days_at_generation INTEGER,
    ADD COLUMN moq_applied                  NUMERIC(12, 2),
    ADD COLUMN estimated_order_value        NUMERIC(14, 2);
```
`estimated_order_value = finalQty * product.unitCost` (null if no unit cost set).

**`SuggestionEngine.java`** — populate these three fields when building each suggestion.

**`SuggestionDto.java`** — expose `leadTimeDaysAtGeneration`, `moqApplied`, `estimatedOrderValue`, `supplierName` (denormalised from product at generation time).

### Frontend Changes

**`SuggestionsPage.tsx`** — update suggestion row display:
- Add "Lead Time" column: show `{leadTimeDaysAtGeneration}d` badge, greyed out if null
- Add "MOQ" column: show `{moqApplied}` if it caused rounding, with a tooltip "Rounded up from X to meet vendor minimum"
- Add "Est. Value" column: show `£{estimatedOrderValue}` if available
- Add "Supplier" column: show supplier name from the suggestion (greyed out if not set)
- Show a footer row on the suggestions table: **"Total estimated order value: £X,XXX"** (sum of visible rows)

---

## 3. Store Configuration — Make Hardcoded Values Configurable

### The Problem
The following values are hardcoded in Java and cannot be changed per store:

| Value | File | Hardcoded As |
|-------|------|-------------|
| Minimum history days for forecast | `ForecastingEngine.java` | 30 |
| Seasonality period | `ForecastingEngine.java` | 7 (weekly) |
| Safety stock multiplier (p90 buffer) | `SuggestionEngine.java` | 1.20 |
| Forecast horizon | `ForecastOrchestrator.java` | 14 days |
| Lookback window | `ForecastOrchestrator.java` | 365 days |
| CRITICAL urgency threshold | `SuggestionEngine.java` | < 2 days |
| HIGH urgency threshold | `SuggestionEngine.java` | 2–5 days |
| MEDIUM urgency threshold | `SuggestionEngine.java` | 5–10 days |

A grocery store with 2-day supplier lead times has different urgency needs than a hardware store with 14-day lead times. These must be configurable.

### Backend Changes

**Flyway migration `V12__store_config.sql`:**
```sql
CREATE TABLE store_configurations (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id                    UUID NOT NULL UNIQUE REFERENCES stores(id) ON DELETE CASCADE,
    timezone                    VARCHAR(50) NOT NULL DEFAULT 'UTC',
    currency_symbol             VARCHAR(5) NOT NULL DEFAULT '£',
    forecast_horizon_days       INTEGER NOT NULL DEFAULT 14,
    lookback_days               INTEGER NOT NULL DEFAULT 365,
    min_history_days            INTEGER NOT NULL DEFAULT 30,
    seasonality_period          INTEGER NOT NULL DEFAULT 7,
    safety_stock_multiplier     NUMERIC(4, 2) NOT NULL DEFAULT 1.20,
    urgency_critical_days       INTEGER NOT NULL DEFAULT 2,
    urgency_high_days           INTEGER NOT NULL DEFAULT 5,
    urgency_medium_days         INTEGER NOT NULL DEFAULT 10,
    auto_forecast_on_import     BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at                  TIMESTAMP NOT NULL DEFAULT now()
);

-- Seed default config for all existing stores
INSERT INTO store_configurations (store_id)
SELECT id FROM stores;
```

**`StoreConfiguration.java` entity** — JPA entity with the above fields.

**`StoreConfigurationRepository.java`** — `findByStoreId(UUID storeId)`.

**`StoreConfigurationService.java`**:
- `getConfig(UUID storeId)` — returns config, creating default if missing
- `updateConfig(UUID storeId, UpdateStoreConfigRequest request)` — validates bounds, saves, audits

**Update callers:**
- `ForecastingEngine.java` — accept `StoreConfiguration` as a parameter instead of using constants
- `ForecastOrchestrator.java` — load `StoreConfiguration` before calling engine, pass it through
- `SuggestionEngine.java` — accept `StoreConfiguration` as a parameter for urgency thresholds and safety stock multiplier

**New endpoints in `StoreController.java`:**
- `GET /api/store/config` → returns current store config (ROLE_ADMIN, ROLE_MANAGER)
- `PUT /api/store/config` → update config (ROLE_ADMIN only)

**Validation on `UpdateStoreConfigRequest`:**
- `forecastHorizonDays`: 7–90
- `lookbackDays`: 90–730
- `minHistoryDays`: 14–90
- `safetyStockMultiplier`: 1.00–2.00
- `urgencyCriticalDays` < `urgencyHighDays` < `urgencyMediumDays`

### Frontend Changes

**`SettingsPage.tsx`** — add a "Forecast & Restocking" section (ROLE_ADMIN only) with form fields for each config value:
- Forecast horizon: slider 7–90 days
- Safety stock buffer: slider 100%–200% (displayed as %, stored as 1.00–2.00)
- Urgency thresholds: three number inputs (Critical < X days, High < Y days, Medium < Z days) with live validation that they're in ascending order
- Auto-forecast on import: toggle (already exists as a feature, now configurable)
- Timezone: dropdown of common timezones
- Currency symbol: text input (max 5 chars)

---

## 4. Forecast Accuracy Tracking

### The Problem
There is zero feedback loop. The algorithm runs, produces suggestions, but nobody knows if it was right. After 2 weeks, actual sales happened — but the app never compares predicted vs actual.

Without accuracy tracking:
- Can't tell if Holt-Winters is working well for a particular store
- Can't detect when data quality degrades
- Can't show users evidence that the product is valuable

### Backend Changes

**Flyway migration `V13__forecast_accuracy.sql`:**
```sql
ALTER TABLE forecast_runs
    ADD COLUMN products_with_insufficient_data INTEGER,
    ADD COLUMN duration_seconds                INTEGER,
    ADD COLUMN mape                            NUMERIC(6, 2),   -- Mean Absolute % Error
    ADD COLUMN rmse                            NUMERIC(10, 4);  -- Root Mean Sq Error

CREATE TABLE forecast_accuracy_results (
    id                  BIGSERIAL PRIMARY KEY,
    store_id            UUID NOT NULL,
    forecast_run_id     UUID NOT NULL REFERENCES forecast_runs(id) ON DELETE CASCADE,
    product_id          UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    evaluation_date     DATE NOT NULL,          -- the date the evaluation was run
    forecast_period_start DATE NOT NULL,
    forecast_period_end   DATE NOT NULL,
    predicted_total     NUMERIC(10, 2) NOT NULL,
    actual_total        NUMERIC(10, 2),         -- null until period ends and sales data arrives
    mape                NUMERIC(6, 2),          -- absolute % error for this product
    evaluated_at        TIMESTAMP
);

CREATE INDEX idx_accuracy_store_run ON forecast_accuracy_results(store_id, forecast_run_id);
CREATE INDEX idx_accuracy_product ON forecast_accuracy_results(store_id, product_id);
```

**`ForecastAccuracyService.java`** (new service):
- `evaluateCompletedForecasts(UUID storeId)` — called by a scheduled job. Finds forecast runs where `finishedAt < now() - horizonDays` (the forecast horizon has passed, so actuals exist). Computes MAPE per product by comparing `p50` forecast against real `SalesTransaction` totals in that window.
- `computeStoreLevelMape(UUID storeId)` — averages product-level MAPEs, updates `forecast_runs.mape`
- `getDashboardAccuracy(UUID storeId)` — returns last 30 days rolling accuracy %

**`DailyForecastJob.java`** — add a call to `forecastAccuracyService.evaluateCompletedForecasts(storeId)` after the main forecast run.

**`ForecastOrchestrator.java`** — record `durationSeconds` and `productsWithInsufficientData` on the `ForecastRun` entity after completion. These are already computable; just not persisted.

**`DashboardService.java`** — add `getAccuracyScore(UUID storeId)` to the dashboard response. Return: `{ lastRunMape: 8.4, trend: "improving", evaluatedForecasts: 5 }`.

**`ForecastController.java`** — update `GET /api/forecast/runs/{id}` response to include `mape`, `rmse`, `durationSeconds`, `productsWithInsufficientData`.

### Frontend Changes

**`DashboardPage.tsx`** — add a "Forecast Accuracy" KPI card:
- Shows "Last forecast: 91.6% accurate" (100 - MAPE)
- Subtitle: "Based on X forecasts evaluated"
- Shows "—" with tooltip "Accuracy calculated after the forecast window closes" when no evaluations exist yet

**`DashboardPage.tsx`** — on the forecast runs section, show `durationSeconds` and `productsWithInsufficientData` next to the existing status badge.

---

## 5. CSV Import — Preview & Smarter Error Handling

### The Problem
The import workflow is currently blind:
- User uploads file → server processes it → they see results after the fact
- A single misconfigured column header means the entire file is rejected with a confusing error
- There's no preview of what will be imported before committing
- Errors list shows which rows failed but not what the correct format should be

### Backend Changes

**New endpoint in `SalesController.java`:**
`POST /api/sales/import/preview` (multipart, same auth as import):
- Reads the first 20 rows of the CSV (no DB writes)
- Returns:
  - `detectedColumns`: the actual headers found
  - `expectedColumns`: `["sku", "sale_date", "quantity_sold"]`
  - `columnMatch`: true/false
  - `sample`: first 10 rows parsed (or first 10 error rows if parsing fails)
  - `totalRowsInFile`: count
  - `existingSkuMatches`: how many SKUs in the file already exist in the store's product catalog
  - `newSkus`: list of SKUs not in the catalog
  - `dateFormatDetected`: e.g. `"yyyy-MM-dd"`
  - `errors`: any structural errors (wrong delimiter, BOM, encoding issues)

**`SalesIngestionService.java`** — extract the parsing/validation logic into a separate `parseCsvRows(InputStream, int limit)` method that both the preview and import endpoints can call. The preview calls it with `limit=20`, the import calls it with `limit=MAX_CSV_ROWS`.

### Frontend Changes

**`ImportPage.tsx`** — redesign the import flow as a two-step process:

**Step 1 — Upload & Preview:**
- Drag-drop zone (same as now)
- On file selection (before any button click), immediately call `/api/sales/import/preview`
- Show a preview panel:
  - Green/red indicator: "Columns match ✓" or "Column mismatch: found 'quantity', expected 'quantity_sold'"
  - Table showing first 10 rows of parsed data
  - Summary: "1,247 rows detected — 42 SKUs match existing products, 3 SKUs are new (will be skipped)"
  - Warning badges for any structural issues
- "Overwrite existing records" toggle (same as now)
- Disabled "Confirm Import" button while preview is loading

**Step 2 — Confirm:**
- "Confirm Import" button becomes active once preview shows no structural errors
- Existing import progress and result display (same as now)

**Error display improvements:**
- Errors are grouped by error type (not just line numbers): "3 rows with invalid date format on lines 12, 45, 201 — expected yyyy-MM-dd"
- Show a downloadable "error report" CSV with only the failed rows so the user can fix and re-upload just those

---

## 6. Inventory — Adjustment Reasons & Stock History Chart

### The Problem
When a manager manually updates stock in `PUT /api/inventory/{productId}`, there is no record of *why*. Was it a delivery? A physical count? Shrinkage? This matters for audit, for accuracy, and for detecting data quality issues. Also, the inventory history page exists in the backend but the UI doesn't show it as a chart — just raw data.

### Backend Changes

**Flyway migration `V14__inventory_enrichment.sql`:**
```sql
ALTER TABLE inventory
    ADD COLUMN adjustment_reason    VARCHAR(50),
    ADD COLUMN adjustment_note      VARCHAR(255),
    ADD COLUMN adjusted_by          VARCHAR(100);

-- adjustment_reason values: MANUAL, DELIVERY_RECEIVED, PHYSICAL_COUNT, DAMAGE, SHRINKAGE, RETURN
```

**`InventoryController.java`** — update `PUT /api/inventory/{productId}` request to accept:
```json
{
  "quantity": 150,
  "adjustmentReason": "DELIVERY_RECEIVED",
  "adjustmentNote": "Received PO #4521 from Metro"
}
```

**`InventoryService.java`** — populate `adjustmentReason`, `adjustmentNote`, `adjustedBy` (from JWT username via `SecurityContextHolder`) on every new `Inventory` snapshot.

**`AuditLogService.java`** — include `adjustmentReason` and new quantity in the audit detail JSON for stock updates.

**`InventoryController.java`** — `GET /api/inventory/{productId}/history` already exists. Ensure it returns `adjustmentReason`, `adjustmentNote`, `adjustedBy` in the response DTO.

### Frontend Changes

**`InventoryPage.tsx`** — add to the inline stock update form:
- "Reason" dropdown: Manual Update / Delivery Received / Physical Count / Damage/Write-off / Shrinkage / Customer Return
- "Note" text input (optional, placeholder: "e.g. PO #4521 received")

**New `InventoryHistoryModal.tsx`** — clicking a product's stock value opens a modal showing:
- A line chart (use a lightweight chart library — recharts is already likely available or can be added) showing stock level over time from `GET /api/inventory/{productId}/history`
- A table below the chart: date | quantity | reason | note | who
- Empty state if only 1 data point ("Update stock to start tracking history")

**`InventoryPage.tsx`** — add a "📈 History" icon button on each row that opens the above modal.

Also add to the main inventory table:
- A "Days of Stock" column (compute client-side: `currentStock / dailyDemand` — dailyDemand can come from a new field on the inventory endpoint: expose `p50Daily` from the latest suggestion if one exists for that product)

---

## 7. Dashboard — Charts & Actionable Metrics

### The Problem
The dashboard currently has 4 KPI cards and a forecast trigger button. It tells you counts but not trends, and it doesn't surface the most important information a manager needs to start their day.

### Backend Changes

**`DashboardService.java`** — add these new methods:

`getAlertTrend(UUID storeId)` — returns the count of CRITICAL + HIGH suggestions per forecast run for the last 10 runs:
```json
[
  { "date": "2026-03-21", "critical": 3, "high": 8 },
  { "date": "2026-03-22", "critical": 5, "high": 6 },
  ...
]
```

`getTopCritical(UUID storeId)` — returns the top 5 products by urgency with product name, sku, daysOfStock, suggestedQty, estimatedOrderValue (if unit cost exists).

`getSalesVelocityTrend(UUID storeId)` — returns total units sold per day for the last 30 days, summed across all products:
```json
[
  { "date": "2026-02-26", "totalUnitsSold": 412 },
  ...
]
```

`getDataQualityWarnings(UUID storeId)` — returns a list of warnings:
- Products with no sales data in the last 30 days
- Products with reorder point not set
- Products with no lead time configured
- Forecast overdue (last successful run > 2 days ago)

**`DashboardController.java`** — new endpoints:
- `GET /api/dashboard/alert-trend` → for the chart
- `GET /api/dashboard/top-critical` → for the "action now" widget
- `GET /api/dashboard/sales-trend` → for the sales chart
- `GET /api/dashboard/data-quality` → for warnings

### Frontend Changes

**`DashboardPage.tsx`** — full redesign of layout:

**Row 1 — KPI Cards (same as now, improved):**
- Active Products (same)
- Critical Alerts (same, with delta: "+2 since last forecast")
- Forecast Accuracy (from Section 4): "91.6% accurate"
- Last Forecast (same)

**Row 2 — Action Required widget:**
- "Top 5 products needing attention" — compact table with product name, urgency badge, days of stock, suggested qty, supplier. Clicking a row links to `/suggestions?sku=X`.

**Row 3 — Two charts side-by-side:**
- Left: "Alert History" — bar chart (recharts `BarChart`) showing CRITICAL + HIGH counts per forecast run over the last 10 runs. Helps managers see if the situation is improving or worsening.
- Right: "Sales Volume (Last 30 Days)" — area chart (`AreaChart`) showing total units sold per day. Helps spot slow periods or demand spikes.

**Row 4 — Data Quality Warnings:**
- Yellow warning strip (collapsible) showing items from `GET /api/dashboard/data-quality`. Examples: "12 products have no lead time set — suggestions may be inaccurate", "Forecast has not run in 3 days". Each warning has a direct link to fix it.

**Install recharts:** `npm install recharts` — lightweight, composable, no heavy dependencies.

---

## 8. Suggestions — Bulk Actions & Post-Acknowledgement Tracking

### The Problem
- Acknowledging 50 suggestions one-by-one takes 5+ minutes. There is no bulk acknowledge.
- When a manager acknowledges a suggestion, there is no way to record *what they actually did* (ordered, deferred, decided not to order). The suggestion just shows "Acknowledged" with no context.
- After a suggestion is acknowledged, there is no way to track whether the order actually arrived.

### Backend Changes

**Flyway migration `V15__suggestion_tracking.sql`:**
```sql
ALTER TABLE order_suggestions
    ADD COLUMN acknowledged_reason  VARCHAR(50),  -- ORDERED, DEFERRED, NOT_NEEDED, OUT_OF_BUDGET
    ADD COLUMN quantity_ordered     NUMERIC(12, 2),
    ADD COLUMN expected_delivery    DATE,
    ADD COLUMN order_reference      VARCHAR(100);  -- PO number, invoice number, etc.
```

**`SuggestionController.java`** — update `PATCH /api/suggestions/{id}/acknowledge` request body:
```json
{
  "acknowledgedReason": "ORDERED",
  "quantityOrdered": 200,
  "expectedDelivery": "2026-04-04",
  "orderReference": "PO-4521"
}
```
All new fields are optional. `acknowledgedReason` defaults to `ORDERED` if not provided.

**New bulk endpoint in `SuggestionController.java`:**
`POST /api/suggestions/acknowledge-bulk` (ROLE_ADMIN, ROLE_MANAGER):
```json
{
  "suggestionIds": ["uuid1", "uuid2", ...],
  "acknowledgedReason": "ORDERED",
  "orderReference": "PO-4521"
}
```
Process all IDs that belong to the current store (tenant-scoped — silently skip any IDs not belonging to the store). Return count of successfully acknowledged.

**New filter on `GET /api/suggestions`:**
Add query param `?acknowledgedReason=ORDERED` — allows filtering by what was done.

### Frontend Changes

**`SuggestionsPage.tsx`** — add bulk selection:
- Checkbox column on the left of each suggestion row
- "Select all visible" checkbox in header
- When 1+ rows selected, a bulk action bar appears at the bottom: "X suggestions selected — [Acknowledge as: Ordered ▼] [Confirm]"
- Dropdown options: Ordered, Deferred, Not Needed, Out of Budget

**Updated single-acknowledge flow:**
- Replace simple "Acknowledge" button with a small dropdown button: "Acknowledge ▼"
- Opens a small popover with 4 fields: Reason (dropdown), Qty Ordered (number), Expected Delivery (date), Order Ref (text)
- All optional. "Quick Acknowledge" skips the popover (one click, reason = ORDERED).

**Updated suggestion row display:**
- Acknowledged suggestions show reason badge instead of just "Acknowledged": green "Ordered (200 units, due Apr 4)", grey "Deferred", etc.
- Show `orderReference` if set: tiny tag "PO-4521"

---

## 9. Products — Bulk Import & Search

### The Problem
Products can only be created one at a time. For a store with 200+ products, initial setup takes hours. There is also no search — finding a product in a list of 500 requires scrolling.

### Backend Changes

**New endpoint in `ProductController.java`:**
`POST /api/products/import` (multipart CSV, ROLE_ADMIN only):

CSV format:
```
sku,name,category,unit,reorder_point,max_stock,lead_time_days,minimum_order_qty,unit_cost,supplier_name
MILK-001,Whole Milk 2L,Dairy,litre,50,300,3,48,1.20,Metro
```

Implementation in `ProductBulkImportService.java` (new service, modelled on `SalesIngestionService`):
- Parse, validate, batch-upsert (insert new, skip existing SKUs by default, or update if `updateExisting=true` param)
- Same error response pattern as sales import (line numbers, structured errors)
- Return: `{ imported: 45, skipped: 3, errors: [...] }`

**`ProductController.java`** — add `GET /api/products/export/csv` endpoint:
- Exports all active products as CSV with all fields (including new enrichment fields)
- Used for: template download, backup, edit-in-spreadsheet-and-re-import workflow

**`ProductRepository.java`** — add search query:
```java
Page<Product> findByStoreIdAndActiveAndNameContainingIgnoreCaseOrSkuContainingIgnoreCase(
    UUID storeId, boolean active, String name, String sku, Pageable pageable);
```

**`ProductController.java`** — add `?search=` query param to `GET /api/products` (passes through to repository query above).

### Frontend Changes

**`ProductsPage.tsx`** — add to the top action bar:
- Search input: "Search by name or SKU..." — debounced 300ms, calls `GET /api/products?search=X`
- "Import CSV" button → opens a modal with drag-drop (same style as ImportPage) + "Download template" link that calls `/api/products/export/csv` with 0 rows as a headers-only template
- "Export CSV" button → calls `/api/products/export/csv` to download all products

**`ProductsPage.tsx`** — add sort controls: clickable column headers for Name, SKU, Category, Created. Ascending/descending toggle.

---

## 10. User Invite Workflow

### The Problem
Currently, to add a team member, an admin must:
1. Tell the user to "somehow" create an account
2. Wait for them to appear in the system
3. Go to Users page and assign them the right role

This is not how SaaS products work. The correct flow is: admin enters email → user receives invite link → user sets password → user is active with correct role from day one.

### Backend Changes

**Flyway migration `V16__user_invites.sql`:**
```sql
CREATE TABLE user_invites (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id        UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    email           VARCHAR(255) NOT NULL,
    role            VARCHAR(50) NOT NULL,
    token_hash      VARCHAR(255) NOT NULL UNIQUE,
    invited_by      VARCHAR(100) NOT NULL,
    expires_at      TIMESTAMP NOT NULL,
    accepted_at     TIMESTAMP,
    created_at      TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_invites_store ON user_invites(store_id);
```

**`UserInviteService.java`** (new service):
- `inviteUser(UUID storeId, String invitedBy, String email, String role)`:
  - Check email not already a user in this store
  - Check invite not already pending for this email
  - Generate secure token (UUID), hash it, store in `user_invites`
  - Send invite email via `SesEmailService` (or existing `JavaMailSender` for dev) with link: `https://app.forestock.app/accept-invite?token=RAW_TOKEN`
  - Expires in 72 hours
- `acceptInvite(String rawToken, String username, String password)`:
  - Validate token: find by hash, check not expired, check not already accepted
  - Create `AppUser` with `emailVerified=true`, correct `role`, linked to `store_id`
  - Mark invite `acceptedAt = now()`
  - Return JWT tokens (log user in immediately after accepting)
- `revokeInvite(UUID inviteId, UUID storeId)` — ROLE_ADMIN can cancel pending invites
- `listPendingInvites(UUID storeId)` — return all non-accepted, non-expired invites

**`UserController.java`** — new endpoints:
- `POST /api/users/invite` → send invite (ROLE_ADMIN)
- `GET /api/users/invites` → list pending invites (ROLE_ADMIN)
- `DELETE /api/users/invites/{id}` → revoke invite (ROLE_ADMIN)

**`AuthController.java`** — new endpoints:
- `GET /api/auth/invite/verify?token=xxx` → validate token, return `{ email, role, storeName }` (public, used to pre-fill accept form)
- `POST /api/auth/invite/accept` → accept invite with `{ token, username, password }` (public)

**Remove the old `POST /api/users` endpoint** (or deprecate it — the invite flow replaces ad-hoc user creation).

### Frontend Changes

**`UsersPage.tsx`** — replace "Add User" button with "Invite Team Member":
- Opens a modal: Email, Role (MANAGER / VIEWER)
- On submit: calls `POST /api/users/invite`
- After success: "Invite sent to john@store.com. They have 72 hours to accept."

**`UsersPage.tsx`** — add "Pending Invites" section below the users table:
- Shows email, role, invited by, when invited, expires in
- "Revoke" button per invite

**New public page: `AcceptInvitePage.tsx`** (`/accept-invite`):
- On load: calls `GET /api/auth/invite/verify?token=XXX`
- Shows: "You've been invited to join {storeName} as {role}"
- Form: Username, Password, Confirm Password (with `PasswordStrengthIndicator`)
- On submit: calls `POST /api/auth/invite/accept`
- On success: redirects to `/dashboard` (logged in)
- On expired/invalid token: shows error with "Contact your store admin for a new invite"

**`App.tsx`** — add route `/accept-invite` (public, no `ProtectedRoute`).

---

## 11. Slow-Moving & Dead Stock Detection

### The Problem
The app focuses entirely on understocking. It has no concept of the opposite problem: products that have been sitting unsold for weeks or months. Dead stock ties up capital, takes up shelf space, and may expire. This is a core inventory management concern that the existing data can detect — it just doesn't.

### Backend Changes

**`InventoryService.java`** — add `getSlowMovers(UUID storeId, int inactiveDays)`:
- Query: products that have `active=true`, have inventory records (not zero stock), but have had zero `SalesTransaction` rows in the last `inactiveDays` days
- Returns: product details + last sale date + current stock + estimated stock value (qty × unitCost if set)
- Default `inactiveDays` = 30 days

**`DashboardService.java`** — add slow mover count to the dashboard KPIs:
- Add `slowMoversCount` (products with no sales in 30 days) and `deadStockCount` (90 days) to the existing KPI response

**New endpoint in `InventoryController.java`:**
`GET /api/inventory/slow-movers?inactiveDays=30` (ROLE_ADMIN, ROLE_MANAGER):
```json
{
  "data": [
    {
      "productId": "uuid",
      "sku": "OLD-001",
      "name": "Discontinued Widget",
      "category": "Hardware",
      "currentStock": 240,
      "lastSaleDate": "2026-01-15",
      "daysSinceLastSale": 72,
      "estimatedStockValue": 288.00
    }
  ]
}
```

### Frontend Changes

**New page: `SlowMoversPage.tsx`** (`/slow-movers`):
- "Days inactive" filter: 30 / 60 / 90 / custom
- Table: Product, SKU, Category, Current Stock, Last Sale Date, Days Inactive, Est. Value
- Sort by: Days Inactive (default), Est. Value
- Action buttons per row: "Mark as Discontinued" (soft-deactivates the product), "View Sales History" (link to `/sales?sku=X`)
- Footer: "Total capital tied up in slow-moving stock: £X,XXX"

**`DashboardPage.tsx`** — add a "Dead Stock" KPI card showing `deadStockCount` with a link to `/slow-movers?inactiveDays=90`.

**`Layout.tsx`** — add "Slow Movers" nav item under Inventory (icon: `🐌` or a warehouse/box icon), visible to ROLE_ADMIN and ROLE_MANAGER.

---

## 12. Report Expansions

### The Problem
Currently only one report type exists: the restocking suggestions export (Excel + PDF). A store manager needs more than one report to run their operations.

### Backend Changes

**`ReportService.java`** — add three new report methods:

**1. Inventory Valuation Report** — `generateInventoryValuationReport(UUID storeId, ReportFormat format)`:
- Content: one row per active product with current stock, unit cost, total value (stock × cost), category subtotals, grand total
- Only products with `unit_cost` set contribute to monetary value; others shown with "—" in value column
- Format: Excel and PDF (same as suggestion report)

**2. Sales Performance Report** — `generateSalesReport(UUID storeId, LocalDate from, LocalDate to, ReportFormat format)`:
- Content: total units sold per product, sorted by volume descending
- Category subtotals, date range shown in header
- Highlights: top 5 sellers, bottom 5 sellers

**3. Slow Movers Report** — `generateSlowMoversReport(UUID storeId, int inactiveDays, ReportFormat format)`:
- Content: all products with no sales in `inactiveDays`, current stock, last sale date, estimated value
- Sorted by days inactive descending

**New endpoints in `SuggestionController.java` or new `ReportController.java`:**
- `GET /api/reports/inventory-valuation?format=pdf|excel` (ROLE_ADMIN, ROLE_MANAGER, ROLE_VIEWER)
- `GET /api/reports/sales?from=&to=&format=pdf|excel`
- `GET /api/reports/slow-movers?inactiveDays=30&format=pdf|excel`

**Fix existing report locale issue in `ReportService.java`:** The date format `dd.MM.yyyy` is hardcoded. Replace with a locale-aware formatter that reads from `StoreConfiguration.timezone` (from Section 3). Default to `dd/MM/yyyy` for broad compatibility.

### Frontend Changes

**New section on `SuggestionsPage.tsx`** — rename current "Export" section to "Download Reports" and expand it with tabs or a dropdown:
- "Restocking Suggestions" (Excel / PDF) — existing
- "Inventory Valuation" (Excel / PDF) — new
- "Sales Performance" (date range picker + Excel / PDF) — new
- "Slow Movers" (days inactive input + Excel / PDF) — new

---

## 13. Audit Log — Richer Detail & Export

### The Problem
The audit log exists and captures actions, but:
- The `detail` column is shown raw: `{ "sku": "MILK-001" }`. It doesn't explain what changed.
- There's no export — the log is only viewable in the UI.
- No search by username substring (only exact-match action filter).

### Backend Changes

**`AuditLogService.java`** — improve `detail` JSON structure for key actions:

Instead of: `{ "sku": "MILK-001" }`

Use structured change objects:
```json
{
  "before": { "quantity": 100 },
  "after": { "quantity": 150 },
  "reason": "DELIVERY_RECEIVED",
  "note": "PO-4521"
}
```

Add helper method `logChange(storeId, actor, action, entityType, entityId, Object before, Object after, Map<String,Object> extra)` that builds this structure automatically.

Update the following service calls to use the new helper:
- `InventoryService` stock updates → include before/after quantity + adjustment reason
- `ProductService` product updates → include changed fields as before/after (only fields that actually changed)
- `UserManagementService` role changes → before/after role

**`AuditLogController.java`** — add:
- `?actor=` query param (partial match, `ILIKE '%actor%'`)
- `GET /api/audit-logs/export/csv` → downloads all audit logs for the store as CSV (ROLE_ADMIN)

### Frontend Changes

**`AuditLogPage.tsx`** — improvements:
- Add "Actor" search input next to the existing action filter
- Render `detail` column intelligently: if `before`/`after` keys exist, show "100 → 150" format. Otherwise show the raw JSON.
- Add "Export CSV" button in the top-right

---

## 14. Settings Page — Store Configuration UI

### The Problem
The Settings page only has two things: store name change (ROLE_ADMIN) and password change (all users). With the new features in this document, there are now several more things to configure, and they need a clean home.

### Frontend Changes Only (backend covered in previous sections)

**`SettingsPage.tsx`** — restructure into clearly labelled sections:

**Section 1: Store Profile** (ROLE_ADMIN)
- Store name (existing)
- Timezone (new — from StoreConfiguration, Section 3)
- Currency symbol (new — from StoreConfiguration, Section 3)

**Section 2: Forecast & Restocking** (ROLE_ADMIN)
- Forecast horizon, safety stock buffer, urgency thresholds (new — from Section 3)
- Auto-forecast on import toggle (existing feature, newly exposed here)

**Section 3: Account** (all roles)
- Password change (existing)
- Last login: "Last signed in: March 28, 2026 at 10:34" (requires `AppUser.lastLoginAt` field — add in `V17__last_login.sql` and update in `AuthController.java` on successful login)

**Section 4: Data & Privacy** (ROLE_ADMIN)
- "Export my data" button — exists today (`GET /api/users/me/export`) but isn't linked from anywhere visible
- "Delete my account" link — not yet implemented, show it as disabled with tooltip "Contact support to delete your account"

---

## Implementation Priority

| # | Feature | Why This Order |
|---|---------|---------------|
| 1 | Product Fields (Section 1) | Foundation for Section 2 — must exist first |
| 2 | Suggestion Engine Improvements (Section 2) | Core product value — directly improves the main output |
| 3 | Store Configuration (Section 3) | Unlocks tuning; makes the engine usable for different store types |
| 4 | CSV Import Preview (Section 5) | Highest daily-friction point for users |
| 5 | Bulk Suggestion Actions (Section 8) | Second highest friction point |
| 6 | User Invite Workflow (Section 10) | Broken workflow that blocks team onboarding |
| 7 | Dashboard Charts (Section 7) | Surfaces value already computed; needs recharts |
| 8 | Forecast Accuracy (Section 4) | Requires Section 3 data to be present; builds trust |
| 9 | Inventory Adjustments (Section 6) | Improves data quality over time |
| 10 | Slow Movers (Section 11) | New page, self-contained |
| 11 | Product Bulk Import & Search (Section 9) | Reduces onboarding friction |
| 12 | Report Expansions (Section 12) | Needs Section 1 data (unit_cost) for valuation report |
| 13 | Audit Log Improvements (Section 13) | Needs Section 6 (adjustment reasons) wired in |
| 14 | Settings Page Restructure (Section 14) | UI wrapper for Sections 1, 3, 10 |
