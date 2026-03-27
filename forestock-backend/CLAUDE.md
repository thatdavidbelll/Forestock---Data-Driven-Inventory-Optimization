# Forestock — Project Context for Claude Code

## What is Forestock

Forestock is a **Decision Support Tool** for retail store managers. It analyzes historical sales data and current inventory, runs ML forecasting via Holt-Winters Triple Exponential Smoothing (internal Java engine), and generates prioritized restocking suggestions. The store manager sees what to order and how much — the final decision is always human. The app never sends orders automatically.

**Domain:** `forestock.app` (to be registered)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Java 21, Spring Boot 4.0.4 |
| Build | Maven |
| Database | PostgreSQL 16 (AWS RDS in prod) |
| ORM | Spring Data JPA + Hibernate |
| Migrations | Flyway |
| ML Forecasting | Holt-Winters Triple Exponential Smoothing (Java intern) |
| File Storage | AWS S3 |
| Notifications | AWS SNS |
| Security | Spring Security + JJWT 0.12.6 |
| Mapping | MapStruct 1.6.3 |
| CSV Parsing | Apache Commons CSV 1.12.0 |
| Excel Export | Apache POI 5.3.0 |
| API Docs | SpringDoc OpenAPI 2.8.6 |
| Containerization | Docker + Docker Compose |
| Frontend | React + Vite + TypeScript (Sprint 4) |

---

## Project Structure

```
forestock-backend/
│
├── src/
│   ├── main/
│   │   ├── java/
│   │   │   └── com/forestock/forestock_backend/
│   │   │       ├── ForestockBackendApplication.java  @SpringBootApplication @EnableScheduling
│   │   │       │
│   │   │       ├── config/
│   │   │       │   ├── AwsConfig.java               S3Client, SnsClient beans
│   │   │       │   ├── DatabaseConfig.java           DataSource config
│   │   │       │   └── SecurityConfig.java           JWT filter chain
│   │   │       │
│   │   │       ├── domain/
│   │   │       │   ├── Product.java                 @Entity
│   │   │       │   ├── Inventory.java               @Entity
│   │   │       │   ├── SalesTransaction.java        @Entity
│   │   │       │   ├── ForecastRun.java             @Entity
│   │   │       │   ├── OrderSuggestion.java         @Entity
│   │   │       │   └── enums/
│   │   │       │       ├── ForecastStatus.java      RUNNING / COMPLETED / FAILED
│   │   │       │       └── Urgency.java             CRITICAL / HIGH / MEDIUM / LOW
│   │   │       │
│   │   │       ├── repository/
│   │   │       │   ├── ProductRepository.java
│   │   │       │   ├── InventoryRepository.java
│   │   │       │   ├── SalesTransactionRepository.java
│   │   │       │   ├── ForecastRunRepository.java
│   │   │       │   └── OrderSuggestionRepository.java
│   │   │       │
│   │   │       ├── service/
│   │   │       │   ├── InventoryService.java        current stock, reorder alerts
│   │   │       │   ├── SalesIngestionService.java   CSV import, validation, upsert
│   │   │       │   ├── ForecastOrchestrator.java    coordinates full forecast cycle
│   │   │       │   ├── ForecastingEngine.java       Holt-Winters Triple Exp. Smoothing
│   │   │       │   ├── S3DataExportService.java     backup CSV → S3 input/
│   │   │       │   ├── SuggestionEngine.java        qty calc, urgency, sorting
│   │   │       │   ├── ReportService.java           PDF + Excel generation
│   │   │       │   └── NotificationService.java     SNS/email alerts
│   │   │       │
│   │   │       ├── controller/
│   │   │       │   ├── ProductController.java       /api/products
│   │   │       │   ├── InventoryController.java     /api/inventory
│   │   │       │   ├── SalesController.java         /api/sales
│   │   │       │   ├── ForecastController.java      /api/forecast
│   │   │       │   ├── SuggestionController.java    /api/suggestions
│   │   │       │   └── DashboardController.java     /api/dashboard
│   │   │       │
│   │   │       ├── dto/
│   │   │       │   ├── request/
│   │   │       │   │   ├── InventoryUpdateRequest.java
│   │   │       │   │   └── SalesImportRequest.java
│   │   │       │   └── response/
│   │   │       │       ├── ApiResponse.java         generic wrapper: {status, message, data}
│   │   │       │       ├── ProductDto.java
│   │   │       │       ├── InventoryDto.java
│   │   │       │       ├── SuggestionDto.java
│   │   │       │       ├── ForecastRunDto.java
│   │   │       │       └── DashboardDto.java
│   │   │       │
│   │   │       └── scheduler/
│   │   │           └── DailyForecastJob.java        @Scheduled cron 02:00 nightly
│   │   │
│   │   └── resources/
│   │       ├── application.yml                      common config (all envs)
│   │       ├── application-dev.yml                  dev overrides (localhost DB)
│   │       ├── application-prod.yml                 prod overrides (env vars, no Swagger)
│   │       └── db/
│   │           └── migration/
│   │               ├── V1__init_schema.sql          products, inventory, sales, forecast_runs, order_suggestions
│   │               └── V2__indexes_and_views.sql    indexes + current_inventory view
│   │
│   └── test/
│       └── java/com/previzo/
│           ├── service/
│           │   ├── SuggestionEngineTest.java
│           │   └── SalesIngestionServiceTest.java
│           └── controller/
│               └── InventoryControllerTest.java
│
├── Dockerfile                                       multi-stage: JDK build → JRE runtime
├── .dockerignore                                    excludes target/, .git/, *.md
├── docker-compose.yml                               dev: PostgreSQL 16 + Adminer
├── docker-compose.prod.yml                          prod: app + PostgreSQL, env vars
└── pom.xml
```

