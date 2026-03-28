# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Note:** `forestock-backend/CLAUDE.md` is outdated and should be ignored. This file is the authoritative reference.

---

## What This App Does

Forestock is a multi-tenant SaaS for retail inventory management. It ingests historical sales data (CSV), runs Holt-Winters Triple Exponential Smoothing forecasting, and generates prioritised restocking suggestions. Store managers decide what to order — the app never orders automatically.

**Domain:** `forestock.ro` | **Production:** `api.forestock.ro` (EC2) + `app.forestock.ro` (CloudFront/S3)

---

## Dev Commands

### Backend
```bash
cd forestock-backend
docker compose up -d                          # start PostgreSQL + Redis + Adminer (localhost)
./mvnw spring-boot:run                        # run with dev profile (set SPRING_PROFILES_ACTIVE=dev)
./mvnw spring-boot:run -Dspring-boot.run.profiles=cloud   # run against Neon DB
./mvnw test                                   # run all tests
./mvnw test -Dtest=SuggestionEngineTest       # run a single test class
./mvnw clean package -DskipTests             # build JAR
docker compose stop                           # stop DB (keeps data)
docker compose down -v                        # wipe DB data
```

Adminer UI at `http://localhost:8090` — Server: `postgres`, User: `forestock_user`, Pass: `forestock_pass`.
Swagger UI at `http://localhost:8080/swagger-ui.html` (dev and cloud profiles only).

### Frontend
```bash
cd forestock-frontend
npm install
npm run dev      # starts Vite dev server on :5173, proxies /api → localhost:8080
npm run build    # production build → dist/
npm run lint
```

### Production (on EC2)
```bash
ssh -i /tmp/ec2key.pem ubuntu@52.29.169.63                 # SSH into EC2
cd ~/forestock/forestock-backend
docker compose -f docker-compose.prod.yml logs -f app      # watch logs
docker compose -f docker-compose.prod.yml up -d --no-build # restart after image pull
```

**EC2 key:** `"/Users/davidbell/Downloads/folder/EC2 Key Pair.pem"` — copy to `/tmp/ec2key.pem` with `chmod 400` before use.

**Pending EC2 `.env` fixes** (SSH in and edit `~/forestock/forestock-backend/.env`):
- `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` — still set to placeholder values; needed for S3 backups
- `MAIL_USERNAME` and `MAIL_PASSWORD` — needed for password reset emails to work

**CORS:** Handled in Nginx (`/etc/nginx/sites-available/forestock`) — OPTIONS preflight returns 204 with correct headers. Spring Boot also has CORS config in `SecurityConfig` reading `FORESTOCK_FRONTEND_URL`.

---

## Repository Layout

```
forestock/
├── forestock-backend/          Spring Boot 4 + Java 21 + Maven
├── forestock-frontend/         React 19 + TypeScript + Vite + TailwindCSS 4
├── .github/workflows/
│   └── deploy.yml              CI/CD — push to main auto-deploys backend (ECR→EC2) + frontend (S3+CloudFront)
├── DEPLOYMENT.md               Full EC2 setup + CI/CD setup guide
├── integrations.md             Prioritised feature backlog (14 items — read before adding features)
└── CODEX_PROMPT.md             Prompt template for delegating work to Codex
```

---

## Backend Architecture

**Package root:** `com.forestock.forestock_backend`

**Layer order:** `controller → service → repository → domain`

All controllers return `ResponseEntity<ApiResponse<T>>` where `ApiResponse` wraps `{ status, message, data }`.

**Key services and what they own:**

| Service | Responsibility |
|---------|---------------|
| `ForecastOrchestrator` | Coordinates the full forecast cycle. Entry point for both manual triggers and the nightly scheduler. |
| `ForecastingEngine` | Pure Holt-Winters algorithm. Takes sales history, returns `ForecastResult{p50Total, p90Total, dailyValues}`. Falls back to Simple Moving Average if history < 30 days. |
| `SuggestionEngine` | Converts forecast output into `OrderSuggestion` rows with urgency (CRITICAL/HIGH/MEDIUM/LOW) and suggested quantity. |
| `SalesIngestionService` | CSV parsing + JDBC batch UPSERT (chunks of 500). Validates SKUs, dates, quantities. Auto-triggers forecast on successful import. |
| `JwtService` + `TokenBlacklistService` | Token generation and Redis-backed revocation on logout/password change. |
| `TenantContext` | ThreadLocal holding the current `store_id`. Set by `JwtAuthFilter` on every request. Cleared after the request. |

**Forecasting pipeline** (triggered manually or by `DailyForecastJob` at 02:00 UTC):
```
ForecastOrchestrator.runFullCycle()
  → create ForecastRun (RUNNING)
  → load last 365 days of sales (missing days filled with 0)
  → S3DataExportService.backupToS3()
  → ForecastingEngine.forecast() per product
  → SuggestionEngine.generate() → persist OrderSuggestion rows
  → ForecastRun (COMPLETED)
  → NotificationService (SNS email)
```

