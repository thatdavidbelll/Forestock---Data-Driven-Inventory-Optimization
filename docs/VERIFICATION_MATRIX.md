# Verification Matrix

## Purpose
Track launch-critical flows, current validation state, evidence, and remaining gaps for Forestock.

## Status Legend
- Verified: validated with current evidence
- Partially Verified: some evidence exists, but not enough for launch confidence
- Not Verified: no meaningful evidence yet
- Blocked: could not be verified due to environment or dependency constraints

## Critical Path Matrix

| Area | Flow | Priority | Current Status | Evidence | Remaining Work |
|---|---|---:|---|---|---|
| Auth | Login with valid credentials | Critical | Verified | Valid login succeeded in non-prod and again in production using a safe admin account during post-deploy validation | Extend verification to additional production-safe roles only as needed |
| Auth | Invalid login and lockout / rate limiting behavior | Critical | Partially Verified | Live auth validation confirmed invalid login returns 401 with safe error message; rate-limit threshold behavior still not exercised | Execute repeated invalid-login validation for 401/429 behavior |
| Auth | Refresh token flow | Critical | Verified | Live auth validation confirmed `/api/auth/refresh` returns a fresh access token from a valid refresh token | Extend to token-rotation policy checks if rotation is introduced |
| Auth | Logout / token revocation | Critical | Verified | Live auth validation confirmed `/api/auth/logout` invalidates the current access token; subsequent `/api/users/me` call returned 401 | Reconfirm in deployed environment with real Redis parity |
| Auth | Password reset | High | Partially Verified | Password reset pages/services/controllers exist | Verify end-to-end email/reset flow in non-prod environment |
| Auth | Email verification | High | Partially Verified | Live smoke pass showed a newly created store admin cannot log in until verification is completed; repeated local validation during the closure pass confirmed newly created admins receive 403 `Email not verified` responses before verification; backend verification service and public verify endpoint exist | Execute verification-link flow end to end and confirm post-verification login succeeds; until then, keep onboarding manual for the first invited pilot |
| Tenant Isolation | Store-scoped API data isolation | Critical | Partially Verified | TenantContext + JWT-scoped store model documented and implemented structurally; residual risk accepted only for a manual, invited first pilot | Validate store A cannot access store B data |
| Roles / Permissions | Super admin boundaries | Critical | Partially Verified | Live validation confirmed super admin can access `/api/admin/stores` while store admin receives 403 on the same endpoint | Extend matrix to deactivate/activate/delete store actions |
| Roles / Permissions | Admin / manager / viewer route and API restrictions | Critical | Partially Verified | Frontend route guards exist; backend role model documented; residual proof gap accepted only for a manual, invited first pilot | Validate protected endpoints and UI restrictions by role |
| Onboarding | Create store / first admin | Critical | Partially Verified | Live non-prod smoke pass successfully created a store and first admin via `/api/register`; repeated local validation confirmed newly created admins are blocked before email verification, which matches service/controller behavior | Complete verification-link flow and first login as store admin; until then, keep first-pilot onboarding manual and supervised |
| Onboarding | Accept invite for additional user | High | Partially Verified | Live validation confirmed store admin can create an invite for a manager user; verification and acceptance path still needs token-based completion, and this residual risk is accepted only for a manual, invited first pilot | Complete invite verify/accept flow end to end |
| Product Data | Product CRUD / visibility | High | Partially Verified | Product pages/services/controllers exist | Validate API + UI flows |
| Inventory | Inventory updates and current stock visibility | Critical | Verified | Live smoke pass validated inventory update, history, and current inventory list after fix; backend regression tests added in `InventoryServiceTest` | Reconfirm once frontend is exercised against the fixed backend |
| Sales Data | CSV import / ingestion | Critical | Verified | Live non-prod flow validated CSV preview, import (7 rows, 0 errors), sales listing, summary, and audit logging | Reconfirm via frontend UI flow |
| Forecasting | Forecast generation completes successfully | Critical | Verified | Live non-prod flow validated forecast completion after imported sales data; latest run completed with no insufficient-data products | Reconfirm with broader SKU mix and staging-like data |
| Forecasting | Forecast fallback / edge-case handling | High | Partially Verified | Forecast engine and config thresholds exist | Validate low-history / malformed / sparse data cases |
| Suggestions | Suggestion generation after forecast | Critical | Verified | Live non-prod flow produced a critical reorder suggestion after CSV import and forecast completion; production `/api/suggestions` also returned valid business data during post-deploy validation | Reconfirm suggestion review/acknowledgement via frontend UI |
| Suggestions | Suggestion acknowledgement / workflow state | High | Partially Verified | Suggestion acknowledgement DTOs/services exist | Validate acknowledgement actions and persistence |
| Dashboard | Dashboard accuracy after data changes | High | Not Verified | Dashboard surfaces exist | Validate metrics after import / forecast / inventory updates |
| Reporting / Export | Report generation / exports | Medium | Verified | Production-safe validation confirmed `/api/suggestions/export/excel`, `/api/suggestions/export/pdf`, `/api/reports/inventory-valuation`, `/api/reports/slow-movers`, and `/api/reports/sales` all return successful downloads after the sales-report controller/store-config fixes | Optionally verify PDF mode for `/api/reports/sales` and exercise frontend report-download UX |
| Audit Log | Audit events captured for sensitive actions | High | Verified | Live smoke pass confirmed `PRODUCT_CREATED` and `INVENTORY_UPDATED` records are retrievable after audit-log fix; regression coverage added in `AuditLogServiceTest` | Extend verification to CSV export and broader action set |
| Shopify | App install/auth | Critical if Shopify in launch | Partially Verified | Shopify auth/routes/config exist; placeholder URLs remain | Validate with production-like config in non-prod environment |
| Shopify | Webhook verification / HMAC | Critical if Shopify in launch | Partially Verified | HMAC service and tests exist | Re-run tests and validate webhook processing end to end |
| Shopify | Product sync | High if Shopify in launch | Partially Verified | Product sync routes/services/migrations exist | Validate catalog sync against test shop |
| Shopify | Order ingestion / backfill | Critical if Shopify in launch | Partially Verified | Order ingestion services/tests/routes exist | Validate order import, idempotency, and error handling |
| Shopify | Inventory sync | High if Shopify in launch | Partially Verified | Inventory webhook route and backend sync endpoints exist | Validate stock updates and reconciliation logic |
| Shopify | Uninstall cleanup | High if Shopify in launch | Partially Verified | Uninstall webhook route exists | Validate disconnect/deactivation behavior |
| Database | Fresh migration apply | Critical | Verified | Running backend against fresh local PostgreSQL successfully applied 22 Flyway migrations to an empty schema during non-prod startup smoke pass | Keep this as launch evidence and repeat in staging-like environment |
| Database | Upgrade migration path | Critical | Not Verified | Historical migration chain present | Validate upgrade from realistic baseline |
| Database | Query/index performance sanity | Medium | Not Verified | Performance index migration exists | Review plans on representative data |
| Deploy | Backend CI test/build | Critical | Partially Verified | CI workflow exists | Run and confirm green in actual CI context |
| Deploy | Frontend build/lint/typecheck | High | Verified | Local audit run passed lint, typecheck, and build | Keep as release gate |
| Backend Tests | Backend automated test suite | Critical | Verified | `./mvnw test` passed locally with Java 21 after the latest reporting fixes: 41 tests, 0 failures, 0 errors, 1 skipped | Keep as release evidence and investigate skipped app test / Mockito agent warning when hardening CI |
| Deploy | Backend deploy rollback | High | Partially Verified | Rollback workflow exists and production post-deploy validation succeeded, but rollback itself has not yet been executed | Rehearse rollback in non-prod or controlled production window |
| Deploy | Frontend rollback | Medium | Not Verified | Procedure documented in docs pass, not rehearsed | Test restore/redeploy path |
| Ops | Health endpoint post-deploy check | High | Verified | Spring Boot Actuator is enabled; `/actuator/health/readiness` and `/actuator/health/liveness` return `UP` in non-prod, and production readiness at `https://api.forestock.ro/actuator/health/readiness` returned HTTP 200 with status `UP` during post-deploy validation | Decide whether overall `/actuator/health` should continue to include optional mail health in every environment |
| Security | Swagger disabled in prod | Medium | Partially Verified | Prod config shows disabled springdoc | Confirm effective runtime config |
| Security | Secrets/config separation | Critical | Partially Verified | `.env.example` exists, some docs hardened | Review actual deployment secret handling |

## Summary by Launch Track

### Required before controlled beta
- Login / refresh / logout verified
- Tenant isolation verified
- Role boundaries verified
- Store creation and invite acceptance verified
- Sales import, forecast generation, and suggestion pipeline verified
- Fresh migrations verified
- Backend tests runnable and passing in Java 21 environment
- Frontend release gate kept green

### Required before Shopify-inclusive launch
- Install/auth verified
- Webhook signature handling verified
- Product/order/inventory sync flows verified
- Uninstall cleanup verified
- Production URLs and redirects finalized

### Required before broader public launch
- Rollback rehearsal
- Support / incident runbook use in practice
- Better E2E / regression coverage
- Stronger observability and release confidence

## Immediate Next Validation Work
1. Execute `docs/MANUAL_TEST_SCRIPT.md` for the remaining auth + onboarding + UI confirmation gaps
2. Validate a clean migration run
3. Optionally verify `/api/reports/sales?format=pdf` and frontend report-download UX
4. Re-run Shopify lint/typecheck and perform a deeper install/webhook review
5. Investigate the intentionally skipped backend application test and future-proof Mockito agent configuration for newer JDK behavior