---

## Database Schema

### products
```sql
CREATE TABLE products (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku            VARCHAR(50)  UNIQUE NOT NULL,
    name           VARCHAR(255) NOT NULL,
    category       VARCHAR(100),
    unit           VARCHAR(20)  NOT NULL,        -- 'buc', 'kg', 'L'
    reorder_point  DECIMAL(10,2),               -- threshold below which alert fires
    max_stock      DECIMAL(10,2),               -- max warehouse capacity
    active         BOOLEAN DEFAULT TRUE,
    created_at     TIMESTAMP DEFAULT NOW()
);
```

### inventory
```sql
CREATE TABLE inventory (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id  UUID REFERENCES products(id) NOT NULL,
    quantity    DECIMAL(10,2) NOT NULL,
    recorded_at TIMESTAMP DEFAULT NOW()
);

-- Always use this view for current stock — never query inventory directly
CREATE VIEW current_inventory AS
    SELECT DISTINCT ON (product_id)
           product_id, quantity, recorded_at
    FROM inventory
    ORDER BY product_id, recorded_at DESC;
```

### sales_transactions
```sql
CREATE TABLE sales_transactions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id    UUID REFERENCES products(id) NOT NULL,
    quantity_sold DECIMAL(10,2) NOT NULL,
    sale_date     DATE NOT NULL,
    UNIQUE (product_id, sale_date)              -- one record per product per day
);

CREATE INDEX idx_sales_product_date ON sales_transactions(product_id, sale_date);
```

### forecast_runs
```sql
CREATE TABLE forecast_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status          VARCHAR(50) NOT NULL,        -- RUNNING / COMPLETED / FAILED
    started_at      TIMESTAMP,
    finished_at     TIMESTAMP,
    horizon_days    INTEGER DEFAULT 14,
    predictor_arn   VARCHAR(512),
    forecast_arn    VARCHAR(512),
    error_message   TEXT,
    triggered_by    VARCHAR(50) DEFAULT 'SCHEDULER'  -- or 'MANUAL'
);
```

### order_suggestions
```sql
CREATE TABLE order_suggestions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id       UUID REFERENCES products(id) NOT NULL,
    forecast_run_id  UUID REFERENCES forecast_runs(id),
    suggested_qty    DECIMAL(10,2) NOT NULL,
    forecast_p50     DECIMAL(10,2),              -- median demand over 14 days
    forecast_p90     DECIMAL(10,2),              -- optimistic demand over 14 days
    current_stock    DECIMAL(10,2),              -- stock at time of generation
    days_of_stock    DECIMAL(6,2),               -- how many days stock will last
    urgency          VARCHAR(20),                -- CRITICAL / HIGH / MEDIUM / LOW
    generated_at     TIMESTAMP DEFAULT NOW()
);
```

---

## REST API Endpoints

