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

## Merchant Impact Notes
Any change to scopes, install behavior, or provisioning flow can affect:
- whether merchants must reinstall
- whether Shopify review/re-approval is triggered
- whether sync downtime or partial sync states occur

## Launch Recommendation
If Shopify is part of launch, treat it as its own readiness track with explicit validation evidence and support procedures. The target product posture is Shopify-first for merchants, with the embedded app acting as the primary setup and status surface.
