# Shopify Paste-Run Checklist

Use this when you want the shortest path from zero to a Shopify dev-store validation run.

## 0. Fill the env files first
Create and edit these files before starting anything:

```bash
cp -n /home/davidbell/.openclaw/workspace/Forestock/forestock-backend/.env.local.shopify.example /home/davidbell/.openclaw/workspace/Forestock/forestock-backend/.env
cp -n /home/davidbell/.openclaw/workspace/Forestock/shopify-app/.env.local.example /home/davidbell/.openclaw/workspace/Forestock/shopify-app/.env
```

You must edit:
- `forestock-backend/.env`
  - `JWT_SECRET`
  - `SUPER_ADMIN_PASSWORD`
- `shopify-app/.env`
  - `SHOPIFY_API_KEY`
  - `SHOPIFY_API_SECRET`
  - `SHOPIFY_APP_URL`

If you will test standalone access, make sure:
- `FORESTOCK_FRONTEND_URL=http://localhost:5173`

---

## 1. Terminal A — backend dependencies
```bash
cd /home/davidbell/.openclaw/workspace/Forestock/forestock-backend
docker compose up -d
```

If Docker is healthy, PostgreSQL should bind to `5432` and Redis to `6379`.

---

## 2. Terminal B — backend
```bash
cd /home/davidbell/.openclaw/workspace/Forestock/forestock-backend
export SPRING_PROFILES_ACTIVE=dev
set -a
source .env
set +a
./mvnw spring-boot:run
```

Wait for startup to finish, then verify:
```bash
curl http://localhost:8080/actuator/health/readiness
```

Expected: JSON with status `UP`.

---

## 3. Terminal C — optional standalone frontend
Only needed for standalone-access activation/login validation.

```bash
cd /home/davidbell/.openclaw/workspace/Forestock/forestock-frontend
npm install
npm run dev
```

Expected local URL:
- `http://localhost:5173`

---

## 4. Terminal D — start your tunnel
Expose the Shopify app port publicly over HTTPS.

Target local port:
- `3000`

Target public URL shape:
- `https://<your-tunnel-host>`

Once you have the public URL:
- update `shopify-app/.env` → `SHOPIFY_APP_URL=https://<your-tunnel-host>`
- update Shopify app config in Partner Dashboard or CLI to match this URL and callbacks

---

## 5. Terminal E — Shopify app
```bash
cd /home/davidbell/.openclaw/workspace/Forestock/shopify-app
npm install
set -a
source .env
set +a
npm run dev
```

Note: `npm run dev` now uses `npx shopify app dev`, so a global Shopify CLI install is not required.

If the app boots, keep this terminal open.

---

## 6. Quick local checks
Backend:
```bash
curl http://localhost:8080/actuator/health/readiness
```

Standalone frontend (optional):
```bash
curl -I http://localhost:5173
```

Shopify app local port:
```bash
curl -I http://localhost:3000
```

---

## 7. Shopify config check before install
Make sure these point at the active tunnel URL:
- application URL
- auth callback URL: `/auth/callback`
- auth callback URL: `/auth/shopify/callback`

If these don’t match the active tunnel, install/auth will waste your time.

---

## 8. Run validation
Use:
- `/home/davidbell/.openclaw/workspace/Forestock/docs/SHOPIFY_DEV_STORE_VALIDATION_PLAN.md`
- `/home/davidbell/.openclaw/workspace/Forestock/docs/SHOPIFY_VALIDATION_EVIDENCE_TEMPLATE.md`

Track remaining submission gaps in:
- `/home/davidbell/.openclaw/workspace/Forestock/docs/SHOPIFY_SUBMISSION_TODO.md`

---

## 9. If something breaks, triage in this order
1. backend readiness fails
2. Shopify app env is missing/incorrect
3. tunnel URL does not match Shopify app config
4. provisioning secret mismatch
5. backend not reachable from Shopify app runtime
6. no representative Shopify test data exists

---

## 10. Minimum success state before touching the dev store
- [ ] backend readiness returns `UP`
- [ ] Shopify app is running locally
- [ ] tunnel URL is live over HTTPS
- [ ] Shopify app config matches the tunnel URL
- [ ] Shopify app env contains real credentials