```
── Inventory ──────────────────────────────────────────────────────
GET    /api/inventory                    current stock all products
GET    /api/inventory/alerts             products below reorder_point
PUT    /api/inventory/{productId}        manual stock update
GET    /api/inventory/{productId}/history  snapshot history

── Sales ──────────────────────────────────────────────────────────
POST   /api/sales/import                 upload CSV from POS (multipart)
GET    /api/sales/summary                aggregated summary by period
GET    /api/sales/{sku}/daily            daily sales per product

── Forecast ───────────────────────────────────────────────────────
POST   /api/forecast/run                 manually trigger a cycle
GET    /api/forecast/runs                history (status, duration)
GET    /api/forecast/runs/{id}           specific run details
GET    /api/forecast/latest              predictions from latest run

── Suggestions ────────────────────────────────────────────────────
GET    /api/suggestions                  list, filterable by urgency/category
GET    /api/suggestions/export/pdf       download PDF report
GET    /api/suggestions/export/excel     download Excel report
GET    /api/suggestions/{id}             detail with P10/P50/P90

── Dashboard ──────────────────────────────────────────────────────
GET    /api/dashboard                    KPIs: alerts, CRITICAL count, last run
GET    /api/dashboard/categories         breakdown by product category

── Auth ───────────────────────────────────────────────────────────
POST   /api/auth/login                   returns accessToken + refreshToken
POST   /api/auth/refresh                 refresh expired token
```

---

## Forecasting Flow (Holt-Winters)

> Amazon Forecast nu mai este disponibil pentru clienți noi (discontinuat 2025).
> Forestock folosește Holt-Winters Triple Exponential Smoothing implementat în Java.

```
1. ForecastOrchestrator.runFullCycle() — pornit manual sau de DailyForecastJob
2. Creează ForecastRun cu status RUNNING în DB
3. SalesIngestionService.loadLast365Days() → List<DailySalesData> per SKU
   Missing days filled with 0 (calendar complet)
4. S3DataExportService.backupToS3() → upload CSV în S3 input/ (audit trail)
5. ForecastingEngine.forecast(salesData, horizonDays=14) per produs:
   a. dacă history >= 30 zile → Triple Exponential Smoothing (Holt-Winters)
      - optimizare parametri alpha/beta/gamma via grid search (min SSE)
      - sezonalitate săptămânală (period=7)
   b. dacă history < 30 zile → Simple Moving Average (fallback)
   c. rezultat: ForecastResult{p50, p90} pentru 14 zile
6. SuggestionEngine.generate() → qty + urgency → salvare OrderSuggestion în DB
7. ForecastRun → status COMPLETED cu timestamps
8. NotificationService → email via AWS SNS cu sumar run
```

### ForecastResult
```java
record ForecastResult(
    double p50Total,   // suma forecast median pe 14 zile
    double p90Total,   // suma forecast optimistic pe 14 zile (p50 × 1.20)
    List<Double> dailyValues  // valorile zilnice pentru debugging
) {}
```

---

## Business Logic — SuggestionEngine

### Quantity formula
```
suggestedQty = max(0, forecastP90_14days × 1.20 − currentStock)
rounded to nearest integer
```

### Urgency formula
```
dailyDemand  = forecastP50_14days / 14
daysOfStock  = currentStock / dailyDemand   (guard: if dailyDemand == 0 → 999)

daysOfStock < 2   → CRITICAL
daysOfStock 2–5   → HIGH
daysOfStock 5–10  → MEDIUM
daysOfStock > 10  → LOW
```

### Sorting
CRITICAL first → HIGH → MEDIUM → LOW, secondary sort by daysOfStock ASC

### Why P90 for quantity
P90 (optimistic) avoids stockouts, which are more costly than moderate overstock. P50 (median) is used only for urgency calculation.

---

## Configuration Files

### application.yml (common — always loaded)
Key sections:
- `spring.jpa.hibernate.ddl-auto: validate` — Flyway manages schema, not Hibernate
- `spring.flyway.locations: classpath:db/migration`
- `spring.servlet.multipart.max-file-size: 50MB`
- `spring.jackson.serialization.write-dates-as-timestamps: false`
- `aws.region: eu-central-1`
- `previzo.forecast.horizon-days: 14`
- `previzo.forecast.safety-buffer-pct: 0.20`
- `previzo.scheduler.cron: "0 0 2 * * *"`

