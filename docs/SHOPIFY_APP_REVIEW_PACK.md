# Shopify App Review Pack

## Purpose
Prepare the minimum viable listing/review material needed to move Forestock from Shopify hardening into a defensible submission posture.

This document is intentionally practical. It is meant to answer:
- what Forestock does
- why Shopify merchants would install it
- what access it needs
- what a Shopify reviewer should expect during install and first use
- what still needs to be supplied before submission

## Submission Status
- **Current posture:** Not yet ready for submission without live dev-store validation evidence
- **Target next posture:** Limited Shopify pilot GO or reviewer-ready private/custom submission
- **Public App Store posture:** only after validation evidence and support materials are complete

## App positioning statement
Forestock helps Shopify merchants turn sales history, catalog data, and stock levels into practical restocking decisions.

The embedded Shopify app links the merchant’s store to Forestock, imports product and inventory data, backfills the recent 60 days of order history, and prepares the data needed for forecasting and replenishment recommendations.

## Concise merchant value proposition
Install Forestock to connect your Shopify store, sync your catalog and the recent 60 days of order history, and prepare smarter restocking insights without manual data wrangling.

## Short listing copy draft
### App name
Forestock

### One-line summary
Inventory forecasting and restocking support for Shopify merchants.

### Short description
Forestock connects to your Shopify store, imports product, inventory, and the recent 60 days of order history, and helps you prepare clearer restocking decisions using sales-driven forecasting.

### Longer description draft
Forestock is designed for merchants who want better visibility into what to restock and when to act.

After installation, Forestock links your Shopify store, prepares a Forestock workspace, imports catalog and inventory data, and backfills the recent 60 days of Shopify order history. That data can then be used to power forecasting and replenishment workflows.

Forestock is intended to reduce spreadsheet-heavy inventory review and give operators a clearer starting point for restocking decisions.

## First-run reviewer notes draft
When the app is opened after installation, the embedded app will:
1. authenticate the merchant through Shopify
2. provision or link the merchant’s Forestock workspace
3. import product and inventory data
4. backfill the recent 60 days of Shopify order history
5. display setup and sync status in the embedded app

The first-run experience is currently centered on setup/status confirmation rather than a deep in-app workflow.

## Current embedded app merchant flow
1. Merchant installs Forestock in Shopify
2. Merchant lands in the embedded Forestock setup page
3. Forestock shows:
   - shop identity
   - workspace provisioning result
   - catalog/inventory sync result
   - historical order import result
4. Merchant remains in Shopify as the primary surface
5. Manual support may still assist during pilot/hardening stages

## Access scopes and justification
### Current scopes
- `read_products`
- `read_inventory`
- `read_orders`

### Why these scopes are needed
- `read_products` — to import product catalog structure and variant data
- `read_inventory` — to import and update stock state from Shopify inventory records
- `read_orders` — to backfill and process the recent 60 days of sales/order history for forecasting and replenishment workflows

### Scope minimization note
Forestock is currently scoped for read-driven synchronization from Shopify into Forestock. The current public-scope posture avoids requesting `read_all_orders` and avoids pulling customer-identifying fields in the Shopify app flow. No write scopes are requested in the current app configuration.

## Webhooks in use
- `app/uninstalled`
- `app/scopes_update`
- `products/create`
- `products/update`
- `products/delete`
- `inventory_levels/update`
- `orders/create`

## Reviewer walkthrough checklist
A reviewer should be able to verify:
- app install succeeds
- auth completes without callback loops
- embedded app loads successfully
- a setup/status page is shown
- the app can explain what it is doing during provisioning/sync
- uninstall is handled cleanly

## Review-risk checklist
### Product / UX
- [ ] Embedded app language is reviewer-friendly and not prototype-ish
- [ ] Setup page clearly explains what happened and what happens next
- [ ] Error states are understandable

### Runtime
- [ ] Fresh install validated on a dev store
- [ ] Provisioning validated on a dev store
- [ ] Catalog import validated on a dev store
- [ ] Historical order backfill validated on a dev store
- [ ] Webhook updates validated on a dev store
- [ ] Uninstall validated on a dev store
- [ ] Reinstall validated on a dev store

### Compliance / operations
- [ ] Privacy policy URL available
- [ ] Support contact available
- [ ] App support process documented
- [ ] Merchant-impact notes for reinstall/scope changes documented

## Assets still needed before submission
- [ ] Final app icon / brand asset set
- [ ] Embedded app screenshots from a real dev-store run
- [ ] Optional short demo video or reviewer screencast plan
- [ ] Deploy privacy policy page to the final public domain
- [ ] Deploy support page to the final public domain
- [ ] Reviewer test instructions if special setup is required

## Suggested screenshot set
1. App install / permission screen
2. First successful embedded setup page
3. Store setup status block
4. Catalog and inventory import status block
5. Sales history import status block
6. Any follow-up screen that demonstrates merchant value after setup

## Support / contact placeholders
Deploy these routes on the final public web domain before submission:
- **Support email:** `support@forestock.app`
- **Support route:** `/support`
- **Privacy policy route:** `/privacy-policy`
- **Terms of service route:** `/terms-of-service`
- **App website / marketing URL:** still needed

## Honest current recommendation
Forestock is not yet ready for confident Shopify public submission purely on the basis of local code health.

It is ready for the next closure step:
- dev-store validation
- review-pack completion
- support/runbook completion
- final GO / limited pilot GO / NO-GO decision

## Exit criteria for submission-ready status
Forestock should only move to submission-ready when all are true:
- live dev-store validation evidence exists for install, sync, webhook, uninstall, and reinstall flows
- merchant-facing copy is coherent
- support/contact/privacy artifacts exist
- scope justification is documented
- known risks are either fixed or explicitly accepted
