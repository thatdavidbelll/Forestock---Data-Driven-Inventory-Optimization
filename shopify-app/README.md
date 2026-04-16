# Forestock Shopify App

This directory contains Forestock’s embedded Shopify app.

It is no longer just a raw template scaffold: it now contains Forestock-specific install, provisioning, sync, and webhook behavior intended to make Shopify the primary merchant-facing surface when Shopify is in scope.

## Current behavior

The app currently supports:

- Shopify embedded app authentication
- Prisma-backed Shopify session storage
- automatic webhook registration after auth
- initial Forestock workspace provisioning for the connected shop
- initial catalog and inventory bootstrap into Forestock
- recent 60-day Shopify order backfill into Forestock
- webhook-driven product, inventory, order, scope-update, and uninstall handling

## Merchant model

Forestock’s intended Shopify posture is:

- merchants install and access Forestock primarily through the embedded Shopify app
- Shopify install links or provisions the Forestock workspace behind the scenes
- standalone Forestock access is secondary and support-oriented unless explicitly promoted later

## Local development

Prerequisites:

- Node.js 20+
- Shopify CLI
- a Shopify app configured in the Partner Dashboard
- a reachable Forestock backend
- a PostgreSQL-compatible database for Prisma session storage

Install dependencies:

```bash
cd shopify-app
npm install
```

Start local development:

```bash
npm run dev
```

Fastest current local setup from repo root:

```bash
cd /path/to/Forestock
bash scripts/shopify-local-bootstrap.sh
```

Then:
- fill `shopify-app/.env` with real Shopify credentials and a public HTTPS `SHOPIFY_APP_URL`
- run the backend in `forestock-backend/`
- run `npm run dev` in `shopify-app/`

Release-gate checks:

```bash
npm run typecheck
npm run lint
npm run build
```

## Runtime configuration

See `.env.local.example` for the required variables.

Key values:

- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`
- `SHOPIFY_APP_URL`
- `SCOPES`
- `DATABASE_URL`
- `FORESTOCK_API_BASE_URL`
- `FORESTOCK_PROVISIONING_SECRET`

## Session storage direction

The Shopify app uses its own Prisma session store, separate from the backend business data model.

Recommended production direction:

- keep canonical Shopify business data in the backend PostgreSQL database
- use a dedicated PostgreSQL/Neon database or schema for Shopify app sessions
- do not rely on SQLite for production session storage

If the Partner app identity changes, such as switching to a new custom distribution app,
expect to uninstall and reinstall on the dev store so embedded auth/session state resets cleanly.

## Important files

- `shopify.app.toml` — app name, URLs, scopes, and webhook subscriptions
- `shopify.web.toml` — Shopify CLI web app settings
- `prisma/schema.prisma` — Shopify session storage schema
- `app/shopify.server.ts` — core Shopify app server configuration
- `app/forestock.server.ts` — Forestock backend integration client
- `app/routes/app._index.tsx` — embedded setup/status page
- `app/routes/webhooks.*.tsx` — webhook handlers

## Readiness notes

This package can currently pass local build/lint/typecheck gates, but Shopify launch readiness still depends on live dev-store validation.

Before calling Shopify launch-ready, verify:

- install/auth on a real dev store
- provisioning/linking behavior
- catalog import
- recent 60-day order backfill
- webhook-driven updates
- uninstall/reinstall behavior
- merchant comprehension of the embedded setup flow

Supporting docs live in the repo root under `docs/`, especially:

- `docs/SHOPIFY_DEV_STORE_VALIDATION_PLAN.md`
- `docs/SHOPIFY_LAUNCH_CLOSURE_SPRINT.md`
- `docs/SHOPIFY_OPERATIONS.md`