### application-dev.yml (dev overrides)
- `spring.datasource.url: jdbc:postgresql://localhost:5432/previzo`
- `spring.datasource.username: previzo_user`
- `spring.datasource.password: previzo_pass`
- `spring.jpa.show-sql: true`
- `logging.level.com.previzo: DEBUG`
- `server.error.include-stacktrace: always`
- Swagger enabled

### application-prod.yml (prod overrides)
- `spring.datasource.url: ${SPRING_DATASOURCE_URL}`
- `spring.datasource.username: ${SPRING_DATASOURCE_USERNAME}`
- `spring.datasource.password: ${SPRING_DATASOURCE_PASSWORD}`
- `spring.jpa.show-sql: false`
- `logging.level.com.previzo: INFO`
- `server.error.include-stacktrace: never`
- Swagger disabled

### Activating profiles
```bash
# IntelliJ: Run → Edit Configurations → Environment variables:
SPRING_PROFILES_ACTIVE=dev

# Terminal:
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev

# Production (set in docker-compose.prod.yml):
SPRING_PROFILES_ACTIVE=prod
```

---

## Docker Setup

### docker-compose.yml (development — DB only)
```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: previzo-db
    environment:
      POSTGRES_DB: previzo
      POSTGRES_USER: previzo_user
      POSTGRES_PASSWORD: previzo_pass
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U previzo_user -d previzo"]
      interval: 10s
      timeout: 5s
      retries: 5

  adminer:
    image: adminer:latest
    ports:
      - "8090:8080"
    depends_on:
      postgres:
        condition: service_healthy
```

Access Adminer at http://localhost:8090
Server: postgres | User: previzo_user | Pass: previzo_pass | DB: previzo

### Daily dev workflow
```bash
docker-compose up -d          # start DB
./mvnw spring-boot:run        # run app from terminal (or IntelliJ)
docker-compose stop           # stop DB at end of day (keeps data)
docker-compose down -v        # nuclear reset — deletes all data
```

### Dockerfile (production — multi-stage)
- Stage 1: `eclipse-temurin:21-jdk-alpine` — Maven build
- Stage 2: `eclipse-temurin:21-jre-alpine` — runtime only
- Non-root user `previzo` for security
- JVM flags: `-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0`

---

## pom.xml Key Dependencies

```xml
<!-- Spring Boot parent — manages all Spring versions -->
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.5.9</version>
</parent>

<!-- AWS SDK BOM in <dependencyManagement> — manages all AWS module versions -->
<dependency>
    <groupId>software.amazon.awssdk</groupId>
    <artifactId>bom</artifactId>
    <version>2.42.18</version>
    <type>pom</type>
    <scope>import</scope>
</dependency>
```

### Properties
```xml
<properties>
    <java.version>21</java.version>
    <aws.sdk.version>2.42.18</aws.sdk.version>
    <commons-csv.version>1.12.0</commons-csv.version>
    <poi.version>5.3.0</poi.version>
    <jjwt.version>0.12.6</jjwt.version>
    <mapstruct.version>1.6.3</mapstruct.version>
    <springdoc.version>2.8.6</springdoc.version>
</properties>
```

### Critical build config
```xml
<!-- maven-compiler-plugin: Lombok BEFORE MapStruct in annotationProcessorPaths -->
<!-- spring-boot-maven-plugin: exclude Lombok from fat JAR -->
```

---

## Main Application Class

```java
package com.previzo;

@SpringBootApplication   // = @Configuration + @EnableAutoConfiguration + @ComponentScan
@EnableScheduling        // REQUIRED for DailyForecastJob @Scheduled to work
public class PrevizoApplication {
    public static void main(String[] args) {
        SpringApplication.run(PrevizoApplication.class, args);
    }
}
```

---

## Security

- JWT tokens, signed with secret from env var `JWT_SECRET`
- Access token expiry: 8h
- Refresh token expiry: 30 days
- All `/api/**` endpoints require authentication
- Public: `/api/auth/login`, `/api/auth/refresh`, `/api/auth/forgot-password`, `/api/auth/reset-password`, `/actuator/health`
- `/api/register` and `/api/admin/**` require `ROLE_SUPER_ADMIN`
- Rate limiting: 10 req/min per IP on `/api/auth/login` and `/api/auth/forgot-password` (RateLimitFilter.java — sliding window, no external deps)

