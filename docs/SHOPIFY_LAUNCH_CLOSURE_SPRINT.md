# Shopify Launch-Closure Sprint

## Sprint Goal
Move Shopify from:
- **NO-GO / hardening**

to either:
- **GO with explicit conditions**
- **limited pilot GO**
- **NO-GO with exact remaining blockers**

based on dev-store evidence, not optimism.

## Recommended Sprint Duration
- 3–5 focused working days, or equivalent concentrated effort

## Core Principle
This sprint is designed to produce evidence, not just more code.

## Workstreams

### Workstream 1 — Dev-store runtime validation

#### Owner
- QA / Shopify / Backend

#### Goal
Execute `docs/SHOPIFY_DEV_STORE_VALIDATION_PLAN.md` and capture real runtime evidence.

#### Required scenarios
1. Fresh install
2. Provisioning
3. Catalog import
4. Order backfill
5. Webhook-driven updates
6. Standalone access activation
7. Uninstall
8. Reinstall

#### Deliverables
- Pass/fail table
- Screenshots
- Logs
- DB notes
- Runtime bug list

#### Exit criteria
- All scenarios executed
- Each scenario marked pass / fail / pass with caveat

### Workstream 2 — Runtime bug-fix loop

#### Owner
- Backend / Frontend / Shopify

#### Goal
Fix only the bugs found in dev-store validation, in tight loops.

#### Rules
- Prioritize launch blockers only
- Avoid speculative refactors
- Keep commits narrow
- Revalidate after each fix

#### Typical issue classes
- Callback/auth issues
- Provisioning mismatches
- Sync failures
- Webhook handling errors
- Install/reinstall duplication
- Merchant confusion on setup page
- Standalone activation issues

#### Deliverables
- Bug-fix commits
- Updated test coverage where reasonable
- Updated changelog/docs

#### Exit criteria
- Validation-blocking issues fixed or explicitly accepted

### Workstream 3 — Shopify support/runbook readiness

#### Owner
- Documentation / Ops / Release

#### Goal
Make Shopify operable if a merchant install goes wrong.

#### Required outputs
1. Install failure triage
2. Provisioning failure triage
3. Sync failure triage
4. Uninstall/reinstall handling notes
5. Standalone-access support path
6. Known limitations list

#### Deliverables
- Update `docs/SHOPIFY_OPERATIONS.md`
- Add a support runbook if needed

#### Exit criteria
- Support owner can answer:
  - what failed
  - what to inspect
  - what to tell merchant
  - how to recover

### Workstream 4 — App listing / review readiness

#### Owner
- Growth / Product / Brand / Documentation

#### Goal
Prepare for Shopify-facing launch/review, even if submission is not immediate.

#### Required outputs
1. App positioning statement
2. Concise merchant value proposition
3. Screenshots/demo plan
4. Listing copy draft
5. Review-risk checklist
6. Scope justification summary
7. Privacy/support/contact placeholders as needed

#### Exit criteria
- App can be explained clearly to merchants, reviewers, and support

### Workstream 5 — Final release gating

#### Owner
- Release Manager / Coordinator

#### Goal
Turn all evidence into a final Shopify GO/NO-GO decision.

#### Inputs
- Validation results
- Bug-fix outcomes
- Support readiness
- Listing/review readiness
- Remaining accepted risks

#### Deliverables
- Updated `docs/LAUNCH_BLOCKERS.md`
- Updated `docs/FINAL_LAUNCH_BOARD.md`
- Updated `docs/VERIFICATION_MATRIX.md`
- Final Shopify decision statement

#### Exit criteria
One of:
- **GO for Shopify launch**
- **GO for limited Shopify pilot**
- **NO-GO with exact blocker list**

## Sprint Board

### Must start immediately
- [ ] Execute dev-store validation plan
- [ ] Capture install/provisioning evidence
- [ ] Capture sync/webhook evidence

### Start after first runtime evidence
- [ ] Fix runtime blockers found in dev-store tests
- [ ] Validate uninstall/reinstall behavior
- [ ] Validate standalone-access activation flow in real merchant lifecycle

### Parallel documentation / launch prep
- [ ] Draft Shopify support runbook
- [ ] Draft app listing/review pack
- [ ] Document scope justification + merchant impact notes

### Final closure
- [ ] Update blocker board with runtime evidence
- [ ] Make final Shopify GO / limited pilot GO / NO-GO decision

## Suggested Day-by-Day Sequence

### Day 1
Focus:
- Dev-store install
- Provisioning
- Initial catalog import
- Initial order backfill

Outputs:
- Screenshots
- Logs
- First bug list

### Day 2
Focus:
- Webhook updates
- Uninstall
- Reinstall
- Standalone-access runtime flow

Outputs:
- Pass/fail status
- Second bug list

### Day 3
Focus:
- Fix critical blockers
- Retest failed scenarios
- Draft support runbook

### Day 4
Focus:
- App listing/review prep
- Scope justification
- Final revalidation of fixed paths

### Day 5
Focus:
- Final synthesis
- Launch doc updates
- Shopify GO/NO-GO decision

## Shopify GO Gates

### Must pass
- Install
- Provisioning
- Catalog import
- Order backfill
- Webhook updates
- Uninstall
- Reinstall

### Must be operationally acceptable
- Standalone access flow, if supported
- Support runbook
- Merchant-facing onboarding clarity

### Must be commercially / review acceptable
- Listing/review draft
- Scope justification
- Merchant-impact notes

## Out of Scope During This Sprint
- Broad redesign of forecasting logic
- Unrelated frontend polish
- Non-Shopify pilot work unless it blocks Shopify
- Major infrastructure redesign
- Speculative refactors without runtime evidence

## Decision Framework at Sprint End

### Shopify GO
Only if:
- Critical runtime scenarios pass
- Support path exists
- Listing/review prep is acceptable
- Remaining issues are minor and explicitly accepted

### Shopify limited pilot GO
If:
- Install/provisioning/sync mostly work
- Some non-critical issues remain
- Support can absorb them
- App Store/public launch is still premature

### Shopify NO-GO
If:
- Install/provisioning/sync/lifecycle still break in meaningful ways
- Merchant confusion remains high
- Uninstall/reinstall is not trustworthy
- Support burden is too high

## Evidence Discipline
For every validated scenario, capture:
- Timestamp
- Scenario name
- Expected result
- Actual result
- Pass/fail
- Screenshot(s)
- Relevant log excerpt(s)
- DB excerpt(s) if useful
- Unresolved notes

## Success Condition
The sprint is successful when Shopify’s launch status is based on explicit evidence and can be defended as:
- GO
- limited pilot GO
- or NO-GO

without ambiguity.
