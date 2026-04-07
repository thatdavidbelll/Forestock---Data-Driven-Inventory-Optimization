# AWS Operations

## Purpose
Document the current AWS operating model for Forestock and the minimum controls required for launch.

## Current Documented Services
- ECR for backend image storage
- EC2 for backend runtime
- S3 for frontend hosting and forecast/report storage
- CloudFront for frontend delivery
- SNS for notifications

## Current Deployment Model
### Backend
- GitHub Actions builds, tests, pushes image to ECR, then deploys over SSH to EC2
- EC2 host updates `.env` with the selected backend image and restarts Docker Compose services

### Frontend
- GitHub Actions builds frontend and syncs static assets to S3
- CloudFront invalidation is triggered after deploy

## Operational Risks
- Mutable server deploy model via SSH
- No infrastructure-as-code observed in this audit
- Limited observability/runbook evidence in repo
- Production credentials strategy should be reviewed and minimized

## Minimum Pre-Launch Controls
- Confirm rollback workflow is tested for backend image rollback
- Document frontend rollback method
- Confirm EC2 disk, Docker image pruning, and restart behavior are understood
- Confirm CloudFront/S3 cache behavior for new releases
- Confirm health endpoint and smoke checks are part of release process

## Recommended Improvements
- Prefer instance role / reduced static credentials where possible
- Add explicit alerting and monitoring expectations
- Capture environment inventory and owner list
- Move toward reproducible infra definitions over manual console drift

## Launch Checklist
- Backend CI passes on main
- Frontend build/lint/typecheck pass on main
- Backend deploy workflow secrets are present and current
- Frontend deploy workflow secrets are present and current
- Rollback steps are documented and rehearsed
- Health checks are verified after each release
