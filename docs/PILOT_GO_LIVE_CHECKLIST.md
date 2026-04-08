# Pilot Go-Live Checklist

## Pilot Assumptions
- Shopify is **out** for the first controlled pilot
- Pilot users are invited and limited in number
- Onboarding is manual and supervised
- Core value path is: sales import → forecast → suggestions

## Go / No-Go Rule
Pilot should only proceed when all **Critical** items are complete and all **High** items are either complete or explicitly accepted with owner and date.

## Critical Before Pilot

### Product / Data
- [ ] At least one representative pilot dataset has been imported successfully in a production-like environment
- [ ] Forecast generation completes successfully for pilot stores
- [ ] Suggestion generation produces understandable results for pilot stores
- [ ] Inventory current-state is accurate after recent changes

### Auth / Security / Trust
- [ ] Valid login verified for pilot users
- [ ] Refresh token flow verified in deployed-like environment
- [ ] Logout/token invalidation verified in deployed-like environment
- [ ] Tenant isolation verified between at least two stores
- [ ] Admin vs manager role boundaries validated for pilot-critical endpoints
- [ ] Email verification flow works end to end or is replaced with a controlled manual onboarding workaround for pilot
- [x] Accepted pilot risk: auth/onboarding remains partially verified, with evidence that new store admins are blocked until verification; for the first pilot, onboarding will remain manual and supervised rather than fully self-serve

### Operations
- [x] Backend deploy health check uses `/actuator/health/readiness`
- [ ] One deploy rehearsal completed successfully
- [ ] One rollback rehearsal completed successfully
- [x] Production config for backend/frontend is reviewed and current
- [ ] Neon migration/backward-compatibility risk accepted for current schema state

## High Priority Before Pilot

### UX / Workflow
- [ ] Frontend import → forecast → suggestions path is manually checked in a real browser environment if available
- [ ] Dashboard shows sensible post-import / post-forecast state
- [ ] Suggestion review flow is understandable to a pilot merchant/operator
- [ ] Error states for import/auth/forecast are understandable enough for supervised pilot use

### Support / Release Discipline
- [ ] Pilot support owner identified
- [ ] Incident/rollback owner identified
- [ ] Pilot merchant list agreed
- [ ] Success criteria for pilot agreed
- [x] Known limitations documented and ready to share internally

## Nice-to-Have Before Pilot
- [ ] Password reset flow validated end to end
- [ ] Viewer-role path validated
- [ ] Report/export endpoints validated
- [ ] Better monitoring/alerting captured in ops docs

## Pilot Day Checklist
- [ ] Confirm backend is healthy via `/actuator/health/readiness`
- [ ] Confirm frontend is reachable
- [ ] Confirm login works for pilot admin account
- [ ] Confirm sales import works for pilot dataset
- [ ] Confirm latest forecast run completes
- [ ] Confirm suggestions page loads for pilot store
- [ ] Confirm audit logs are recording recent actions
- [ ] Confirm rollback command/workflow is ready if needed

## Pilot Success Signals
- Pilot store can complete import → forecast → suggestions without engineer intervention
- Recommendation quality is understandable enough to discuss with operators
- No critical auth, tenant isolation, or data-integrity incident occurs
- Support burden remains manageable

## Pilot Stop Conditions
- Cross-store data leak or role-boundary failure
- Repeated import/forecast failures without quick workaround
- Recommendation output is clearly untrustworthy for pilot data
- Deploy/rollback uncertainty becomes operationally unsafe

## Owners
- Product owner:
- Engineering owner:
- QA owner:
- Ops owner:
- Pilot support owner:

## Decision Log
- Pilot date target:
- Pilot stores:
- Known accepted risks: Auth/onboarding is only partially verified end to end. Manual evidence confirms store registration works and unverified new admins are blocked from login, but verification-token completion, invite-token completion, full tenant-isolation proof, and full role-matrix proof were deferred. This risk is accepted only for a controlled, invited, manually supported, non-Shopify pilot.
- Go / No-Go decision:
- Decision date:
