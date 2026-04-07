# Errors

Command failures and integration errors.

---

## [ERR-20260407-001] backend-test-environment

**Logged**: 2026-04-07T10:35:00Z
**Priority**: medium
**Status**: resolved
**Area**: tests

### Summary
Backend tests could not be executed in the audit environment because JAVA_HOME was not configured correctly.

### Error
```
The JAVA_HOME environment variable is not defined correctly,
this environment variable is needed to run this program.
```

### Context
- Command attempted: `./mvnw test`
- Area: `forestock-backend`
- Impact: prevented executable backend test validation during launch-readiness audit

### Suggested Fix
Ensure Java 21 is installed and `JAVA_HOME` is set correctly in the environment used for local verification.

### Metadata
- Reproducible: yes
- Related Files: forestock-backend/mvnw, forestock-backend/pom.xml

### Resolution
- **Resolved**: 2026-04-07T10:47:00Z
- **Notes**: Java 21 was installed locally and backend tests then passed with `./mvnw test`.

---

## [ERR-20260407-002] shopify-validation-stall

**Logged**: 2026-04-07T10:36:00Z
**Priority**: low
**Status**: pending
**Area**: tests

### Summary
Shopify app validation did not complete to a clear pass/fail result during the audit environment run.

### Error
```
Validation run stalled after dependency installation / warnings and did not produce a final clean result before termination.
```

### Context
- Command attempted: `npm ci && npm run lint && npm run typecheck`
- Area: `shopify-app`
- Impact: Shopify readiness remains only partially verified in this audit

### Suggested Fix
Run Shopify lint and typecheck again in a clean development environment and record exact pass/fail output.

### Metadata
- Reproducible: unknown
- Related Files: shopify-app/package.json, shopify-app/tsconfig.json, shopify-app/.eslintrc.cjs

---

## [ERR-20260407-003] backend-startup-no-postgres

**Logged**: 2026-04-07T10:49:00Z
**Priority**: high
**Status**: pending
**Area**: backend

### Summary
Backend non-production startup failed because PostgreSQL was not reachable on `localhost:5432`, preventing Flyway initialization and full app boot.

### Error
```
Unable to obtain connection from database: Connection to localhost:5432 refused.
SQL State  : 08001
Message    : Connection to localhost:5432 refused. Check that the hostname and port are correct and that the postmaster is accepting TCP/IP connections.
```

### Context
- Command attempted: `./mvnw spring-boot:run` with `SPRING_PROFILES_ACTIVE=test`
- Impact: blocked live backend smoke checks including health/auth/manual critical-path validation
- Additional environment note: Docker is installed, but this session currently lacks permission to access `/var/run/docker.sock`

### Suggested Fix
Start a non-production PostgreSQL instance reachable at the configured test datasource URL, or provide Docker socket access / alternative database access for local smoke validation.

### Metadata
- Reproducible: yes
- Related Files: forestock-backend/src/main/resources/application-test.yml, forestock-backend/docker-compose.yml

---
