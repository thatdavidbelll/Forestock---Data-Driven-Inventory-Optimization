# Forestock MVP Scope

## Goal
Launch a controlled, merchant-facing MVP that proves Forestock can turn retail sales history into trustworthy, actionable restocking suggestions.

## Target Launch Type
- Controlled beta / limited pilot
- Small set of friendly merchants or invited stores
- Human-supervised onboarding and support

## Core User Promise
Forestock helps store operators:
- import or sync product and sales data
- generate demand forecasts
- review prioritized order suggestions
- decide what to reorder with human oversight

## In Scope for MVP

### Product
- Authentication and role-based access
- Store-scoped multi-tenant data isolation
- Product catalog management
- Inventory management
- Sales import / ingestion
- Forecast generation
- Suggestion review and acknowledgement
- Basic dashboard visibility
- Basic audit logging
- Shopify connection for selected pilot merchants, with the embedded Shopify app acting as the intended primary merchant surface when Shopify is in scope

### Operational
- Backend deployment via CI/CD
- Frontend deployment via S3 + CloudFront
- Neon-backed production database
- Health endpoint and rollback path for backend image deploys
- Manual operator support for incidents and onboarding

### Trust / Safety
- Clear human-in-the-loop positioning
- Tenant isolation enforced in backend
- Role-based permissions
- Basic auth rate limiting
- Email verification / password reset

## Out of Scope for MVP
- Broad App Store launch at scale
- Fully self-serve merchant onboarding without manual review
- Advanced billing automation
- Complex analytics beyond core forecast/suggestion experience
- Large-scale observability maturity
- Zero-touch infrastructure operations
- Broad multi-region / enterprise readiness

## Launch Gates
Forestock MVP should not be considered launch-ready until all of the following are true:
- Critical auth and tenant isolation flows validated
- Forecast generation works on representative merchant data
- Suggestion flows validated end to end
- Shopify install/sync path validated for pilot stores if Shopify is included in launch
- Production config finalized without placeholder URLs or exposed environment-specific identifiers in docs
- Launch blocker list reviewed and reduced to acceptable residual risk

## Success Criteria
- Pilot merchants can sign in and complete core workflows
- Forecast outputs are understandable enough to support ordering decisions
- No critical auth, tenant isolation, or data integrity defects remain open
- Support burden is manageable with documented rollback and operations procedures

## Notes
This MVP definition intentionally favors a narrow, polished launch over full-surface breadth.

For Shopify merchants, the intended long-term product posture is Shopify-first: install and ongoing use should center on the embedded Shopify app, while any standalone Forestock access remains secondary unless explicitly promoted later.
