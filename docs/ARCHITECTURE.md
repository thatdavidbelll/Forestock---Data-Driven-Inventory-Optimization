# Architecture

## System Overview
Forestock is a multi-surface inventory optimization platform with three primary code surfaces:
- `forestock-backend` — Spring Boot REST API and forecasting engine
- `forestock-frontend` — React web application for Forestock operators
- `shopify-app` — Shopify embedded app and webhook/auth integration surface

## High-Level Flow
1. Users authenticate into Forestock
2. Store-scoped data is loaded through the backend API
3. Sales and inventory data are imported or synced
4. Forecast runs generate projected demand
5. Suggestion logic prioritizes reorder actions
6. Users review and act on suggestions

## Core Components

### Frontend
- React + Vite + TypeScript
- Route-based application with role-aware access guards
- Uses backend API for auth, dashboard, products, inventory, suggestions, and settings

### Backend
- Java 21 + Spring Boot
- Spring Security + JWT auth
- Tenant scoping based on JWT-carried store identity
- PostgreSQL via JPA / Hibernate
- Flyway migrations for schema evolution
- Forecasting and suggestion services
- Audit logging and user/store administration
- Shopify integration endpoints and webhook handling

### Shopify App
- Embedded Shopify app using Shopify app framework
- Handles Shopify auth/session lifecycle
- Registers webhooks after auth
- Forwards provisioning, catalog sync, inventory sync, and order backfill operations to the Forestock backend through a shared integration secret
- Intended as the primary merchant-facing surface for Shopify-connected stores
- Shopify-provisioned admin identities can now be scaffolded with standalone web access disabled by default until an explicit activation flow is completed

### Data Layer
- PostgreSQL for core product, inventory, sales, forecast, suggestion, user, and store data
- Neon used for cloud-hosted PostgreSQL environments
- Redis used for token blacklist support in standard auth flows

### Storage / Notifications
- AWS S3 for forecast input/report artifacts
- AWS SNS for notifications

## Deployment Shape
### Current documented shape
- Frontend: S3 + CloudFront
- Backend: EC2 + Nginx + Docker
- Database: Neon PostgreSQL

## Security Model
- JWT-based authentication
- Role-based authorization
- Tenant scoping for store data
- Rate limiting on selected auth endpoints
- Email verification and password reset flows
- Standalone-access activation flow for Shopify-provisioned accounts
- Audit logs for store-scoped actions

## Launch Architecture Risks
- Operational maturity depends on EC2 + SSH-driven deploy workflow
- Shopify production configuration remains a separate launch readiness track
- Environment behavior differs between cloud development and production in at least one security-relevant area (token blacklist)

## Recommended Next Architecture Actions
- Clarify supported launch topology and environments
- Add explicit environment matrix (local / test / staging / prod)
- Document cross-system dependencies for auth, Shopify sync, S3, SNS, and Neon
- Add observability and incident response expectations
