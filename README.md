# Forestock

Forestock helps retail operators turn sales history into practical restocking decisions.

**Current status:** ready for a **controlled invited non-Shopify pilot** with manual onboarding/support. Broad public launch is not approved yet.

## What’s in this repo

```text
Forestock/
├── forestock-backend/     Spring Boot API
├── forestock-frontend/    React + Vite web app
└── shopify-app/           Shopify integration (not in scope for first pilot)
```

## First-pilot scope

Primary workflow:
1. add products
2. import sales history via CSV
3. run forecast
4. review suggestions
5. optionally connect Shopify later

For the first pilot:
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

### Default local URLs

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8080`
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

## Notes

- Shopify support exists in the repo, but it is **not part of the first pilot decision**.
- If you need deeper operational or launch context, start in `docs/` rather than expanding this README.
