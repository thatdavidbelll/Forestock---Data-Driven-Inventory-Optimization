# Launch Blockers

## Status Legend
- Critical: blocks any launch
- High: blocks public launch, may allow limited internal testing
- Medium: should be addressed before broader rollout
- Low: acceptable with explicit acceptance

## Current Blockers

### 1. Missing launch operations documentation
- Severity: High
- Area: docs / operations
- Why it matters: Launch decisions are not yet backed by a consistent operating pack.
- Needed to close:
  - MVP scope documented
  - architecture doc added
  - Neon / AWS / Shopify operations docs added
  - rollback procedures documented
  - changelog process established

### 2. Incomplete critical-path validation
- Severity: Critical
- Area: QA / release
- Why it matters: Frontend has no visible automated E2E coverage and full system critical flows are not yet validated together. Backend startup, migrations, inventory current-state, CSV import, forecast completion, suggestions, sales daily-series, audit-log retrieval, refresh, logout, and production-safe report/export endpoints now work, but onboarding still relies on completing email/invite token flows and broader UI/system flow coverage remains incomplete. For the first invited pilot, this residual auth/onboarding risk is accepted only because onboarding will remain manual and supervised rather than self-serve.
- Needed to close:
  - complete email verification flow for newly created store admins
  - complete invite verify/accept flow end to end
  - validate tenant isolation across multiple stores with authenticated users in both stores
  - suggestion review validation in the UI
  - Shopify install/sync validation if included in launch
  - frontend/E2E confirmation of the import → forecast → suggestions journey

### 3. Shopify production readiness incomplete
- Severity: High
- Area: Shopify / product / operations
- Why it matters: Shopify config/operator readiness is improving, but launch/review readiness is still incomplete and merchant install/runtime behavior is not yet validated end to end.
- Needed to close:
  - verify scopes are minimal and sufficient
  - verify webhook subscriptions end to end
  - validate Shopify install → provisioning → sync → usable merchant state
  - validate standalone-access activation flow if secondary web access remains supported
  - document merchant impact and reinstall implications
  - prepare support / listing / review materials if App Store launch is planned

### 4. Backend verification only partially completed
- Severity: Medium
- Area: backend / QA
- Why it matters: Backend automated tests now pass locally under Java 21, non-prod startup plus fresh migrations succeeded locally, and Actuator readiness/liveness are now correctly exposed. Remaining work is broader flow coverage and production policy decisions rather than a missing health endpoint. Local evidence also confirms newly created admins are blocked before email verification, but full verification/invite completion remains open.
- Needed to close:
  - validate key endpoints beyond login/admin-store listing
  - decide whether overall `/actuator/health` should continue to include mail in each environment
  - execute remaining manual critical-path checks from `docs/MANUAL_TEST_SCRIPT.md`

### 5. Documentation contains environment-specific infrastructure details
- Severity: Medium
- Area: security / docs
- Why it matters: Deployment documentation contains concrete provider endpoints and account-specific examples that should be generalized.
- Needed to close:
  - replace environment-specific values with placeholders
  - move sensitive or changing values to local-only config paths or examples

### 6. Repo and docs drift
- Severity: Medium
- Area: docs / repo structure
- Why it matters: Root docs do not accurately describe all major app surfaces.
- Needed to close:
  - document Shopify app in repository structure and architecture docs
  - clarify relationship between root frontend and backend/frontend directory

## Open Questions
- Is launch goal a controlled pilot, private beta, or broader public launch?
- Is Shopify App Store submission part of the first launch or a later milestone?
- Is production backend target staying EC2 + Neon for launch, or moving before public rollout?

## Exit Criteria
This blocker list can move to launch-ready only when all Critical blockers are closed and High blockers are either closed or explicitly accepted with owner and date.
