# Shopify Local Command Sequence

Fastest setup for the current repo:

```bash
cd /path/to/Forestock
bash scripts/shopify-local-bootstrap.sh
```

That script:
- creates missing local env files
- starts PostgreSQL and Redis through `forestock-backend/docker-compose.yml`
- prints the exact backend and Shopify commands you still need to run

Then run these in separate terminals.

## Terminal 1 — backend dependencies
```bash
cd /path/to/Forestock/forestock-backend
docker compose up -d
```

## Terminal 2 — backend
```bash
cd /path/to/Forestock/forestock-backend
cp -n .env.local.shopify.example .env
export SPRING_PROFILES_ACTIVE=dev
set -a
source .env
set +a
./mvnw spring-boot:run
```

Health check:
```bash
curl http://localhost:8080/actuator/health/readiness
```

## Terminal 3 — standalone frontend (only if validating standalone access)
```bash
cd /path/to/Forestock/forestock-frontend
npm install
npm run dev
```

## Terminal 4 — public tunnel
Use your preferred tunnel tool to expose the Shopify app port publicly over HTTPS.

Target:
- local app port: `3000`
- public URL: `https://<your-tunnel-host>`

## Terminal 5 — Shopify app
```bash
cd /path/to/Forestock/shopify-app
cp -n .env.local.example .env
# edit .env and set real Shopify credentials + tunnel URL
npm install
set -a
source .env
set +a
npm run dev
```

This now works through `npx shopify app dev`, so a global Shopify CLI install is optional.

## Before installing on dev store
Update Shopify app config so these match the current tunnel URL:
- application URL
- redirect/callback URLs

## Then run validation
Use:
- `docs/SHOPIFY_DEV_STORE_VALIDATION_PLAN.md`
- `docs/SHOPIFY_VALIDATION_EVIDENCE_TEMPLATE.md`
- `docs/SHOPIFY_SUBMISSION_TODO.md`