**Suggestion quantity formula:**
```
suggestedQty = max(0, p90_14days − currentStock)   [rounded up]
urgency: daysOfStock = currentStock / (p50_14days / 14)
  < 2 days → CRITICAL | 2–5 → HIGH | 5–10 → MEDIUM | > 10 → LOW
```

---

## Multi-Tenancy — Most Important Pattern

Every entity has a `store_id UUID` FK. All queries must be scoped to the current store.

```java
// JwtAuthFilter sets this on every authenticated request:
TenantContext.setStoreId(storeIdFromJwt);

// Every service method reads it like this — never from request params:
UUID storeId = TenantContext.getStoreId();
```

**ROLE_SUPER_ADMIN has no `store_id` in their JWT** (empty string). They access `PlatformAdminController` endpoints and are blocked from store-scoped endpoints by the security config.

New entities must have `store_id NOT NULL REFERENCES stores(id) ON DELETE CASCADE`. New service methods must call `TenantContext.getStoreId()` — never accept `storeId` as a trusted input from controllers.

---

## Database

**Flyway migrations:** `forestock-backend/src/main/resources/db/migration/V1` through `V10`.
- Next migration is `V11`. Never modify existing ones.
- Flyway uses `ddl-auto: validate` — Hibernate validates but never changes the schema.
- **Always use the `current_inventory` view** for current stock levels, never query the `inventory` table directly.

**Neon (cloud dev + production):** Two connection URLs are required:
- **Pooler URL** (PgBouncer) → used by the app for all queries (`NEON_POOLER_URL`)
- **Direct URL** → used by Flyway only, bypasses PgBouncer to avoid advisory lock issues (`NEON_DIRECT_URL`)

**Spring profiles:**
| Profile | DB | Redis blacklist | Swagger |
|---------|----|-----------------|----|
| `dev` | localhost Docker PostgreSQL | enabled | enabled |
| `cloud` | Neon (pooler) | **disabled** | enabled |
| `prod` | Neon via env vars | enabled | disabled |

---

## Security Model

- JWT access tokens (8h) + refresh tokens (30d), signed with `JWT_SECRET` env var
- JWT payload carries: `sub` (username), `role`, `storeId`, `type` (ACCESS/REFRESH), `jti`
- Revocation via Redis SET with TTL = token expiry (logout, password change, deactivation)
- Rate limiting: 10 req/min per IP on `/api/auth/login` and `/api/auth/forgot-password` (implemented in `RateLimitFilter` — no external deps)
- `DataInitializer` seeds SUPER_ADMIN on first startup from `SUPER_ADMIN_USERNAME` / `SUPER_ADMIN_PASSWORD` env vars

**Public endpoints:** `/api/auth/**`, `/api/auth/invite/**`, `/actuator/health`
**SUPER_ADMIN only:** `/api/register`, `/api/admin/**`
**ROLE_ADMIN only:** `/api/users/**`, `/api/audit-logs/**`, `/api/store/config` (PUT)

---

## Frontend Architecture

**All API calls** go through the `api` axios instance in `src/lib/api.ts` — never use `fetch`. The instance:
- Attaches `Authorization: Bearer <accessToken>` from localStorage
- On 401: silently calls `/api/auth/refresh`, retries once, then redirects to `/login`

**Auth state** is in `AuthContext` — always read via `useAuth()`, never read localStorage directly.

**Route guards** are inline components in `App.tsx` (`AdminRoute`, `AdminOnlyRoute`, `AdminManagerRoute`). Add new protected routes to `App.tsx` and new nav items to `Layout.tsx`.

**Page pattern:**
```tsx
// 1. state declarations
// 2. useEffect → api.get() → setState
// 3. if (loading) return <spinner>
// 4. if (error) return <error>
// 5. return JSX (TailwindCSS only — no CSS modules)
```

---

## Backend Conventions

- Services: `@Slf4j @Service @RequiredArgsConstructor`
- Controllers: `@RestController @RequestMapping @RequiredArgsConstructor @Slf4j`
- Throw domain exceptions (`ResourceNotFoundException`, `ForbiddenException`) — `ApiExceptionHandler` handles them globally, never catch in controllers
- `@Transactional` on service methods that write to DB
- Call `auditLogService.log(...)` after every state-changing operation
- Lombok annotation processor must come **before** MapStruct in `pom.xml` annotationProcessorPaths — breaking this causes silent compile failures

---

## CI/CD

Push to `main` → GitHub Actions (`deploy.yml`):
- **Backend changed** (`forestock-backend/**`): builds Docker image on GitHub runner → pushes to ECR → SSHes into EC2 to pull + restart. Build is `linux/amd64`.
- **Frontend changed** (`forestock-frontend/**`): `npm run build` → S3 sync → CloudFront invalidation.

Both jobs detect changes independently via `dorny/paths-filter` — changing only the frontend doesn't rebuild the backend image.

Required GitHub secrets: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `EC2_HOST`, `EC2_SSH_KEY`, `VITE_API_BASE_URL`, `S3_FRONTEND_BUCKET`, `CLOUDFRONT_DISTRIBUTION_ID`.
