# Shopify Operations

## Purpose
Track Forestock’s Shopify integration operating model and launch readiness requirements.

## Companion Docs
- `docs/SHOPIFY_DEV_STORE_VALIDATION_PLAN.md` — executable runtime validation checklist for a Shopify dev store
- `docs/SHOPIFY_LAUNCH_CLOSURE_SPRINT.md` — sprint-level execution plan for moving Shopify from NO-GO toward GO or limited pilot GO

## Current Implementation Shape
- Embedded Shopify app exists in `shopify-app`
- Shopify auth/session storage is managed through Prisma-backed session storage
- Webhooks are registered after auth
- Forestock backend exposes Shopify-facing provisioning and sync endpoints protected by a shared integration secret

## Intended Merchant Access Model
- **Shopify-first for merchants**: the embedded Shopify app is the primary merchant interface
- Shopify install should provision/link the Forestock workspace behind the scenes
- Merchants should not need standalone Forestock credentials during initial Shopify onboarding
- Standalone Forestock access remains secondary/support-oriented unless a later product decision promotes it explicitly
- Standalone web access is now being scaffolded as an explicit activation flow for Shopify-provisioned admins rather than an automatic credential handoff

## Current Observed Webhook / Sync Surfaces
- App uninstalled
- App scopes update
- Products create / update / delete
- Inventory levels update
- Orders create

## Current Readiness Risks
- Merchant onboarding and install flow have not yet been fully validated in this audit
- App review and listing readiness are not documented
- Scope sufficiency / minimization should be re-checked before launch
- Merchant access/account model is now partially scaffolded in code, but still needs end-to-end UX/runtime validation and rollout planning before launch
- App home loader still performs heavy provisioning + sync work automatically on page load and may need a more controlled install/status flow before launch

## Pre-Launch Checklist
- Finalize production application URL and auth redirect URLs
- Confirm required scopes are minimal and sufficient
- Validate install, reinstall, and uninstall flows
- Validate webhook signature handling and replay/error behavior
- Validate order/product/inventory sync behavior against representative merchant data
- Confirm merchant-facing access model remains Shopify-first and document any support-only standalone access path
- Validate standalone-access activation flow (request → email/token → activation → standalone login) if standalone web access remains supported for Shopify merchants
- Document merchant impact of scope changes and reinstall requirements
- Prepare support path for sync failures and uninstall cleanup
- Prepare app review/listing artifacts in `docs/SHOPIFY_APP_REVIEW_PACK.md`

## Support Runbook Starter
### Install or auth fails
- Confirm `SHOPIFY_APP_URL` matches the deployed embedded app URL
- Confirm callback URLs in `shopify.app.toml` match the deployed environment
- Inspect Shopify app runtime logs for callback/auth loop failures
- Confirm Prisma session storage is reachable and writable

### Provisioning fails after install
- Inspect embedded app setup page for the surfaced provisioning error
- Confirm `FORESTOCK_API_BASE_URL` is reachable from the Shopify app runtime
- Confirm `FORESTOCK_PROVISIONING_SECRET` matches the backend expectation
- Inspect backend logs for `/api/shopify/provision`
- Verify a workspace/store link was created or safely rejected without duplication

### Catalog or order sync fails
- Inspect setup-page counters and surfaced error text
- Inspect backend logs for `/api/shopify/catalog-sync` and `/api/shopify/order-backfill`
- Verify Shopify data exists in the test store for the expected period
- Check whether duplicates, empty imports, or matching failures occurred

### Webhook updates fail
- Confirm webhook subscriptions are registered after auth
- Inspect Shopify delivery status and app runtime logs
- Inspect backend endpoints for product, inventory, and order sync handling
- Confirm shared-secret configuration is still correct between app and backend

### Uninstall or reinstall behaves oddly
- Confirm uninstall webhook was received and processed
- Verify session cleanup and backend disconnect state were applied
- On reinstall, verify the existing Forestock workspace is reused or reconciled cleanly rather than duplicated

### What support should tell the merchant
- Forestock setup begins inside Shopify and may take a short time while product, inventory, and order history are prepared
- If setup cannot complete automatically, support can inspect the linked workspace and sync status without asking the merchant to repeat unnecessary steps
- Reinstall or scope changes may require reauthorization depending on the final launch configuration

## Merchant Impact Notes
Any change to scopes, install behavior, or provisioning flow can affect:
- whether merchants must reinstall
- whether Shopify review/re-approval is triggered
- whether sync downtime or partial sync states occur

## Launch Recommendation
If Shopify is part of launch, treat it as its own readiness track with explicit validation evidence and support procedures. The target product posture is Shopify-first for merchants, with the embedded app acting as the primary setup and status surface.

## Dedicated Host Planning
If Forestock promotes the Shopify app to its own production-ish hostname, prefer a dedicated host such as `portal.forestock.ro` rather than reusing the main Forestock frontend host. See `docs/SHOPIFY_AWS_NGINX_SETUP_GUIDE.md` for a supervised AWS + Nginx implementation guide and risk framing.

## Deployment Strategy
The current recommended deployment strategy for Shopify is:
- build on GitHub Actions runners
- package a runtime-ready artifact
- upload the artifact to EC2
- unpack into a dedicated Shopify runtime directory
- restart a systemd service

Do not rely on `npm install` or `npm run build` on the EC2 host for Shopify deployment because the current instance is not a reliable build machine for this app.

Runtime note: the deployed Shopify service requires a non-empty `SHOPIFY_APP_URL`. If that secret is empty or malformed in GitHub Actions, the service will fail during Shopify app initialization with an `empty appUrl configuration` error.