### Roles
| Role | Permissions |
|---|---|
| ROLE_SUPER_ADMIN | Platform owner — creates stores, manages all stores, no store_id in JWT |
| ROLE_ADMIN | Full store access — products, inventory, sales, forecasts, user management |
| ROLE_MANAGER | Full use: view, import, export, trigger forecast (no user management) |
| ROLE_VIEWER | Read-only: dashboard, suggestions, export reports |

### Access model
- `ROLE_SUPER_ADMIN` is seeded by `DataInitializer` on first startup (env vars: `SUPER_ADMIN_USERNAME`, `SUPER_ADMIN_PASSWORD`)
- New stores are created by super admin via `POST /api/register` (no public self-registration)
- Store admins invite team members via `POST /api/users` (ROLE_MANAGER or ROLE_VIEWER only)
- Password reset: 1-hour single-use token sent via email (spring-boot-starter-mail + SMTP)

---

## Flyway Migrations

Files go in `src/main/resources/db/migration/`
Naming: `V{number}__{description}.sql` — double underscore required

```
V1__init_schema.sql              → create all 5 tables
V2__indexes_and_views.sql        → indexes + current_inventory view
V3__forecast_run_cleanup.sql     → remove legacy ARN columns, add products_processed
V4__users.sql                    → users table for JWT authentication
V5__multi_tenant.sql             → stores table + store_id FK on all 6 entities
V6__backfill_store_id.sql        → backfill store_id=NULL rows to default store
V7__user_email_and_reset.sql     → email, password_reset_token, password_reset_expires_at on users
```

Flyway runs automatically at Spring Boot startup and applies any missing migrations.
`ddl-auto: validate` means Hibernate checks schema matches entities but never modifies it.

---

## Roles & Sprints

### Sprint 1 (weeks 1–2) — Foundation
- Spring Boot setup, pom.xml, folder structure
- Docker Compose (postgres + adminer)
- application.yml, application-dev.yml
- Flyway V1 + V2 migrations
- JPA entities: Product, Inventory, SalesTransaction, ForecastRun, OrderSuggestion
- Repositories + services: InventoryService, SalesIngestionService
- Controllers: ProductController, InventoryController, SalesController
- DTOs: ApiResponse wrapper, all request/response DTOs

### Sprint 2 (weeks 3–4) — Forecasting Engine & AWS Integration
- AWS account, IAM user, S3 bucket setup (Amazon Forecast NU e disponibil pentru clienți noi)
- AwsConfig.java: S3Client + SnsClient beans
- ForecastingEngine.java: Holt-Winters Triple Exponential Smoothing
  - optimizare parametri alpha/beta/gamma (grid search, min SSE)
  - sezonalitate săptămânală (period=7)
  - fallback la Simple Moving Average pentru < 30 zile date
- S3DataExportService: backup date vânzări + rezultate forecast în S3
- ForecastOrchestrator: coordonează ciclul complet (load → forecast → sugestii → notificare)
- ForecastRun tracking: RUNNING → COMPLETED/FAILED

### Sprint 3 (weeks 5–6) — Business Logic
- SuggestionEngine: qty calculation, urgency, sorting
- OrderSuggestion persistence
- ForecastController, SuggestionController, DashboardController
- DailyForecastJob: nightly @Scheduled + guard against parallel runs
- ReportService: PDF (Apache PDFBox) + Excel (Apache POI)
- NotificationService: SNS email on forecast completion

### Sprint 4 (weeks 7–8) — Production
- Spring Security: JWT filter chain, login/refresh endpoints, roles
- React frontend: Vite + TypeScript, dashboard, suggestions page, import page
- Dockerfile multi-stage, .dockerignore
- GitHub Actions CI pipeline
- AWS EC2/ECS deploy, RDS PostgreSQL
- Nginx reverse proxy + HTTPS
- CloudWatch logging + alarms
- Unit tests (SuggestionEngine), integration tests (SalesIngestion)
- SpringDoc OpenAPI annotations, README.md

### Sprint 5 — Multi-tenant SaaS foundation
- Store + user entities with store_id FK on all tables (V4, V5, V6 migrations)
- TenantContext (ThreadLocal<UUID>) set by JwtAuthFilter from JWT storeId claim
- RegisterService: creates Store + admin user atomically
- JDBC batch UPSERT for CSV import (chunks of 500, ~2s for 8000+ rows)
- Data management: products (soft/hard delete, restore), sales (delete by SKU/range/all), inventory
- Neon PostgreSQL (serverless) as cloud dev database
- React frontend with 6 pages: Dashboard, Suggestions, Products, Inventory, Sales, Import

