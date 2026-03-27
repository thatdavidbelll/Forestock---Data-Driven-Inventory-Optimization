# Forestock

Decision support tool for retail store managers. Analyzes historical sales data, forecasts demand using **Holt-Winters Triple Exponential Smoothing**, and generates prioritized restocking suggestions. The store manager sees what to order and how much — the final decision is always human.

**Commercial SaaS model:** you (the platform owner) create and manage stores. Each store has isolated data scoped by JWT-carried `storeId`. Store admins manage their own team.

---

## Repository Structure

```
Forestock/
├── forestock-backend/     Java 21 + Spring Boot 4 REST API
└── forestock-frontend/    React 19 + Vite + TypeScript web app
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Java 21 + Spring Boot 4.0.4 |
| Frontend | React 19 + Vite + TypeScript + TailwindCSS 4 |
| Database | PostgreSQL 17 (Neon serverless for dev, AWS RDS for prod) |
| Migrations | Flyway (V1–V7) |
| Forecasting | Holt-Winters Triple Exponential Smoothing — internal Java engine |
| Storage | AWS S3 (sales data backup + forecast results) |
| Notifications | AWS SNS (email on forecast complete / failed) |
| Email | Spring Mail / SMTP (password reset) |
| Security | Spring Security + JWT (JJWT 0.12.6), multi-role |
| ORM | Spring Data JPA + Hibernate |
| CSV parsing | Apache Commons CSV 1.12.0 |
| Reports | Apache POI (Excel) + Apache PDFBox (PDF) |
| API Docs | SpringDoc OpenAPI 2.8.6 (dev only) |
| CI | GitHub Actions |

---

## Prerequisites

- Java 21 JDK ([Temurin](https://adoptium.net/))
- Node.js 20+
- Docker Desktop (for local PostgreSQL)
- AWS CLI configured (`~/.aws/credentials`) — needed for S3 + SNS

---

## Local Setup

### Backend

**1. Start the database**
```bash
cd forestock-backend
docker compose up -d          # PostgreSQL 16 + Adminer on :8090
```

**2. Run the backend**
```bash
export SPRING_PROFILES_ACTIVE=dev
export AWS_S3_BUCKET=forestock-forecast-data-{accountId}
./mvnw spring-boot:run
```

**3. Cloud database (Neon) — alternative to Docker**
```bash
export SPRING_PROFILES_ACTIVE=cloud
export DB_PASSWORD=<neon-password>
export AWS_S3_BUCKET=forestock-forecast-data-{accountId}
./mvnw spring-boot:run
```

### Frontend

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

---

## Access Model

```
ROLE_SUPER_ADMIN (you — the platform owner)
  └── Creates stores + their first admin via Platform Admin panel
        └── ROLE_ADMIN (store owner)
              └── Invites team members via /users page
                    ├── ROLE_MANAGER  — full use, no user management
                    └── ROLE_VIEWER   — read-only access
