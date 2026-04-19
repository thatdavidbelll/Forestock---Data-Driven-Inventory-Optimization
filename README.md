# Forestock

Forestock helps retail operators turn sales history into practical restocking decisions.

**Current status:** the standalone product is ready for a controlled invited pilot. The Shopify app is under active development and should be tested only on a dedicated dev app and dev store.

## What’s in this repo

```text
Forestock/
├── forestock-backend/     Spring Boot API
├── forestock-frontend/    React + Vite web app
└── shopify-app/           Embedded Shopify app
```

## First-pilot scope

Primary workflow:
1. add products
2. import sales history via CSV
3. run forecast
4. review suggestions
5. optionally connect Shopify later

For the first standalone pilot:
- Shopify is intentionally **out of scope**
- onboarding is manual
- support is manual

## Tech stack

- **Backend:** Java 21, Spring Boot, Spring Security, JPA/Hibernate
- **Frontend:** React, TypeScript, Vite, Tailwind
- **Database:** PostgreSQL
- **Cache / token revocation:** Redis
- **Migrations:** Flyway
- **Reports:** Excel + PDF export

## Local setup

### Backend

Start local services:

```bash
cd forestock-backend
docker compose up -d
```

Run the backend:

```bash
export SPRING_PROFILES_ACTIVE=dev
./mvnw spring-boot:run
```

### Frontend

```bash
cd forestock-frontend
npm install
npm run dev
```

### Shopify app

Use the dedicated startup script from repo root:

```bash
bash scripts/start-shopify-local.sh
```

What it does:
- ensures local env files exist
- starts PostgreSQL and Redis for the backend
- starts the Spring backend
- waits for backend readiness
- starts the Shopify app

Required local files:
- `forestock-backend/.env`
- `shopify-app/.env`

Important local Shopify values:
- backend: `SHOPIFY_PROVISIONING_SECRET=dev-provisioning-secret`
- Shopify app: `FORESTOCK_PROVISIONING_SECRET=dev-provisioning-secret`

Typical local session database choices:
- local Postgres:
  - `DATABASE_URL=postgresql://forestock_user:forestock_pass@localhost:5432/forestock?schema=shopify_app_local`
- Neon:
  - use a full Neon connection string with real credentials and a dedicated schema such as `shopify_app_local`

When you finish a local Shopify preview, reset the dev preview so the dev store stops pointing at the temporary tunnel:

```bash
cd shopify-app
npx shopify app dev clean
```

Do not use the production Shopify app for local previews. Keep these separate:
- production app config
- development app config
- production store usage
- development store usage

If you run `shopify app dev` against the wrong app/store pair, Shopify can temporarily point the store at the local preview tunnel instead of the released app.

### Default local URLs

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8080`
- Shopify app local server: `http://localhost:3000`
- Swagger UI: `http://localhost:8080/swagger-ui.html`
- Adminer: `http://localhost:8090`

## Validation commands

### Backend

```bash
cd forestock-backend
./mvnw test
```

### Frontend

```bash
cd forestock-frontend
npm run lint
npm run build
```

`npm run build` already includes TypeScript compilation via `tsc -b`.

### Shopify app

```bash
cd shopify-app
npm run typecheck
npm run lint
npm run build
```

## Access model

- `ROLE_SUPER_ADMIN` — platform owner; manages stores
- `ROLE_ADMIN` — store owner/admin; manages store users and store data
- `ROLE_MANAGER` — operates products, inventory, sales, forecasts, suggestions
- `ROLE_VIEWER` — read-only access

## Authentication

Public auth endpoints:
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `GET /api/auth/verify-email`
- `GET /api/auth/invite/verify`
- `POST /api/auth/invite/accept`
- `POST /api/auth/resend-verification`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

Notes:
- new store admins must verify email before first login
- access tokens expire in 8 hours
- refresh tokens expire in 30 days
- frontend attempts silent refresh on 401 before logging out

## Core API areas

- `/api/dashboard` — KPIs, forecast status, trends
- `/api/products` — product management
- `/api/inventory` — stock visibility and updates
- `/api/sales` — sales list, summary, daily history
- `/api/sales/import` — CSV preview + import
- `/api/forecast` — forecast runs
- `/api/suggestions` — reorder suggestions and acknowledgements
- `/api/reports/*` — exports and reports
- `/api/users` — store user management
- `/api/admin/*` — platform admin only

## Important docs

Operational and release docs live in [`docs/`](docs):

- `docs/FINAL_LAUNCH_BOARD.md`
- `docs/PILOT_GO_LIVE_CHECKLIST.md`
- `docs/LAUNCH_BLOCKERS.md`
- `docs/VERIFICATION_MATRIX.md`
- `docs/ROLLBACK_PROCEDURES.md`
- `docs/CHANGELOG.md`
- `docs/SHOPIFY_LOCAL_ENV_RUNBOOK.md`
- `docs/SHOPIFY_LOCAL_COMMAND_SEQUENCE.md`

## Notes

- Shopify support exists in the repo, but it is **not part of the first standalone pilot decision**.
- For Shopify local work, prefer the dedicated docs and scripts instead of improvising commands.
- If you need deeper operational or launch context, start in `docs/` rather than expanding this README.