### Sprint 6 — Commercial launch features
- ROLE_SUPER_ADMIN: platform owner controls store creation (no public self-registration)
- DataInitializer: seeds super admin on first startup (SUPER_ADMIN_USERNAME/PASSWORD env vars)
- V7 migration: email + password reset token columns on users
- UserManagementService + UserController: store admins manage team (invite/role/deactivate)
- PlatformAdminController: list all stores, activate/deactivate (/api/admin/*)
- PasswordResetService: forgot/reset flow via email (spring-boot-starter-mail)
- RateLimitFilter: 10 req/min per IP on login + forgot-password (sliding window, no deps)
- Frontend: AdminPage, UsersPage, SettingsPage, ForgotPasswordPage, ResetPasswordPage
- Frontend: silent JWT refresh on 401, role-based navigation, login → role-aware redirect

---

## Important Conventions

- Package root: `com.forestock.forestock_backend` — all classes must be under this package for @ComponentScan to work
- Entity IDs: UUID, generated with `gen_random_uuid()`
- All API responses wrapped in `ApiResponse<T>`: `{status, message, data}`
- CSV format for AWS Forecast: `item_id, timestamp (yyyy-MM-dd), target_value`
- Missing sales days filled with 0 (store closed = 0 sales, not null)
- Never write AWS credentials or passwords in .yml files — use `${ENV_VAR}` syntax
- `show-sql: true` only in dev profile
- Swagger/OpenAPI only enabled in dev profile
- Stack traces in error responses only in dev profile
- Lombok annotation processor must come BEFORE MapStruct in pom.xml

---

## Environment Variables Required

### Development
Set in IntelliJ Run Configuration or export in terminal:
```
SPRING_PROFILES_ACTIVE=dev
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=forestock-forecast-data-104091534682
AWS_SNS_TOPIC_ARN=...
```

### Production (docker-compose.prod.yml)
```
SPRING_PROFILES_ACTIVE=prod
SPRING_DATASOURCE_URL=jdbc:postgresql://postgres:5432/forestock
SPRING_DATASOURCE_USERNAME=...
SPRING_DATASOURCE_PASSWORD=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=eu-central-1
AWS_S3_BUCKET=forestock-forecast-data-104091534682
AWS_SNS_TOPIC_ARN=...
JWT_SECRET=...
FORESTOCK_ALERT_EMAIL=manager@magazin.ro
SUPER_ADMIN_USERNAME=superadmin
SUPER_ADMIN_PASSWORD=<strong-password>
FORESTOCK_FRONTEND_URL=https://app.forestock.app
# Optional — enables password reset emails:
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=your@gmail.com
MAIL_PASSWORD=<app-password>
MAIL_FROM=noreply@forestock.app
```

---

## Current Status

**Sprint 1 — COMPLET**
- [x] Spring Boot project generated (start.spring.io)
- [x] pom.xml configured (AWS SDK BOM, all dependencies, annotation processors)
- [x] Docker Compose created (postgres + adminer)
- [x] Dockerfile created (multi-stage)
- [x] .dockerignore created
- [x] application.yml created
- [x] application-dev.yml created
- [x] application-prod.yml created
- [x] ForestockBackendApplication.java — added @EnableScheduling
- [x] Folder structure creation (domain/, repository/, service/, controller/, dto/)
- [x] Flyway V1__init_schema.sql
- [x] Flyway V2__indexes_and_views.sql
- [x] JPA Entities (Product, Inventory, SalesTransaction, ForecastRun, OrderSuggestion + enums)
- [x] Repositories (5 JpaRepository interfaces cu query-uri custom)
- [x] Services (InventoryService, SalesIngestionService)
- [x] Controllers (ProductController, InventoryController, SalesController)
- [x] DTOs (ApiResponse, ProductDto, InventoryDto, SuggestionDto, ForecastRunDto, DashboardDto, request DTOs)

**Sprint 2 — COMPLET** (Forecasting Engine + AWS)
**Sprint 3 — COMPLET** (Reports, Suggestions, Scheduler)
**Sprint 4 — COMPLET** (Security, Frontend, CI/CD)
**Sprint 5 — COMPLET** (Multi-tenant, JDBC batch, data management)
**Sprint 6 — COMPLET** (Commercial launch: SUPER_ADMIN, user mgmt, password reset, rate limiting)