```

### Super Admin account

Created automatically on first startup:

| Field | Default value |
|---|---|
| Username | `superadmin` |
| Password | `Admin@12345` |

Override via environment variables: `SUPER_ADMIN_USERNAME`, `SUPER_ADMIN_PASSWORD`

> **Change the password immediately** after first login, especially in production.

---

## Multi-Tenant Architecture

- Each store has a `stores` table row and a unique `slug`
- All entities (`products`, `inventory`, `sales_transactions`, `forecast_runs`, `order_suggestions`, `users`) carry a `store_id` FK
- `TenantContext` — `ThreadLocal<UUID>` — is set from the JWT on every request by `JwtAuthFilter`
- All queries are automatically scoped to the current store
- `ROLE_SUPER_ADMIN` has no `store_id` — bypasses tenant scoping to manage the platform

### Creating a new store (super admin only)
```bash
POST /api/register   # requires Authorization: Bearer <super_admin_token>
{
  "storeName": "My Store",
  "storeSlug": "my-store",
  "username": "store_admin",
  "password": "SecurePass1"
}
# Returns accessToken + refreshToken for the new store admin immediately
```

---

## Authentication

All `/api/**` endpoints require a JWT Bearer token.

**Public endpoints (no auth required):**
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET  /actuator/health`
- Swagger UI (dev only)

```bash
# Login
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"store_admin","password":"SecurePass1"}'

# Use the token
curl http://localhost:8080/api/dashboard \
  -H "Authorization: Bearer <accessToken>"
```

Token expiry: access **8h** · refresh **30 days**
Silent refresh: the frontend automatically retries with a refresh token on 401 before logging out.

### Roles
| Role | Permissions |
|---|---|
| `ROLE_SUPER_ADMIN` | Platform management — create stores, list/deactivate all stores |
| `ROLE_ADMIN` | Full store access — products, inventory, sales, forecasts, user management |
| `ROLE_MANAGER` | View, import, export, trigger forecast (no user management) |
| `ROLE_VIEWER` | Read-only — dashboard, suggestions, export reports |

### Rate limiting
Login and forgot-password endpoints: **10 requests/minute per IP**. Returns HTTP 429 when exceeded.

---

## API Reference

All responses: `{ "status": "success"|"error", "message": "...", "data": ... }`

### Auth
| Method | Endpoint | Auth required | Description |
|---|---|---|---|
| POST | `/api/auth/login` | No | Get access + refresh tokens |
| POST | `/api/auth/refresh` | No | Refresh expired access token |
| POST | `/api/auth/forgot-password` | No | Send password reset link to email |
| POST | `/api/auth/reset-password` | No | Reset password using token from email |
| POST | `/api/register` | SUPER_ADMIN | Create new store + admin account |

### Platform Admin (SUPER_ADMIN only)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/stores` | List all stores on the platform |
| PUT | `/api/admin/stores/{id}/deactivate` | Deactivate a store |
| PUT | `/api/admin/stores/{id}/activate` | Reactivate a store |

### User Management (ROLE_ADMIN only, store-scoped)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/users` | List all users in current store |
| POST | `/api/users` | Create new user (ROLE_MANAGER or ROLE_VIEWER) |
| PUT | `/api/users/{id}` | Update user role or active status |
| DELETE | `/api/users/{id}` | Soft-deactivate a user |
| PUT | `/api/users/me/password` | Change own password (any authenticated user) |

### Store
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/store` | Current tenant's store info |
| PUT | `/api/store` | Update store name (ROLE_ADMIN) |

### Products
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/products?includeInactive=false` | List products |
| GET | `/api/products/{id}` | Get product by ID |
| POST | `/api/products` | Create product |
| PUT | `/api/products/{id}` | Update product fields |
| PUT | `/api/products/{id}/restore` | Reactivate a deactivated product |
| DELETE | `/api/products/{id}` | Soft delete — deactivates, preserves history |
| DELETE | `/api/products/{id}/hard` | **Permanent delete** — removes product + all linked data |

### Inventory
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/inventory` | Current stock for all products |
| GET | `/api/inventory/alerts` | Products at or below reorder point |
| PUT | `/api/inventory/{productId}` | Update stock manually |
| GET | `/api/inventory/{productId}/history` | Full snapshot history |

### Sales
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/sales/import?overwriteExisting=false` | Import CSV (multipart) |
| GET | `/api/sales?sku=&from=&to=&page=0&size=50` | Paginated transaction list |
| GET | `/api/sales/summary?days=30` | Aggregated summary |
| GET | `/api/sales/{sku}/daily` | Daily series for a product |
| DELETE | `/api/sales/product/{sku}` | Delete all transactions for a SKU |
| DELETE | `/api/sales/range?from=&to=` | Delete by date range (store-scoped) |
| DELETE | `/api/sales/product/{sku}/range?from=&to=` | Delete by SKU + date range |
| DELETE | `/api/sales/all` | **Nuclear** — delete all transactions for the store |

### Forecast
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/forecast/run` | Trigger forecast manually (async) |
| GET | `/api/forecast/runs` | Forecast run history |
| GET | `/api/forecast/runs/{id}` | Specific run details |
| GET | `/api/forecast/latest` | Latest completed run |

### Suggestions
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/suggestions?urgency=&category=` | Suggestions from latest run |
| GET | `/api/suggestions/{id}` | Suggestion detail |
| GET | `/api/suggestions/export/excel` | Download Excel report |
| GET | `/api/suggestions/export/pdf` | Download PDF report |

### Dashboard
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/dashboard` | KPIs: alerts, CRITICAL count, last run |
| GET | `/api/dashboard/categories` | Product breakdown by category |

---

## CSV Import Format

```csv
sku,sale_date,quantity_sold
LAPTE-1L,2026-03-01,42
PAINE-ALB,2026-03-01,28
```

- One row per product per day (daily aggregated quantities, not individual transactions)
- `sale_date` format: `yyyy-MM-dd`
- `overwriteExisting=false` (default) — skips duplicate dates; `true` — overwrites existing quantity

Import uses JDBC batch UPSERT in chunks of 500 rows — 8 000+ rows import in ~2 seconds.

---

## Forecasting Engine

Forestock uses **Holt-Winters Triple Exponential Smoothing** (additive, weekly seasonality):

- **Minimum history:** 30 days — falls back to Simple Moving Average below this threshold
- **Seasonality period:** 7 days (weekly pattern)
- **Parameter optimization:** grid search over α (level), β (trend), γ (seasonality) — minimizes SSE on historical data
- **Horizon:** 14 days forward

### Output
| Value | Meaning |
|---|---|
| P50 | Median forecast — used for days-of-stock / urgency |
| P90 | P50 × 1.20 safety buffer — used for order quantity |

### Suggested quantity
```
suggestedQty = max(0, P90_14days − currentStock)   [rounded up]
```

### Urgency
| Days of stock remaining | Urgency |
|---|---|
| < 2 | 🔴 CRITICAL |
| 2–5 | 🟠 HIGH |
| 5–10 | 🟡 MEDIUM |
| > 10 | 🟢 LOW |

Suggestions sorted: CRITICAL → HIGH → MEDIUM → LOW, then by days of stock ascending.

---

## Frontend Pages

### Regular store users
| Page | Route | Who sees it | Description |
|---|---|---|---|
| Dashboard | `/dashboard` | All | KPI cards, forecast trigger button |
| Suggestions | `/suggestions` | All | Restock table, urgency/category filters, Excel/PDF export |
| Products | `/products` | All | Create, edit, deactivate, restore, hard delete |
| Inventory | `/inventory` | All | Current stock, inline update, alerts filter |
| Sales | `/sales` | All | Paginated transaction list, delete by SKU/range/all |
| Import | `/import` | All | Drag-and-drop CSV upload |
| Users | `/users` | ROLE_ADMIN | Invite team members, change roles, deactivate |
| Settings | `/settings` | All | Store name (admin) + change own password |

### Platform owner (super admin)
| Page | Route | Description |
|---|---|---|
| Platform Admin | `/admin` | Create stores, list all stores, activate/deactivate |

---

## Database Migrations

| File | Description |
|---|---|
| `V1__init_schema.sql` | Creates `products`, `inventory`, `sales_transactions`, `forecast_runs`, `order_suggestions` |
| `V2__indexes_and_views.sql` | Indexes + `current_inventory` view |
| `V3__forecast_run_cleanup.sql` | Removes legacy ARN columns, adds `products_processed` |
| `V4__users.sql` | Creates `users` table for JWT authentication |
| `V5__multi_tenant.sql` | Creates `stores` table, adds `store_id` FK to all 6 entities |
| `V6__backfill_store_id.sql` | Backfills `store_id = NULL` rows to the default store |
| `V7__user_email_and_reset.sql` | Adds `email`, `password_reset_token`, `password_reset_expires_at` to users |

---

## Environment Variables

### Development (Docker PostgreSQL)
```
SPRING_PROFILES_ACTIVE=dev
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=forestock-forecast-data-{accountId}
AWS_SNS_TOPIC_ARN=...
```

### Cloud Dev (Neon PostgreSQL)
```
SPRING_PROFILES_ACTIVE=cloud
DB_PASSWORD=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=forestock-forecast-data-{accountId}
```

### Production
```
SPRING_PROFILES_ACTIVE=prod
SPRING_DATASOURCE_URL=jdbc:postgresql://...
SPRING_DATASOURCE_USERNAME=...
SPRING_DATASOURCE_PASSWORD=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=eu-central-1
AWS_S3_BUCKET=...
AWS_SNS_TOPIC_ARN=...
JWT_SECRET=<base64-random-48-bytes>
FORESTOCK_ALERT_EMAIL=manager@example.com
SUPER_ADMIN_USERNAME=superadmin
SUPER_ADMIN_PASSWORD=<strong-password>
FORESTOCK_FRONTEND_URL=https://app.forestock.app

# Optional — enables password reset emails
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=your@gmail.com
MAIL_PASSWORD=<app-password>
MAIL_FROM=noreply@forestock.app
```

Generate a JWT secret:
```bash
openssl rand -base64 48
```

---

## Docker

### Development (DB only)
```bash
cd forestock-backend
docker compose up -d        # PostgreSQL + Adminer
docker compose stop         # stop, keep data
docker compose down -v      # reset, delete all data
```

### Production (full stack)
```bash
cd forestock-backend
docker compose -f docker-compose.prod.yml up -d
```

Multi-stage Dockerfile: `eclipse-temurin:21-jdk-alpine` build → `eclipse-temurin:21-jre-alpine` runtime. Non-root user, `-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0`.

---

## Project Status

| Sprint | Description | Status |
|---|---|---|
| Sprint 1 | Foundation: entities, repositories, services, controllers, DTOs | ✅ Done |
| Sprint 2 | Holt-Winters forecasting engine, AWS S3 + SNS integration | ✅ Done |
| Sprint 3 | PDF/Excel reports, suggestion engine, nightly scheduler, dashboard | ✅ Done |
| Sprint 4 | JWT security, React frontend, Dockerfile, GitHub Actions CI | ✅ Done |
| Sprint 5 | Multi-tenant SaaS, Neon PostgreSQL, JDBC batch import, data management API | ✅ Done |
| Sprint 6 | Commercial launch: ROLE_SUPER_ADMIN, user management, password reset, rate limiting | ✅ Done |
