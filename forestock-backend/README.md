# Forestock

Decision Support Tool for retail store managers. Analyzes historical sales data, forecasts demand using Holt-Winters Triple Exponential Smoothing, and generates prioritized restocking suggestions. The store manager sees what to order and how much — the final decision is always human.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Java 21 + Spring Boot 4.0.4 |
| Frontend | React + Vite + TypeScript + TailwindCSS |
| Database | PostgreSQL 16 + Flyway migrations |
| Forecasting | Holt-Winters Triple Exponential Smoothing (internal Java engine) |
| Storage | AWS S3 (data backup + forecast results) |
| Notifications | AWS SNS (email alerts) |
| Security | Spring Security + JWT (JJWT 0.12.6) |
| Docs | SpringDoc OpenAPI (dev only) |
| CI | GitHub Actions |

## Repository Structure

```
forestock/
├── frontend/          React frontend (Vite + TypeScript + TailwindCSS)
├── src/               Spring Boot backend
├── Dockerfile         Multi-stage backend image
├── docker-compose.yml Dev: PostgreSQL + Adminer
└── docker-compose.prod.yml  Prod: app + PostgreSQL
```

## Prerequisites

- Java 21 JDK ([Temurin](https://adoptium.net/))
- Node.js 20+
- Docker Desktop
- AWS CLI configured (`aws configure`)

## Local Setup

**1. Start the database**
```bash
docker compose up -d
```

**2. Set environment variables** (IntelliJ Run Configuration or terminal)
```bash
export SPRING_PROFILES_ACTIVE=dev
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export AWS_S3_BUCKET=forestock-forecast-data-{accountId}
export AWS_SNS_TOPIC_ARN=...        # optional — skip for local dev
```

**3. Run the backend**
```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 21)
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
```

**4. Run the frontend**
```bash
cd frontend
npm install
npm run dev
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8080 |
| Swagger UI | http://localhost:8080/swagger-ui.html |
| Adminer (DB) | http://localhost:8090 |

Adminer credentials — Server: `postgres` / User: `forestock_user` / Pass: `forestock_pass` / DB: `forestock`

### Default admin account

On first startup, a default admin user is created automatically:

| Field | Value |
|---|---|
| Username | `admin` |
| Password | `admin123` |
| Role | `ROLE_ADMIN` |

> **Change this password before any production deployment.**

## Authentication

All `/api/**` endpoints require a JWT Bearer token (except `/api/auth/login`, `/api/auth/refresh`, `/actuator/health`).

```bash
# 1. Login
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# 2. Use the token
curl http://localhost:8080/api/dashboard \
  -H "Authorization: Bearer <accessToken>"
```

Token expiry: access token **8 hours**, refresh token **30 days**.

## Environment Variables

### Development
```
SPRING_PROFILES_ACTIVE=dev
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=forestock-forecast-data-{accountId}
AWS_SNS_TOPIC_ARN=...
```

The dev JWT secret is set in `application-dev.yml`. For production, set `JWT_SECRET` to a Base64-encoded random string of at least 32 bytes:
```bash
openssl rand -base64 48
```

### Production
```
SPRING_PROFILES_ACTIVE=prod
SPRING_DATASOURCE_URL=jdbc:postgresql://...
SPRING_DATASOURCE_USERNAME=...
SPRING_DATASOURCE_PASSWORD=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=eu-central-1
AWS_S3_BUCKET=...
AWS_SNS_TOPIC_ARN=...
JWT_SECRET=...
FORESTOCK_ALERT_EMAIL=manager@example.com
```

## API Reference

All responses are wrapped: `{ "status": "success"|"error", "message": "...", "data": ... }`

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Get access + refresh tokens |
| POST | `/api/auth/refresh` | Refresh expired access token |

### Products
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products` | List all active products |
| POST | `/api/products` | Create product |
| PUT | `/api/products/{id}` | Update product |
| DELETE | `/api/products/{id}` | Deactivate product |

### Inventory
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/inventory` | Current stock for all products |
| GET | `/api/inventory/alerts` | Products below reorder point |
| PUT | `/api/inventory/{productId}` | Update stock manually |
| GET | `/api/inventory/{productId}/history` | Snapshot history |

### Sales
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sales/import` | Import CSV from POS system (multipart) |
| GET | `/api/sales/summary` | Aggregated sales by period |
| GET | `/api/sales/{sku}/daily` | Daily sales per product |

### Forecast
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/forecast/run` | Trigger forecast manually |
| GET | `/api/forecast/runs` | Forecast run history |
| GET | `/api/forecast/runs/{id}` | Specific run details |
| GET | `/api/forecast/latest` | Latest completed run |

### Suggestions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/suggestions` | Suggestions — filterable by `?urgency=` or `?category=` |
| GET | `/api/suggestions/{id}` | Suggestion detail |
| GET | `/api/suggestions/export/excel` | Download Excel report |
| GET | `/api/suggestions/export/pdf` | Download PDF report |

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard` | KPIs: alerts, critical count, last run status |
| GET | `/api/dashboard/categories` | Product breakdown by category |

## Forecasting Algorithm

Forestock uses **Holt-Winters Triple Exponential Smoothing** (additive, trend + weekly seasonality):

- **Minimum history:** 30 days — falls back to Simple Moving Average for new products
- **Seasonality period:** 7 days (weekly)
- **Parameters:** alpha (level), beta (trend), gamma (seasonality) — optimized via grid search (minimizes SSE)
- **Horizon:** 14 days forward
- **P50:** median forecast — used for urgency calculation
- **P90:** P50 × 1.20 safety buffer — used for order quantity

### Quantity formula
```
suggestedQty = max(0, P90_14days − currentStock)  [rounded up]
```

### Urgency logic
| Days of stock remaining | Urgency |
|---|---|
| < 2 days | CRITICAL |
| 2–5 days | HIGH |
| 5–10 days | MEDIUM |
| > 10 days | LOW |

Suggestions are sorted: CRITICAL → HIGH → MEDIUM → LOW, then by days of stock ascending.

## Docker

### Development (DB only)
```bash
docker compose up -d          # start PostgreSQL + Adminer
docker compose stop           # stop (keeps data)
docker compose down -v        # reset — deletes all data
```

### Production
```bash
docker compose -f docker-compose.prod.yml up -d
```

Multi-stage Dockerfile: JDK 21 build → JRE 21 Alpine runtime. Non-root user, `UseContainerSupport` JVM flags.

## Database Migrations

Flyway migrations in `src/main/resources/db/migration/`:

| File | Description |
|---|---|
| `V1__init_schema.sql` | Creates all 5 tables |
| `V2__indexes_and_views.sql` | Indexes + `current_inventory` view |
| `V3__forecast_run_cleanup.sql` | Removes legacy ARN columns, adds `products_processed` |
| `V4__users.sql` | Creates `users` table for JWT authentication |

## Project Status

| Sprint | Description | Status |
|--------|-------------|--------|
| Sprint 1 | Foundation: entities, repositories, services, controllers | ✅ Done |
| Sprint 2 | Holt-Winters forecasting engine + AWS S3/SNS integration | ✅ Done |
| Sprint 3 | PDF/Excel reports, suggestion engine, dashboard | ✅ Done |
| Sprint 4 | JWT security, React frontend, Dockerfile, GitHub Actions CI | ✅ Done |
