# Forestock — Context Document for Cursor

> This file captures the full state of the project as of **2026-03-28**.
> Use it to onboard a new AI session with complete context.

---

## What is Forestock

**Commercial SaaS decision-support tool for retail store managers.**
- Analyzes historical sales data, forecasts demand using Holt-Winters Triple Exponential Smoothing (internal Java engine), generates prioritized restocking suggestions.
- Multi-tenant: you (the platform owner) create stores. Store admins manage their own team.
- The app never sends orders automatically — human always decides.

**Domain:** `forestock.app`

---

## Repository Structure

```
Forestock/                          ← monorepo root
├── forestock-backend/              ← Java 21 + Spring Boot 4.0.4
├── forestock-frontend/             ← React 19 + Vite + TypeScript + TailwindCSS 4
├── README.md
└── CONTEXT.md                      ← this file
```

**GitHub:** `https://github.com/thatdavidbelll/Forestock---Data-Driven-Inventory-Optimization`
**Branch:** `main`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Java 21 + Spring Boot 4.0.4 |
| Frontend | React 19 + Vite + TypeScript + TailwindCSS 4 |
| Database | PostgreSQL 17 (Docker locally, Neon serverless for cloud dev, AWS RDS for prod) |
| Migrations | Flyway (V1–V10) |
| Forecasting | Holt-Winters Triple Exponential Smoothing — internal Java engine |
| Storage | AWS S3 |
| Notifications | AWS SNS |
| Email | Spring Mail / SMTP (password reset + email verification) |
| Security | Spring Security + JWT (JJWT 0.12.6), multi-role, Redis-backed token revocation, password-strength validation, audit log |
| ORM | Spring Data JPA + Hibernate |
| CSV parsing | Apache Commons CSV 1.12.0 |
| Reports | Apache POI (Excel) + Apache PDFBox (PDF) |
| API Docs | SpringDoc OpenAPI 2.8.6 (dev only) |
| CI | GitHub Actions |

---

## Sprint History — All Complete

| Sprint | Description |
|---|---|
| Sprint 1 | Foundation: entities, repositories, services, controllers, DTOs |
| Sprint 2 | Holt-Winters forecasting engine, AWS S3 + SNS integration |
| Sprint 3 | PDF/Excel reports, suggestion engine, nightly scheduler, dashboard |
| Sprint 4 | JWT security, React frontend, Dockerfile, GitHub Actions CI |
| Sprint 5 | Multi-tenant SaaS, Neon PostgreSQL, JDBC batch import, data management API |
| Sprint 6 | Commercial launch: ROLE_SUPER_ADMIN, user management, password reset, rate limiting, auth bug fixes |
| Sprint 7 (partial) | Suggestion acknowledgement, auto-forecast after import, CSV validation, token revocation, email verification, password strength, audit log |

---

## Access Model

```
ROLE_SUPER_ADMIN  (you — the platform owner)
  └── Creates stores + their first admin via /admin page
        └── ROLE_ADMIN  (store owner)
              └── Invites team members via /users page
                    ├── ROLE_MANAGER  — full use, no user management
                    └── ROLE_VIEWER   — read-only
```

### Super Admin account (auto-seeded on first startup)
| Field | Default |
|---|---|
| Username | `davidbell` |
| Password | `lionofJudah` |

Override via env vars: `SUPER_ADMIN_USERNAME`, `SUPER_ADMIN_PASSWORD`

---

## Local Dev Setup

### Prerequisites
- Java 21 JDK (Temurin)
- Node.js 20+
- Docker Desktop
- AWS CLI configured (`~/.aws/credentials`)

### Start backend
```bash
cd forestock-backend
docker compose up -d                           # PostgreSQL + Redis + Adminer on :8090
export SPRING_PROFILES_ACTIVE=dev
export AWS_S3_BUCKET=forestock-forecast-data-104091534682
./mvnw spring-boot:run
```

### Start backend against Neon
```bash
cd forestock-backend
export SPRING_PROFILES_ACTIVE=cloud
export DB_PASSWORD=<neon-password>
export AWS_S3_BUCKET=forestock-forecast-data-104091534682
./mvnw spring-boot:run
```

Cloud profile note: PostgreSQL runs against Neon. Token blacklist enforcement is disabled in `cloud`, so authenticated requests do not depend on local Docker Redis.

