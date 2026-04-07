# Neon Operations

## Purpose
Document how Forestock uses Neon safely across development and production-like environments.

## Current Usage Pattern
- Application runtime uses a pooled PostgreSQL connection in cloud/prod-style environments
- Flyway uses a direct connection to avoid PgBouncer advisory lock issues during migrations

## Environment Notes
### Cloud development
- Uses Neon for development against a hosted PostgreSQL instance
- Token blacklist enforcement is disabled in the `cloud` profile to avoid Redis dependency in that mode

### Production-style deployment
- Runtime datasource should use pooled connection settings
- Flyway should use direct, non-pooler connection settings

## Database Safety Principles
- Prefer additive migrations
- Avoid destructive schema changes close to launch
- Validate migrations against non-production environments first
- Keep runtime and migration connection settings explicit

## Required Pre-Launch Checks
- Verify all current Flyway migrations apply cleanly on a fresh database
- Verify migrations apply cleanly on an upgrade path from the current production baseline
- Review performance-critical queries and index coverage
- Validate tenant isolation for store-scoped tables
- Confirm backup / recovery expectations for production environment

## Risk Notes
- Production behavior depends on correct separation of pooler and direct URLs
- Environment-specific connection details should not be hardcoded in shared docs
- Destructive migration paths remain high risk and require explicit review

## Operational Checklist
- Confirm target Neon project / branch / database for each environment
- Confirm runtime datasource URL, user, and password source
- Confirm Flyway direct URL, user, and password source
- Confirm rollback expectation before any production migration

## Launch Recommendation
Treat schema changes as tightly controlled release events until launch stability is established.
