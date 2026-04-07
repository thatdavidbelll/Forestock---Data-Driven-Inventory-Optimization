# Rollback Procedures

## Purpose
Provide minimum rollback guidance for launch and early production operations.

## Principles
- Prefer reversible releases
- Keep rollback steps short and operator-friendly
- Verify health after rollback, not just deployment
- Record what changed and why rollback was needed

## Backend Rollback
### Current mechanism
- GitHub Actions includes a manual rollback workflow using a previous ECR image tag

### Minimum rollback steps
1. Identify the last known good backend image tag
2. Trigger rollback workflow with that tag
3. Confirm EC2 host updates `BACKEND_IMAGE`
4. Restart application container via Docker Compose
5. Verify `GET /actuator/health`
6. Verify critical smoke flow (login + one API read)

### Risks
- Rollback assumes image compatibility with current environment and database state
- Database schema changes may reduce rollback safety if not backward-compatible

## Frontend Rollback
### Current expectation
- Re-deploy prior known-good frontend build artifacts to S3
- Invalidate CloudFront cache after rollback

### Minimum rollback steps
1. Identify previous frontend artifact version or commit
2. Rebuild or restore known-good artifact
3. Sync to S3
4. Invalidate CloudFront
5. Verify login page and one authenticated route load correctly

## Database Rollback
### Principle
- Prefer forward-fix over destructive rollback
- Production schema rollback is high risk unless explicitly planned and rehearsed

### Minimum expectation
- Any production schema change must include backward compatibility assessment and rollback notes before approval

## Shopify Rollback
- Be cautious with scope or install-flow changes
- If merchant-facing config changes cause issues, revert to last known working config and assess whether reinstall or reauthorization is required
- Verify webhook registration and install state after changes

## Incident Record Template
- What changed
- When it changed
- Symptoms observed
- Systems affected
- Rollback action taken
- Verification performed
- Follow-up actions
