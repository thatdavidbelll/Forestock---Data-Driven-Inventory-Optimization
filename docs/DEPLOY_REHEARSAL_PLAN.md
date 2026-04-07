# Deploy Rehearsal Plan

## Purpose
Provide a safe, repeatable checklist for a backend deploy/readiness/rollback rehearsal before the Forestock pilot.

## Scope
- Backend deploy only
- Backend readiness verification
- Backend rollback verification
- No Shopify changes
- No destructive database changes
- No frontend deployment in this rehearsal

## Recommended Default Roles
- **Operator:** David
- **Observer:** Shaggy
- **Rollback owner:** David
- **Recorder:** Shaggy

## Environment Details (fill later)
- **Environment name:** `<fill when known>`
- **API host:** `<fill when known>`
- **Target commit or release tag:** `<fill when known>`
- **Deploy image tag:** `<fill when known>`
- **Rollback image tag (last known good):** `<fill when known>`
- **Safe test username:** `<fill when known>`
- **Safe test password source:** `<fill when known>`

## Readiness Policy
Use the readiness endpoint for deploy checks:
```bash
curl https://<api-host>/actuator/health/readiness
```

Use overall health only for diagnostics:
```bash
curl https://<api-host>/actuator/health
```

## Preconditions
- [ ] Backend tests are green for the target release
- [ ] Target environment is explicitly identified
- [ ] Previous known-good image tag is recorded
- [ ] No destructive migration is included in the rehearsal release
- [ ] Operator and rollback owner are available at the same time
- [ ] Pilot/demo users are not actively depending on the environment during rehearsal

## Preflight Checklist
- [ ] Confirm current backend version/image tag
- [ ] Confirm current readiness is healthy
- [ ] Confirm login works for a safe test account
- [ ] Confirm one protected read endpoint works
- [ ] Confirm rollback image tag is recorded

### Preflight Commands
```bash
curl https://<api-host>/actuator/health/readiness
```

```bash
curl -X POST https://<api-host>/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"<test-user>","password":"<test-password>"}'
```

```bash
curl https://<api-host>/api/store \
  -H "Authorization: Bearer <access-token>"
```

## Deploy Rehearsal Steps
1. Trigger the normal backend deployment workflow/path
2. Record:
   - start time
   - target commit
   - deploy image tag
3. Watch workflow/job completion
4. Verify readiness:
```bash
curl https://<api-host>/actuator/health/readiness
```
5. Verify smoke checks:
   - login
   - `/api/store`
   - optional `/api/suggestions`

## Rollback Rehearsal Steps
1. Trigger rollback using the recorded last-known-good image tag
2. Record:
   - rollback start time
   - rollback target image tag
3. Verify readiness again:
```bash
curl https://<api-host>/actuator/health/readiness
```
4. Re-run smoke checks:
   - login
   - `/api/store`
   - optional `/api/suggestions`

## Smoke Check Set
### Login
```bash
curl -X POST https://<api-host>/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"<test-user>","password":"<test-password>"}'
```

### Store read
```bash
curl https://<api-host>/api/store \
  -H "Authorization: Bearer <access-token>"
```

### Optional suggestions read
```bash
curl https://<api-host>/api/suggestions \
  -H "Authorization: Bearer <access-token>"
```

## Pass Criteria
- [ ] Deploy completes successfully
- [ ] Readiness returns HTTP 200 after deploy
- [ ] Smoke checks pass after deploy
- [ ] Rollback completes successfully
- [ ] Readiness returns HTTP 200 after rollback
- [ ] Smoke checks pass after rollback

## Fail Criteria
- [ ] Readiness does not recover after deploy
- [ ] Rollback target is missing or unclear
- [ ] Smoke checks fail after deploy or rollback
- [ ] Operator cannot confidently explain or repeat the procedure

## Rehearsal Record Template
- **Date/time:**
- **Environment:**
- **Operator:**
- **Observer:**
- **Rollback owner:**
- **Recorder:**
- **Target commit:**
- **Deploy image tag:**
- **Rollback image tag:**
- **Preflight readiness result:**
- **Post-deploy readiness result:**
- **Post-deploy smoke result:**
- **Post-rollback readiness result:**
- **Post-rollback smoke result:**
- **Total deploy time:**
- **Total rollback time:**
- **Issues observed:**
- **Recommendation:**

## Notes
This document is intentionally written to be usable even before every environment detail is known. Fill the placeholders when the actual rehearsal is scheduled.
