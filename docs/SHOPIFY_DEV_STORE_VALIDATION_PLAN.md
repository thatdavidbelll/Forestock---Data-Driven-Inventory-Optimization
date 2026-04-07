# Shopify Dev-Store Validation Plan

## Goal
Validate that a Shopify merchant can:
1. install Forestock
2. complete provisioning cleanly
3. sync products, inventory, and orders correctly
4. optionally activate standalone web access
5. survive uninstall/reinstall without broken state

## Environment

### Target environment
- Shopify dev store
- local or non-production Forestock backend
- local or non-production Shopify app runtime
- non-production database only

### Prerequisites

#### Shopify side
- A Shopify dev store exists
- Forestock app is available to install on that dev store
- App config URLs/callbacks are wired to the environment being tested
- Test products, inventory, and historical orders exist or can be created

#### Forestock side
- Backend is running and reachable
- Embedded Shopify app runtime is reachable
- Database is isolated from production
- Mail/log visibility exists for activation/debugging
- Logs can be inspected during the run

#### Operator side
- One person owns the validation run
- One evidence location exists for screenshots, logs, copied responses, timestamps, and pass/fail notes

## Scenario 1 — Fresh install

### Objective
Prove a merchant can install the app and land in a sane setup state.

### Steps
1. Open the Shopify dev store
2. Install Forestock
3. Complete Shopify auth
4. Load the embedded app setup page
5. Wait for initial provisioning/bootstrap to complete

### Expected result
- App installs successfully
- No auth/callback loop
- Embedded app loads
- Store/workspace is provisioned
- Setup page shows meaningful status
- No raw crash/error screen

### Evidence to capture
- Screenshot of install completion
- Screenshot of embedded app setup page
- Backend log lines for provisioning
- DB evidence of store/workspace + Shopify connection creation

### Pass/fail
- Pass if install completes and merchant lands in usable setup state
- Fail if install breaks, loops, crashes, or leaves no linked workspace

## Scenario 2 — Catalog import on initial setup

### Objective
Prove products and inventory are imported into Forestock from Shopify.

### Steps
1. Ensure test products exist in the dev store
2. Install/load app as in scenario 1
3. Allow catalog sync/bootstrap to run
4. Inspect Forestock backend state

### Expected result
- Products processed
- Products created or updated in Forestock
- Inventory snapshots created where expected
- Setup page shows reasonable counts

### Evidence to capture
- Setup page screenshot
- Backend logs
- DB counts before/after for products and inventory rows/snapshots
- Any sync summary payloads

### Pass/fail
- Pass if representative products/inventory show up correctly
- Fail if catalog sync silently fails, duplicates wildly, or produces clearly wrong counts

## Scenario 3 — Historical order backfill

### Objective
Prove Forestock can ingest historical Shopify orders into sales history.

### Steps
1. Ensure dev store has representative historical orders
2. Load app/setup page
3. Allow order backfill to run
4. Inspect Forestock sales state

### Expected result
- Orders imported/backfilled
- Matched line items recorded
- Duplicate handling reasonable
- Sales rows written into Forestock

### Evidence to capture
- Setup page screenshot
- Order backfill counters
- Backend logs
- DB counts before/after for order rows and sales transactions

### Pass/fail
- Pass if order history lands in Forestock as expected
- Fail if backfill fails, duplicates uncontrollably, or does not populate sales meaningfully

## Scenario 4 — Ongoing webhook updates

### Objective
Prove live Shopify changes propagate after install.

### Steps
1. Create a product in Shopify
2. Update a product in Shopify
3. Delete a product in Shopify
4. Change an inventory level
5. Create a new order

### Expected result
- Each event reaches Forestock
- Corresponding backend action occurs
- No signature/auth failure
- Data remains consistent

### Evidence to capture
- Timestamps of Shopify actions
- Backend webhook/app logs
- Relevant DB rows before/after
- Failure logs if retries/errors happen

### Pass/fail
- Pass if webhook-driven changes are processed correctly
- Fail if events are dropped, rejected, or produce obviously bad data state

## Scenario 5 — Standalone access request + activation

### Objective
Prove the Shopify-first secondary web-access flow works.

