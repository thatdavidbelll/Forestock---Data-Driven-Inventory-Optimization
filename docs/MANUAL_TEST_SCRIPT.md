# Manual Test Script

## Purpose
Provide a structured manual validation script for Forestock’s launch-critical flows.

## How to Use
- Execute these tests in a non-production environment first
- Record pass/fail notes, screenshots, and timestamps
- If a test fails, log the exact failure and stop before proceeding into dependent flows
- Cross-reference results into `docs/VERIFICATION_MATRIX.md`

## Preconditions
- Backend is running in a non-production environment
- Frontend is running against the intended backend
- Test database is initialized with current migrations
- Required environment variables are configured
- Test users and stores are available, or setup steps below are completed
- If Shopify flows are in scope, a test shop and app config are available

## Evidence to Capture
For each test, record:
- environment used
- date/time
- tester
- expected result
- actual result
- screenshots or logs if relevant
- follow-up issue if failed

## Section A — Authentication

### A1. Valid login
**Priority:** Critical  
**Goal:** Confirm a valid user can log in and reach the correct landing page.

Steps:
1. Open login page
2. Enter valid credentials for a store-scoped user
3. Submit login form
4. Confirm redirect to dashboard or role-appropriate landing page

Expected:
- Login succeeds
- JWT/session is established
- No unexpected error banners
- User sees store-scoped application shell

### A2. Invalid login
**Priority:** Critical  
**Goal:** Confirm invalid credentials are rejected safely.

Steps:
1. Attempt login with wrong password
2. Attempt login with unknown username

Expected:
- Request is rejected
- No sensitive internals are exposed
- UI shows understandable error

### A3. Refresh / session continuity
**Priority:** Critical  
**Goal:** Confirm session continuity works without forcing unnecessary logout.

Steps:
1. Log in successfully
2. Navigate through several authenticated pages
3. If possible, simulate access-token expiry or wait for refresh behavior path
4. Confirm app remains usable or reauths correctly

Expected:
- Session refresh succeeds or fails gracefully
- User is not silently stranded in broken auth state

### A4. Logout
**Priority:** Critical  
**Goal:** Confirm logout invalidates access appropriately.

Steps:
1. Log in
2. Use logout action
3. Attempt to access a protected route again
4. If possible, retry an authenticated API request with old token/session

Expected:
- User is returned to login page or public route
- Protected routes are no longer accessible
- Old token/session should not remain valid where blacklist is enabled

### A5. Password reset
**Priority:** High  
**Goal:** Confirm forgot/reset password flow works.

Steps:
1. Open forgot password page
2. Request reset for a known account
3. Retrieve reset email/link in test environment
4. Complete password reset
5. Log in with new password

Expected:
- Reset request is accepted safely
- Reset link works once and within expected constraints
- New password allows login

### A6. Email verification
**Priority:** High  
**Goal:** Confirm unverified accounts are gated until verification completes.

Steps:
1. Create or identify an unverified user
2. Attempt login
3. Complete verification link flow
4. Attempt login again

Expected:
- Unverified user is blocked with clear messaging
- Verified user can log in normally

## Section B — Tenant Isolation and Permissions

### B1. Store data isolation
**Priority:** Critical  
**Goal:** Confirm one store cannot access another store’s data.

Steps:
1. Create or use two stores: Store A and Store B
2. Log in as Store A admin
3. View products, inventory, sales, suggestions
4. Repeat as Store B admin
5. Attempt direct URL/API access to cross-store records if feasible

Expected:
- Each store sees only its own data
- Cross-store access is denied or returns no data

### B2. Role restrictions
**Priority:** Critical  
**Goal:** Confirm role boundaries in UI and API.

Steps:
1. Test as super admin
2. Test as store admin
3. Test as manager
4. Test as viewer
5. Attempt restricted actions for each role

Expected:
- Super admin can access platform admin features only intended for that role
- Admin can manage store users/config
- Manager can operate within allowed business workflows
- Viewer is read-only and blocked from mutating actions

## Section C — Onboarding and User Management

### C1. Create store and initial admin
**Priority:** Critical  
**Goal:** Confirm platform onboarding flow works for new store creation.

Steps:
1. Log in as super admin
2. Create a new store and first admin
3. Verify store appears in platform admin view
4. Verify initial admin receives verification/invite path as expected

Expected:
- Store and first admin are created correctly
- No duplicate/invalid state is introduced

### C2. Invite additional user
**Priority:** High  
**Goal:** Confirm team invite lifecycle works.

Steps:
1. Log in as store admin
2. Invite a new user with manager or viewer role
3. Retrieve invite link
4. Accept invite
5. Confirm invited user can log in with correct role

Expected:
- Invite is issued, accepted, and reflected correctly
- New user gets correct permissions

## Section D — Product, Inventory, and Sales Data

### D1. Product management
**Priority:** High  
**Goal:** Confirm products can be created/updated/viewed as expected.

Steps:
1. Log in as authorized store user
2. Create a product
3. Edit product fields
4. Verify product appears in list and detail views

Expected:
- Product state persists correctly
- Unauthorized roles cannot mutate products

### D2. Inventory updates
**Priority:** Critical  
**Goal:** Confirm inventory changes are stored and shown correctly.

Steps:
1. Open inventory page
2. Adjust stock for a product
3. Save update
4. Refresh page and verify current stock

