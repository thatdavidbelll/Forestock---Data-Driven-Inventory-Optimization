# Final Launch Board

## Release Recommendation
- **Broad public launch:** NO-GO
- **Controlled beta / invited pilot:** GO SOON, WITH CONDITIONS

## Launch Mode Assumed
- Controlled beta / limited pilot
- Small set of invited merchants
- Manual onboarding and support
- Shopify is **OUT** for the first pilot unless a separate focused Shopify readiness pass is completed and approved

## Overall Readiness Snapshot
| Track | Status | Notes |
|---|---|---|
| Core backend product flow | Strong | CSV import → forecast → suggestions validated live in non-prod |
| Frontend integration | Moderate | Build/lint/typecheck pass; code path audit looks aligned; no real browser E2E proof yet |
| Auth / onboarding | Medium-Low | Login works, onboarding flow exists, but refresh/logout/rate-limit/email verification end-to-end still incomplete |
| Inventory / audit trust | Strong | Real bugs found, fixed, and covered with regression tests |
| Operations / readiness | Moderate | Actuator/readiness/liveness fixed; rollback exists; deploy/rollback rehearsal still limited |
| Shopify readiness | Low-Moderate | Real implementation exists, but production/app-review readiness is incomplete |
| Docs / release discipline | Strong | Launch docs, blockers, verification matrix, manual script, and changelog now exist |

## Go / No-Go Decision Matrix
### GO for controlled beta only if all conditions below are satisfied
- Pilot merchants are limited and invited
- Manual onboarding is acceptable
- Shopify is excluded from the first pilot
- Remaining critical auth/onboarding checks are completed or explicitly accepted
- One deploy/readiness/rollback rehearsal is completed

### NO-GO for broad public launch until these are closed
- Critical-path auth and onboarding validation
- Frontend/E2E confirmation of core journey
- Shopify launch readiness (if included)
- Rollback rehearsal and broader release confidence

## Current Blockers

### Blocker 1 — Incomplete critical-path validation
- **Severity:** Critical
- **Status:** Open
- **Owner:** Engineering / QA
- **Why it matters:** Full launch-critical flows are not yet validated together, especially onboarding token flows, cross-store isolation, and UI-level confirmation.
- **To close:**
  - validate email verification end to end
  - validate invite verify/accept end to end
  - validate tenant isolation and broader role boundaries
  - validate frontend/E2E import → forecast → suggestions journey

### Blocker 2 — Shopify production readiness incomplete
- **Severity:** High
- **Status:** Deferred from first pilot
- **Owner:** Shopify / Product
- **Why it matters:** Shopify app exists, but production URLs, live install/auth/webhooks, and merchant/review readiness are incomplete. This track is intentionally deferred from the first controlled pilot.
- **To close before any Shopify-inclusive launch:**
  - finalize production URLs and redirects
  - validate install/auth/webhooks end to end
  - confirm scopes and merchant impact
  - prepare review/listing/support readiness

### Blocker 3 — Rollback and deploy confidence incomplete
- **Severity:** High
- **Status:** Open
- **Owner:** Operations / Release
- **Why it matters:** CI/CD and readiness checks exist, but confidence is lower without a controlled rehearsal.
- **To close:**
  - rehearse backend deploy
  - rehearse readiness verification using `/actuator/health/readiness`
  - rehearse rollback procedure

### Blocker 4 — Auth/onboarding trust boundary validation incomplete
- **Severity:** High
- **Status:** Open
- **Owner:** Backend / QA
- **Why it matters:** The app is trust-sensitive; tenant isolation, role matrix, verification flow, and invite flow need stronger evidence.
- **To close:**
  - validate store A vs store B isolation
  - validate super admin/admin/manager/viewer matrix
  - validate verification and invite flows end to end

## Resolved During This Audit
- Launch docs pack created and populated
- README / deployment doc drift improved
- Inventory current-state bug fixed
- Audit-log list endpoint fixed
- Sales daily endpoint fixed
- Backend regression tests added for launch-critical fixes
- Spring Boot Actuator added
- Readiness/liveness health groups implemented and documented
- CSV import → forecast → suggestions validated live in non-prod

## Evidence Highlights
- Backend tests passing: 39 tests, 0 failures, 0 errors, 1 skipped
- Fresh Flyway migration apply validated on local non-prod PostgreSQL
- Valid login + store creation + store-admin auth validated
- Inventory update, history, and current-state validated after fix
- CSV import validated: 7 imported, 0 errors
- Forecast completion validated on imported data
- Suggestion generation validated with meaningful reorder output
- Audit logs validated for `PRODUCT_CREATED`, `INVENTORY_UPDATED`, `SALES_IMPORTED`
- `/actuator/health/readiness` and `/actuator/health/liveness` validated as `UP`

## Recommended Owners / Workstreams
### Engineering
- Close remaining rate-limit / verification-delivery validation
- Close any remaining role-matrix gaps if needed for pilot
- Add any remaining narrow regression tests as issues are found

### QA / Release
- Run remaining manual critical-path script
- Record pass/fail evidence per flow
- Rehearse deploy/readiness/rollback

### Product
- Decide launch scope: pilot only vs Shopify-inclusive pilot
- Keep MVP promise narrow and supportable

### Shopify
- Deferred from first pilot
- Revisit only after core pilot value is proven or a dedicated Shopify readiness milestone is scheduled

### Operations
- Ensure deploy checks use `/actuator/health/readiness`
- Confirm production config parity for readiness/liveness groups

## Immediate Next 7-Day Plan
1. Rehearse deploy + readiness + rollback once
2. Confirm remaining auth/onboarding gaps are either closed or explicitly accepted for pilot
3. Prepare pilot go-live checklist and assign owners
4. Select pilot merchants and pilot date target
5. Run one final pilot dry-run on the core import → forecast → suggestions journey
6. Keep Shopify out of pilot scope until a dedicated readiness milestone is completed

## Final Recommendation
Forestock should **not** do a broad public launch yet.
Forestock can move toward a **controlled beta / invited pilot** after the remaining auth/onboarding and operational rehearsal blockers are closed or explicitly accepted, with **Shopify excluded from the first pilot scope**.