### Steps
1. Identify the Shopify-provisioned admin user
2. Attempt standalone Forestock login before activation
3. Request standalone access
4. Capture activation link/token from email/log/dev channel
5. Open activation page
6. Set password
7. Log in to standalone Forestock

### Expected result
- Pre-activation login is blocked with a clear message
- Request endpoint succeeds generically
- Activation link works
- Password can be set
- Post-activation standalone login succeeds

### Evidence to capture
- Blocked-login screenshot/message
- Request response
- Activation page screenshot
- Post-activation login success
- DB evidence of state transition (enabled, activated timestamp, token cleared)

### Pass/fail
- Pass if the full flow works cleanly
- Fail if login gating, activation token flow, or final login breaks

## Scenario 6 — Embedded app as primary merchant surface

### Objective
Prove the merchant does not need standalone Forestock access for initial Shopify use.

### Steps
1. Install app
2. Stay entirely inside the Shopify embedded app
3. Confirm merchant can:
   - see setup state
   - understand what happened
   - understand what to do next

### Expected result
- Embedded app is sufficient for setup understanding
- Merchant is not forced into standalone login during initial journey
- Language is coherent and not prototype-ish

### Evidence to capture
- Screenshots
- Short usability notes
- Any operator confusion points

### Pass/fail
- Pass if merchant journey feels Shopify-first
- Fail if merchant would obviously be confused about where to go next

## Scenario 7 — Uninstall behavior

### Objective
Prove uninstall is handled cleanly.

### Steps
1. Uninstall Forestock from the dev store
2. Inspect backend state
3. Inspect logs
4. Confirm connection/lifecycle state is updated

### Expected result
- Uninstall webhook processed
- Shopify connection deactivated or disconnected appropriately
- No orphaned “active sync” illusion remains
- System doesn’t continue behaving as if store is live-connected

### Evidence to capture
- Shopify uninstall confirmation
- Backend logs
- DB state for shop connection before/after

### Pass/fail
- Pass if uninstall is reflected correctly
- Fail if connection remains falsely active or lifecycle handling breaks

## Scenario 8 — Reinstall behavior

### Objective
Prove reinstall does not create broken duplicate state.

### Steps
1. Reinstall the app after uninstall
2. Complete auth again
3. Inspect provisioning/linking behavior
4. Inspect sync behavior

### Expected result
- Existing store/workspace is reused or reconciled correctly
- Connection state becomes active again
- No bad duplicate tenant/user explosion
- Merchant lands in sane state

### Evidence to capture
- Reinstall screenshots
- Backend logs
- DB comparison before/after reinstall

### Pass/fail
- Pass if reinstall is clean and idempotent enough
- Fail if reinstall breaks linkage or duplicates critical entities

## Evidence checklist
For each scenario, capture:
- Timestamp
- Scenario name
- Expected result
- Actual result
- Pass/fail
- Screenshot(s)
- Relevant log excerpt(s)
- DB excerpt(s) if useful
- Unresolved notes

## Minimum Shopify GO checklist
Shopify should not move to GO until all of these are true:

### Must pass
- Fresh install
- Provisioning
- Catalog import
- Order backfill
- Webhook updates
- Uninstall
- Reinstall

### Must be at least acceptably validated
- Standalone access activation flow, if kept
- Embedded app merchant comprehension
- Scope sufficiency/minimization
- Support path for sync/provisioning issues

### Must be documented
- Support/runbook
- Merchant-impact notes for reinstall/scope changes
- Review/listing preparation

## Suggested execution order
1. Fresh install
2. Catalog import
3. Historical order backfill
4. Ongoing webhook updates
5. Standalone access activation
6. Uninstall
7. Reinstall
8. Final synthesis and gap list update

## Operator-friendly run sheet
- [ ] Install app on dev store
- [ ] Confirm setup page loads
- [ ] Confirm workspace/store linked
- [ ] Confirm products imported
- [ ] Confirm inventory imported
- [ ] Confirm orders backfilled
- [ ] Confirm new Shopify changes sync via webhooks
- [ ] Confirm standalone access flow works if needed
- [ ] Confirm uninstall handled cleanly
- [ ] Confirm reinstall handled cleanly
- [ ] Save screenshots/logs/DB notes
- [ ] Write final pass/fail summary
