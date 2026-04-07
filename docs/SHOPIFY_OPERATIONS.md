# Shopify Operations

## Purpose
Track Forestock’s Shopify integration operating model and launch readiness requirements.

## Current Implementation Shape
- Embedded Shopify app exists in `shopify-app`
- Shopify auth/session storage is managed through Prisma-backed session storage
- Webhooks are registered after auth
- Forestock backend exposes Shopify-facing provisioning and sync endpoints protected by a shared integration secret

## Current Observed Webhook / Sync Surfaces
- App uninstalled
- App scopes update
- Products create / update / delete
- Inventory levels update
- Orders create

## Current Readiness Risks
- `shopify.app.toml` still contains placeholder application and redirect URLs
- Merchant onboarding and install flow have not yet been fully validated in this audit
- App review and listing readiness are not documented
- Scope sufficiency / minimization should be re-checked before launch

## Pre-Launch Checklist
- Finalize production application URL and auth redirect URLs
- Confirm required scopes are minimal and sufficient
- Validate install, reinstall, and uninstall flows
- Validate webhook signature handling and replay/error behavior
- Validate order/product/inventory sync behavior against representative merchant data
- Document merchant impact of scope changes and reinstall requirements
- Prepare support path for sync failures and uninstall cleanup

## Merchant Impact Notes
Any change to scopes, install behavior, or provisioning flow can affect:
- whether merchants must reinstall
- whether Shopify review/re-approval is triggered
- whether sync downtime or partial sync states occur

## Launch Recommendation
If Shopify is part of the first launch, treat it as its own readiness track with explicit validation evidence and support procedures.
