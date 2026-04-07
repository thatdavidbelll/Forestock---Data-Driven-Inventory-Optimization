# Learnings

Corrections, insights, and knowledge gaps captured during development.

**Categories**: correction | insight | knowledge_gap | best_practice

---

## [LRN-20260407-001] best_practice

**Logged**: 2026-04-07T10:37:00Z
**Priority**: high
**Status**: pending
**Area**: docs

### Summary
Forestock launch readiness needs an explicit docs pack rather than relying on scattered README and deployment notes.

### Details
The repository had meaningful implementation and some deployment documentation, but it lacked a structured launch-readiness pack covering MVP scope, blockers, architecture, operations, rollback, and GTM framing. This makes launch coordination harder and hides risk ownership.

### Suggested Action
Maintain a `/docs` launch pack and update it with every significant launch-affecting change.

### Metadata
- Source: conversation
- Related Files: docs/MVP_SCOPE.md, docs/LAUNCH_BLOCKERS.md, docs/ARCHITECTURE.md, docs/CHANGELOG.md
- Tags: launch-readiness, docs, operations

---

## [LRN-20260407-002] best_practice

**Logged**: 2026-04-07T10:38:00Z
**Priority**: medium
**Status**: pending
**Area**: docs

### Summary
Shared documentation should avoid concrete environment-specific infrastructure identifiers when generalized placeholders are sufficient.

### Details
Deployment documentation included concrete Neon endpoints and account-specific examples. Even if not secret by themselves, this creates unnecessary exposure and increases drift risk when environments change.

### Suggested Action
Use placeholders in committed docs and keep live environment values in secure operator-controlled configuration.

### Metadata
- Source: conversation
- Related Files: DEPLOYMENT.md, forestock-backend/.env.example
- Tags: docs, security, operations

---

## [LRN-20260407-003] best_practice

**Logged**: 2026-04-07T10:47:00Z
**Priority**: medium
**Status**: pending
**Area**: tests

### Summary
Forestock backend validation should explicitly include Java 21 availability and a stable Mockito/JDK compatibility check in the release checklist.

### Details
Once Java 21 was installed, `./mvnw test` passed successfully. The run also emitted warnings that Mockito is self-attaching an agent dynamically, which future JDK behavior may restrict by default. This is not a current test failure, but it is a future reliability concern for backend validation.

### Suggested Action
Add Java 21 presence and Mockito/JDK agent compatibility review to backend validation and CI maintenance checks.

### Metadata
- Source: error
- Related Files: forestock-backend/pom.xml, docs/VERIFICATION_MATRIX.md
- Tags: backend, tests, java21, mockito

---

## [LRN-20260407-004] insight

**Logged**: 2026-04-07T10:56:00Z
**Priority**: medium
**Status**: pending
**Area**: backend

### Summary
Newly created store admins are intentionally gated behind email verification before first login.

### Details
During the live smoke pass, `/api/register` successfully created a store and first admin, but immediate login for that admin failed. This aligns with `RegisterService` and `EmailVerificationService`, which create the admin as active but unverified and require the verification flow before successful authentication.

### Suggested Action
Treat verification-link completion as a required onboarding smoke test, and ensure non-production verification evidence is easy to access during QA.

### Metadata
- Source: conversation
- Related Files: forestock-backend/src/main/java/com/forestock/forestock_backend/service/RegisterService.java, forestock-backend/src/main/java/com/forestock/forestock_backend/service/EmailVerificationService.java, docs/MANUAL_TEST_SCRIPT.md
- Tags: onboarding, auth, verification

---

## [LRN-20260407-005] best_practice

**Logged**: 2026-04-07T11:15:00Z
**Priority**: high
**Status**: pending
**Area**: backend

### Summary
Launch-blocking smoke-pass bugs should be converted into narrow regression tests immediately after a fix is validated.

### Details
The inventory current-state mismatch and audit-log list failure were both fixed locally and then protected with targeted service-level regression tests (`InventoryServiceTest`, `AuditLogServiceTest`). This kept the fix loop tight and reduced the chance of reintroducing trust-critical regressions.

### Suggested Action
For every launch-critical bug found in manual smoke testing, add the smallest useful automated test before moving on.

### Metadata
- Source: conversation
- Related Files: forestock-backend/src/test/java/com/forestock/forestock_backend/service/InventoryServiceTest.java, forestock-backend/src/test/java/com/forestock/forestock_backend/service/AuditLogServiceTest.java, docs/VERIFICATION_MATRIX.md
- Tags: testing, regression, launch-readiness

---

## [LRN-20260407-006] best_practice

**Logged**: 2026-04-07T11:20:00Z
**Priority**: medium
**Status**: pending
**Area**: backend

### Summary
Controller endpoints that expose domain entities directly are a common source of late smoke-test failures; prefer DTO responses on read APIs.

### Details
`/api/sales/{sku}/daily` failed in live smoke testing while list/summary/import worked. The endpoint was returning raw `SalesTransaction` entities, unlike the paginated sales list which already used `SalesTransactionDto`. Converting the daily endpoint to DTO output fixed the issue and reduced lazy-loading/serialization risk.

### Suggested Action
Use DTO responses consistently for controller read endpoints, especially where JPA entities have lazy relationships.

### Metadata
- Source: conversation
- Related Files: forestock-backend/src/main/java/com/forestock/forestock_backend/controller/SalesController.java, forestock-backend/src/test/java/com/forestock/forestock_backend/controller/SalesControllerTest.java
- Tags: dto, serialization, controllers, testing

---

## [LRN-20260407-007] best_practice

**Logged**: 2026-04-07T11:33:00Z
**Priority**: medium
**Status**: pending
**Area**: operations

### Summary
Health endpoint failures can come from missing actuator dependencies or from strict health-contributor semantics; these are different problems and should be diagnosed separately.

### Details
Forestock initially exposed `/actuator/health` in security/config but did not include the Spring Boot Actuator dependency, so the endpoint was absent. After adding Actuator and test-profile exposure, the endpoint became available and returned structured health JSON. The remaining 503 was caused by the mail health contributor being `DOWN` because SMTP credentials were not configured in the test environment.

### Suggested Action
First ensure Actuator is actually present and exposed; then decide which contributors should affect overall health/readiness status in each environment.

### Metadata
- Source: conversation
- Related Files: forestock-backend/pom.xml, forestock-backend/src/main/resources/application-test.yml, docs/VERIFICATION_MATRIX.md
- Tags: actuator, health, operations, readiness

---

## [LRN-20260407-008] best_practice

**Logged**: 2026-04-07T11:36:00Z
**Priority**: medium
**Status**: pending
**Area**: operations

### Summary
Separate overall health from readiness/liveness so optional integrations do not block core service readiness.

### Details
After enabling Actuator, overall `/actuator/health` still returned `DOWN` because the mail contributor lacked SMTP credentials. Defining dedicated readiness/liveness health groups allowed Forestock to report core availability correctly (`db`, `redis`, `diskSpace`, `ping`) while still surfacing optional dependency problems in the full health output.

### Suggested Action
Use readiness/liveness endpoints for deploy checks and operational automation, and reserve overall health for broader diagnostic visibility.

### Metadata
- Source: conversation
- Related Files: forestock-backend/src/main/resources/application-test.yml, docs/VERIFICATION_MATRIX.md, docs/LAUNCH_BLOCKERS.md
- Tags: readiness, liveness, actuator, ops

---
