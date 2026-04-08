# Shopify Local Environment Runbook

## Purpose
Bring up a local/non-production Forestock environment that is good enough to execute the Shopify dev-store validation plan.

This runbook is optimized for the current repo shape:
- `forestock-backend` runs as the core API
- `shopify-app` runs as the embedded Shopify app
- `forestock-frontend` is optional for standalone-access validation

## What this runbook assumes
- You have a Shopify Partner app and a Shopify dev store
- You can update app URLs/callbacks in the Partner Dashboard or via Shopify CLI
- You can expose local services through a public tunnel URL
- You are using non-production data only

## Required local services
### Backend dependencies
The backend dev profile expects:
- PostgreSQL on `localhost:5432`
- Redis on `localhost:6379`

The repo already includes these in:
- `forestock-backend/docker-compose.yml`

## Required tools
- Node.js 20+
- Java 21+
- npm
- Shopify CLI (global install is optional if you use `npx shopify ...`)
- Docker or another way to run PostgreSQL + Redis
- A tunnel tool for the Shopify app URL

## Recommended local URLs
- Backend API: `http://localhost:8080`
- Standalone frontend: `http://localhost:5173`
- Shopify embedded app local port: `http://localhost:3000`
- Public Shopify app URL: `https://<your-tunnel-host>`

## Configuration files to create locally
### 1. Shopify app local env
Create `shopify-app/.env` from `shopify-app/.env.local.example`.

Minimum fields to fill:
- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`
- `SHOPIFY_APP_URL`
- `FORESTOCK_API_BASE_URL`
- `FORESTOCK_PROVISIONING_SECRET`

For local validation, `DATABASE_URL=file:dev.sqlite` is acceptable.

### 2. Backend local env
Create `forestock-backend/.env` from `forestock-backend/.env.local.shopify.example`.

Minimum fields to fill:
- `JWT_SECRET`
- `SUPER_ADMIN_USERNAME`
- `SUPER_ADMIN_PASSWORD`
- `FORESTOCK_FRONTEND_URL`

The backend dev profile already provides Shopify test secrets:
- webhook secret: `dev-test-secret`
- provisioning secret: `dev-provisioning-secret`

## Recommended value choices
### If running everything locally
- `FORESTOCK_API_BASE_URL=http://localhost:8080`
- `FORESTOCK_FRONTEND_URL=http://localhost:5173`
- `FORESTOCK_PROVISIONING_SECRET=dev-provisioning-secret`

### If the Shopify app must call a non-local backend
Set `FORESTOCK_API_BASE_URL` to a reachable non-production backend URL instead.

## Step-by-step startup sequence
### Step 1 — Start backend dependencies
From `forestock-backend/`:

```bash
docker compose up -d
```

This should start:
- PostgreSQL
- Redis
- Adminer

### Step 2 — Start the backend
From `forestock-backend/`:

```bash
export SPRING_PROFILES_ACTIVE=dev
set -a
source .env
set +a
./mvnw spring-boot:run
```

Expected result:
- backend starts on `http://localhost:8080`
- Flyway migrations apply cleanly
- readiness should be available

Quick check:

```bash
curl http://localhost:8080/actuator/health/readiness
```

### Step 3 — Start the optional standalone frontend
Only needed if validating standalone activation/login flow.

From `forestock-frontend/`:

```bash
npm install
npm run dev
```

This should serve the standalone UI at `http://localhost:5173`.

### Step 4 — Expose the Shopify app with a tunnel
Choose a tunnel tool and expose the embedded Shopify app port you will run locally.

Target result:
- a public HTTPS URL like `https://<your-tunnel-host>`

This public HTTPS URL becomes:
- `SHOPIFY_APP_URL`
- the Shopify app `application_url`
- the source for Shopify auth redirect URLs

### Step 5 — Start the Shopify app
From `shopify-app/`:

```bash
npm install
set -a
source .env
set +a
npm run dev
```

If using Shopify CLI workflow, ensure your app config is linked to the correct Partner app first.

### Step 6 — Point Shopify config at the tunnel URL
Before dev-store install testing, ensure the app configuration matches the tunnel URL:
- application URL
- auth callback URLs
- any required redirect URLs

The current app expects callback routes under:
- `/auth/callback`
- `/auth/shopify/callback`

## Sanity checks before testing
### Backend
- [ ] `http://localhost:8080/actuator/health/readiness` is UP
- [ ] backend logs show no Flyway or Redis startup failure

### Shopify app
- [ ] app starts without missing-env errors
- [ ] `SHOPIFY_APP_URL` is an HTTPS public URL
- [ ] Shopify app config matches the active tunnel URL
- [ ] app can reach `FORESTOCK_API_BASE_URL`

### Optional standalone frontend
- [ ] `http://localhost:5173` loads
- [ ] frontend can reach backend `/api`

## Validation execution order
Once the environment is up, run:
1. `docs/SHOPIFY_DEV_STORE_VALIDATION_PLAN.md`
2. record results in `docs/SHOPIFY_VALIDATION_EVIDENCE_TEMPLATE.md`
3. track submission gaps in `docs/SHOPIFY_SUBMISSION_TODO.md`

## Common failure patterns
### App install or auth loop
- `SHOPIFY_APP_URL` does not match the actual public URL
- callback URLs in Shopify config do not match the running environment
- Shopify app is running, but not reachable publicly

### Provisioning error on embedded setup page
- backend is not reachable from the Shopify app runtime
- `FORESTOCK_PROVISIONING_SECRET` does not match backend expectation
- backend Shopify endpoints are disabled or misconfigured

### Catalog/order sync fails
- no representative Shopify data exists in the dev store
- backend matching/import logic rejects the payload
- app can authenticate to Shopify but cannot reach Forestock backend cleanly

### Standalone access flow fails
- standalone frontend is not running
- `FORESTOCK_FRONTEND_URL` is wrong, causing broken activation links
- mail/log capture path for token inspection is missing

## Honest current note
This repo is ready for a local Shopify validation run only after local tool/runtime setup is completed. The missing pieces are environmental, not just code-level:
- Shopify CLI availability
- local services availability
- tunnel URL
- real app credentials