Expected:
- Inventory update persists
- UI reflects latest stock without cross-store leakage

### D3. Sales CSV import
**Priority:** Critical  
**Goal:** Confirm representative sales import works and handles errors clearly.

Steps:
1. Open import page
2. Upload representative CSV sample
3. Review preview if available
4. Confirm import
5. Check resulting sales data / dashboard updates

Expected:
- Valid rows are ingested correctly
- Invalid rows produce understandable error handling
- Data lands in correct store scope

## Section E — Forecasting and Suggestions

### E1. Forecast generation
**Priority:** Critical  
**Goal:** Confirm a forecast run completes successfully.

Steps:
1. Ensure sufficient sales history exists
2. Trigger forecast generation
3. Monitor UI / API state until completion
4. Review resulting forecast status

Expected:
- Forecast completes without unhandled error
- Result is associated with correct store and run state

### E2. Edge-case forecasting sanity
**Priority:** High  
**Goal:** Confirm low-history or sparse data behavior is sensible.

Steps:
1. Use a store or dataset with limited history
2. Trigger forecast generation
3. Compare behavior with expected fallback logic

Expected:
- App handles sparse data gracefully
- No crash or nonsense output without warning

### E3. Suggestion generation and review
**Priority:** Critical  
**Goal:** Confirm suggestions appear after forecast and are understandable.

Steps:
1. Complete forecast generation
2. Open suggestions page
3. Review recommended reorder quantities and urgency
4. Acknowledge one or more suggestions if supported

Expected:
- Suggestions load correctly
- Acknowledgement state persists
- Output is store-scoped and human-readable

## Section F — Dashboard, Reporting, and Audit

### F1. Dashboard accuracy sanity check
**Priority:** High  
**Goal:** Confirm dashboard reflects imported and forecasted data plausibly.

Steps:
1. Record baseline dashboard values
2. Import or update data
3. Run forecast if relevant
4. Re-check dashboard

Expected:
- Dashboard changes align with test actions
- No obviously stale or contradictory numbers

### F2. Export/report generation
**Priority:** Medium  
**Goal:** Confirm report/export endpoints work for authorized users.

Steps:
1. Trigger available export/report actions
2. Download generated artifact if applicable
3. Open file and inspect contents

Expected:
- File is generated successfully
- Data appears correct for current store and role

### F3. Audit log capture
**Priority:** High  
**Goal:** Confirm sensitive actions appear in audit logs.

Steps:
1. Perform representative actions (login, product change, inventory update, invite, etc.)
2. Open audit log page or endpoint
3. Verify entries exist with expected action metadata

Expected:
- Relevant actions appear in audit log
- Entries are store-scoped and understandable

## Section G — Deploy / Operations Sanity

### G1. Backend health check
**Priority:** High  
**Goal:** Confirm backend exposes healthy status after startup/deploy.

Steps:
1. Start deployed backend
2. Query health endpoint

Expected:
- Health endpoint returns success state

### G2. Frontend smoke check after build/deploy
**Priority:** High  
**Goal:** Confirm frontend loads and can complete basic navigation.

Steps:
1. Load deployed frontend
2. Open login page
3. Sign in
4. Navigate dashboard, inventory, suggestions

Expected:
- No blank screens or broken route transitions

### G3. Rollback rehearsal (non-production)
**Priority:** High  
**Goal:** Confirm rollback procedure is usable.

Steps:
1. Identify current known-good build
2. Simulate deployment of changed build in non-prod
3. Execute rollback procedure
4. Re-run smoke checks

Expected:
- Rollback restores service within acceptable time
- Health and critical routes recover

## Section H — Shopify (If Included in Launch)

### H1. Install/auth flow
**Priority:** Critical if Shopify in launch  
**Goal:** Confirm merchant can install and authenticate successfully.

Steps:
1. Start from test Shopify store
2. Install app
3. Complete auth flow
4. Confirm Forestock side provisions or links correctly

Expected:
- Install succeeds
- Auth completes
- Merchant lands in expected post-install experience

### H2. Webhook verification
**Priority:** Critical if Shopify in launch  
**Goal:** Confirm webhooks are accepted only when valid and processed correctly.

Steps:
1. Trigger representative webhook events from test store
2. Observe backend/app processing
3. Inspect logs or UI effects

Expected:
- Valid webhooks are processed
- Invalid signatures are rejected
- Failures are observable

### H3. Product/order/inventory sync
**Priority:** Critical if Shopify in launch  
**Goal:** Confirm synced commerce data lands correctly in Forestock.

Steps:
1. Create/update/delete test product in Shopify
2. Create test order
3. Change inventory level
4. Verify corresponding Forestock data changes

Expected:
- Sync is timely and accurate
- Duplicate handling/idempotency is acceptable

### H4. Uninstall / disconnect cleanup
**Priority:** High if Shopify in launch  
**Goal:** Confirm uninstall leaves Forestock in a safe, understandable state.

Steps:
1. Uninstall app from test shop
2. Observe webhook/disconnect handling
3. Verify Forestock connection status updates appropriately

Expected:
- Connection state is updated
- No misleading active integration remains

## Sign-off Template
- Environment:
- Tester:
- Date:
- Scope executed:
- Passed:
- Failed:
- Blocked:
- Follow-up issues:
- Recommendation: not ready / ready for staging verification / ready for controlled rollout