### Start frontend
```bash
cd forestock-frontend
npm install
npm run dev
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8080 |
| Swagger UI | http://localhost:8080/swagger-ui.html |
| Adminer | http://localhost:8090 |
| Redis | localhost:6379 (dev profile only) |

Vite proxies `/api/*` → `http://localhost:8080` (configured in `vite.config.ts`).

---

## Backend File Map

```
forestock-backend/src/main/java/com/forestock/forestock_backend/
│
├── ForestockBackendApplication.java        @SpringBootApplication @EnableScheduling
│
├── config/
│   ├── AwsConfig.java                      S3Client + SnsClient beans
│   ├── DataInitializer.java                Seeds ROLE_SUPER_ADMIN on first startup
│   ├── RateLimitFilter.java                Sliding-window 10 req/min per IP (login + forgot-pw)
│   └── SecurityConfig.java                 JWT filter chain, role-based rules, 401 entry point
│
├── domain/
│   ├── AppUser.java                        id, username, passwordHash, email, role, store(FK), active,
│   │                                       passwordResetToken, passwordResetExpiresAt
│   ├── Store.java                          id, name, slug, active, createdAt
│   ├── Product.java                        id, sku, name, category, unit, reorderPoint, maxStock, active, store(FK)
│   ├── Inventory.java                      id, product(FK), quantity, recordedAt, store(FK)
│   ├── SalesTransaction.java               id, product(FK), quantitySold, saleDate, store(FK)
│   ├── ForecastRun.java                    id, status, startedAt, finishedAt, horizonDays, triggeredBy, store(FK)
│   ├── OrderSuggestion.java                id, product(FK), forecastRun(FK), suggestedQty, p50, p90, stock, daysOfStock, urgency, store(FK)
│   └── enums/
│       ├── ForecastStatus.java             RUNNING / COMPLETED / FAILED
│       └── Urgency.java                    CRITICAL / HIGH / MEDIUM / LOW
│
├── repository/
│   ├── AppUserRepository.java              findByUsername, findByStoreId, findByIdAndStoreId,
│   │                                       findByEmail, findByPasswordResetToken, existsByRole
│   ├── StoreRepository.java
│   ├── ProductRepository.java
│   ├── InventoryRepository.java
│   ├── SalesTransactionRepository.java
│   ├── ForecastRunRepository.java
│   └── OrderSuggestionRepository.java
│
├── service/
│   ├── JwtService.java                     generateToken, validateToken, extractClaims
│   ├── RegisterService.java                creates Store + ROLE_ADMIN user atomically
│   ├── UserManagementService.java          listUsers, createUser, updateUser, deactivateUser, changePassword
│   ├── PasswordResetService.java           requestReset (email with token), resetPassword
│   ├── InventoryService.java               getAlerts, updateStock, getHistory
│   ├── SalesIngestionService.java          importCsv (JDBC batch UPSERT, chunks of 500)
│   ├── ForecastOrchestrator.java           full cycle: load → forecast → suggestions → notify
│   ├── ForecastingEngine.java              Holt-Winters Triple Exp. Smoothing (fallback: SMA)
│   ├── SuggestionEngine.java               qty calc, urgency, sorting
│   ├── DashboardService.java               KPIs + category breakdown (tenant-scoped)
│   ├── ReportService.java                  PDF (PDFBox) + Excel (POI) report generation
│   ├── S3DataExportService.java            backup CSV → S3
│   ├── NotificationService.java            SNS email alerts
│   └── ForecastService.java / SuggestionService.java
│
├── controller/
│   ├── AuthController.java                 POST /api/auth/login, /refresh, /forgot-password, /reset-password
│   ├── UserController.java                 GET/POST/PUT/DELETE /api/users, PUT /api/users/me/password
│   ├── PlatformAdminController.java        GET /api/admin/stores, PUT activate/deactivate
│   ├── ProductController.java              /api/products (CRUD + soft/hard delete + restore)
│   ├── InventoryController.java            /api/inventory
│   ├── SalesController.java                /api/sales (import, query, delete)
│   ├── ForecastController.java             /api/forecast
│   ├── SuggestionController.java           /api/suggestions (+ Excel/PDF export)
│   ├── DashboardController.java            /api/dashboard
│   └── StoreController.java                GET/PUT /api/store
│
├── security/
│   ├── JwtAuthFilter.java                  OncePerRequestFilter — validates JWT, sets TenantContext
│   ├── TenantContext.java                  ThreadLocal<UUID> storeId
│   └── UserDetailsServiceImpl.java
│
└── dto/
    ├── request/
    │   ├── LoginRequest.java
    │   ├── RegisterRequest.java            storeName, storeSlug, username, password
    │   ├── CreateUserRequest.java          username, password, email, role
    │   ├── UpdateUserRequest.java          role, active
    │   ├── ChangePasswordRequest.java      currentPassword, newPassword
    │   ├── ForgotPasswordRequest.java      email
    │   ├── ResetPasswordRequest.java       token, newPassword
    │   ├── InventoryUpdateRequest.java
    │   └── SalesImportRequest.java
    └── response/
        ├── ApiResponse.java                { status, message, data }
        ├── AuthResponse.java               { accessToken, refreshToken, username, role, ... }
        ├── UserDto.java                    { id, username, email, role, active, createdAt }
        ├── StoreDto.java
        ├── ProductDto.java
        ├── InventoryDto.java
        ├── SuggestionDto.java
        ├── ForecastRunDto.java
        └── DashboardDto.java
```

---

## Frontend File Map

```
forestock-frontend/src/
│
├── main.tsx                        React entry point
├── App.tsx                         Router: RootRedirect, ProtectedRoute, AdminRoute, AdminOnlyRoute
│
├── context/
│   └── AuthContext.tsx             login() → Promise<role>, logout(), updateAccessToken()
│                                   Persists to localStorage: accessToken, refreshToken, username, role
│
├── lib/
│   ├── api.ts                      axios instance, base '/api', auto-attaches Bearer token,
│   │                               silent refresh on 401 (except /auth/login, /auth/refresh)
│   └── errors.ts
│
├── components/
│   ├── Layout.tsx                  Nav: role-based (super admin sees only Platform Admin;
│   │                               ROLE_ADMIN sees Users + Settings; others see Settings only)
│   └── ProtectedRoute.tsx          Redirects to /login if not authenticated
│
└── pages/
    ├── LoginPage.tsx               Login form → redirects SUPER_ADMIN to /admin, others to /dashboard
    ├── ForgotPasswordPage.tsx      Email form → POST /api/auth/forgot-password
    ├── ResetPasswordPage.tsx       ?token=xxx → POST /api/auth/reset-password → redirect /login
    ├── VerifyEmailPage.tsx         ?token=xxx → GET /api/auth/verify-email
    ├── AdminPage.tsx               ROLE_SUPER_ADMIN only — create stores, list/activate/deactivate
    ├── DashboardPage.tsx           KPI cards + Run Forecast button
    ├── SuggestionsPage.tsx         Restock table, urgency/category filter, Excel/PDF export
    ├── ProductsPage.tsx            Products CRUD, soft/hard delete, restore
    ├── InventoryPage.tsx           Current stock, inline update, alerts filter
    ├── SalesPage.tsx               Paginated transactions, delete by SKU/range/all
    ├── ImportPage.tsx              Drag-and-drop CSV upload
    ├── UsersPage.tsx               ROLE_ADMIN only — invite team, change roles, deactivate
    ├── SettingsPage.tsx            Store name (ROLE_ADMIN) + change own password (all) + audit entry point
    ├── AuditLogPage.tsx            ROLE_ADMIN only — filterable store audit trail
    └── components/PasswordStrengthIndicator.tsx
```

---

## Routing Logic (App.tsx)

```
/                   → RootRedirect: SUPER_ADMIN→/admin, others→/dashboard
/login              → LoginPage (public)
/forgot-password    → ForgotPasswordPage (public)
/reset-password     → ResetPasswordPage (public, reads ?token=)
/admin              → AdminPage (AdminRoute: must be ROLE_SUPER_ADMIN)
/dashboard          → DashboardPage (ProtectedRoute: any authenticated)
/suggestions        → SuggestionsPage (ProtectedRoute)
/products           → ProductsPage (ProtectedRoute)
/inventory          → InventoryPage (ProtectedRoute)
/sales              → SalesPage (ProtectedRoute)
/import             → ImportPage (ProtectedRoute)
/users              → UsersPage (AdminOnlyRoute: must be ROLE_ADMIN)
/settings           → SettingsPage (ProtectedRoute)
```

---

## API Reference (complete)

All responses: `{ "status": "success"|"error", "message": "...", "data": ... }`

### Auth (public)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Returns accessToken + refreshToken |
| POST | `/api/auth/refresh` | Refresh expired access token |
| POST | `/api/auth/forgot-password` | Send password reset link (body: `{email}`) |
| POST | `/api/auth/reset-password` | Reset password (body: `{token, newPassword}`) |
| POST | `/api/register` | Create store + admin — **ROLE_SUPER_ADMIN only** |

### Platform Admin (ROLE_SUPER_ADMIN only)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/stores` | List all stores |
| PUT | `/api/admin/stores/{id}/deactivate` | Deactivate store |
| PUT | `/api/admin/stores/{id}/activate` | Activate store |

### User Management (ROLE_ADMIN only, store-scoped)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/users` | List users in current store |
| POST | `/api/users` | Create user (ROLE_MANAGER or ROLE_VIEWER only) |
| PUT | `/api/users/{id}` | Update role or active status |
| DELETE | `/api/users/{id}` | Soft-deactivate |
| PUT | `/api/users/me/password` | Change own password (any authenticated user) |

### Store
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/store` | Current store info |
| PUT | `/api/store` | Update store name (ROLE_ADMIN) |

### Products
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/products` | List (`?includeInactive=false`) |
| GET | `/api/products/{id}` | Single product |
| POST | `/api/products` | Create |
| PUT | `/api/products/{id}` | Update |
| PUT | `/api/products/{id}/restore` | Reactivate |
| DELETE | `/api/products/{id}` | Soft delete |
| DELETE | `/api/products/{id}/hard` | Permanent delete (removes all linked data) |

### Inventory
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/inventory` | Current stock all products |
| GET | `/api/inventory/alerts` | Products at/below reorder point |
| PUT | `/api/inventory/{productId}` | Update stock manually |
| GET | `/api/inventory/{productId}/history` | Snapshot history |

### Sales
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/sales/import?overwriteExisting=false` | CSV import (multipart) |
| GET | `/api/sales` | `?sku=&from=&to=&page=0&size=50` |
| GET | `/api/sales/summary?days=30` | Aggregated summary |
| GET | `/api/sales/{sku}/daily` | Daily series |
| DELETE | `/api/sales/product/{sku}` | All transactions for SKU |
| DELETE | `/api/sales/range?from=&to=` | By date range |
| DELETE | `/api/sales/product/{sku}/range?from=&to=` | By SKU + date range |
| DELETE | `/api/sales/all` | All transactions for store |

### Forecast
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/forecast/run` | Trigger manually (async) |
| GET | `/api/forecast/runs` | History |
| GET | `/api/forecast/runs/{id}` | Specific run |
| GET | `/api/forecast/latest` | Latest completed run |

### Suggestions
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/suggestions` | `?urgency=&category=` |
| GET | `/api/suggestions/{id}` | Detail |
| GET | `/api/suggestions/export/excel` | Excel download |
| GET | `/api/suggestions/export/pdf` | PDF download |

### Dashboard
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/dashboard` | KPIs |
| GET | `/api/dashboard/categories` | Category breakdown |

---

## Security Details

### JWT
- Access token: **8 hours**
- Refresh token: **30 days**
- Secret: `JWT_SECRET` env var (base64 48 bytes)
- Claims: `sub` (username), `role`, `storeId` (empty string for SUPER_ADMIN), `type` (ACCESS/REFRESH)

### SecurityConfig rules
```
PUBLIC:   /api/auth/**, /actuator/**, /error, /swagger-ui/**, /swagger-ui.html, /v3/api-docs/**
SUPER_ADMIN: /api/register, /api/admin/**
ADMIN:    GET/POST/PUT/DELETE /api/users
AUTH:     PUT /api/users/me/password
ALL_AUTH: everything else
```

### AuthenticationEntryPoint
Returns **401 JSON** for unauthenticated requests (not Spring's default 403).
This enables the frontend silent-refresh interceptor to work correctly.

### Rate Limiting
`RateLimitFilter`: 10 requests/minute per IP on `/api/auth/login` and `/api/auth/forgot-password`.
Sliding window using `ConcurrentHashMap<String, Deque<Long>>`. Returns HTTP 429.
No third-party dependency — pure Java standard library.

### Multi-tenancy
`TenantContext` (ThreadLocal<UUID>) is set by `JwtAuthFilter` from the JWT `storeId` claim.
All service methods scope queries to `TenantContext.getStoreId()`.
`ROLE_SUPER_ADMIN` has `storeId = null` — bypasses tenant scoping.

---

## Database Migrations

| File | Description |
|---|---|
| V1__init_schema.sql | products, inventory, sales_transactions, forecast_runs, order_suggestions |
| V2__indexes_and_views.sql | Indexes + `current_inventory` view |
| V3__forecast_run_cleanup.sql | Remove legacy ARN columns, add products_processed |
| V4__users.sql | users table for JWT auth |
| V5__multi_tenant.sql | stores table + store_id FK on all 6 entities |
| V6__backfill_store_id.sql | Backfill store_id=NULL rows to default store |
| V7__user_email_and_reset.sql | email, password_reset_token, password_reset_expires_at on users |

---

## Environment Variables

### Development
```bash
SPRING_PROFILES_ACTIVE=dev
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=forestock-forecast-data-104091534682
AWS_SNS_TOPIC_ARN=...
```

### Production
```bash
SPRING_PROFILES_ACTIVE=prod
SPRING_DATASOURCE_URL=jdbc:postgresql://...
SPRING_DATASOURCE_USERNAME=...
SPRING_DATASOURCE_PASSWORD=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=eu-central-1
AWS_S3_BUCKET=...
AWS_SNS_TOPIC_ARN=...
JWT_SECRET=<openssl rand -base64 48>
FORESTOCK_ALERT_EMAIL=manager@example.com
SUPER_ADMIN_USERNAME=superadmin
SUPER_ADMIN_PASSWORD=<strong-password>
FORESTOCK_FRONTEND_URL=https://app.forestock.app
# Optional — enables password reset emails:
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=your@gmail.com
MAIL_PASSWORD=<app-password>
MAIL_FROM=noreply@forestock.app
```

---

## Known Issues / Notes

- **Password reset email**: If `MAIL_HOST` is not configured, the backend logs the reset link instead of sending it. Useful for dev — look for `[DEV] Password reset link:` in the log.
- **Super admin has no store**: `TenantContext.getStoreId()` returns `null` for SUPER_ADMIN. All service methods guard against this.
- **Actuator health**: `/actuator/health` is in PUBLIC_ENDPOINTS but returns 404 by default — the actuator web endpoint needs to be exposed in application.yml if needed. Currently not configured.
- **Rate limiter**: Uses a single `synchronized` block on `this` (the filter instance). Fine for single-instance deployments. For multi-instance, replace with Redis-backed solution.

---

## Suggested Next Steps (Post-Sprint 6)

These were listed in the plan but not implemented yet:

1. **Email verification** — store admin verifies email before first login
2. **Audit log** — who did what, when (important for multi-user stores)
3. **Subscription/billing** — Stripe integration (free trial → paid)
4. **Server-side token revocation** — Redis blacklist for logout/password-change invalidation
5. **GDPR data export** — full account data as ZIP on request
6. **Production deployment** — AWS ECS + RDS + CloudFront, CI/CD via GitHub Actions
7. **Actuator health endpoint** — expose for load balancer health checks
8. **Multi-instance rate limiting** — replace in-memory ConcurrentHashMap with Redis

---

## CSV Import Format

```csv
sku,sale_date,quantity_sold
LAPTE-1L,2026-03-01,42
PAINE-ALB,2026-03-01,28
```

- One row per product per day
- `sale_date`: `yyyy-MM-dd`
- JDBC batch UPSERT in chunks of 500 — 8000+ rows in ~2 seconds
- `overwriteExisting=false` skips duplicates; `true` overwrites

---

## Forecasting Engine

**Holt-Winters Triple Exponential Smoothing** (additive, weekly seasonality):
- Minimum 30 days history → falls back to Simple Moving Average below threshold
- Seasonality period: 7 days
- Parameter optimization: grid search over α, β, γ — minimizes SSE
- Horizon: 14 days

| Value | Meaning |
|---|---|
| P50 | Median forecast — used for urgency / days-of-stock |
| P90 | P50 × 1.20 safety buffer — used for order quantity |

```
suggestedQty = max(0, P90_14days − currentStock)  [rounded up]
daysOfStock  = currentStock / (P50_14days / 14)
```

| Days of stock | Urgency |
|---|---|
| < 2 | CRITICAL |
| 2–5 | HIGH |
| 5–10 | MEDIUM |
| > 10 | LOW |
