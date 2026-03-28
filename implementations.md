# Forestock — MVP Implementation Guide

> **Purpose:** Precise, copy-paste-ready instructions for GPT (or any AI agent) to continue implementing the Forestock MVP. Every item references exact file paths, class names, method signatures, and database migration numbering as they exist after IMPL-05.
>
> **Codebase state:** Spring Boot 4.0.4 · Java 21 · React 19 · Vite · TailwindCSS 4 · PostgreSQL 17 · Flyway V1–V10 · JJWT 0.12.6
>
> **Package root:** `com.forestock.forestock_backend`
> **Frontend root:** `forestock-frontend/src/`

---

## Implementation Priority Order

| # | Feature | Category | Effort |
|---|---|---|---|
| 1 | Suggestion Acknowledgement | Core | Low |
| 2 | Forecast Auto-Trigger After Import | Core | Low |
| 3 | CSV Import Row-Level Validation & Error Response | Stability | Medium |
| 4 | Server-Side Token Revocation (Redis Blacklist) | Security | Medium |
| 5 | Email Verification on First Login | Security | Medium |
| 6 | Password Strength Enforcement | Security | Low |
| 7 | Audit Log | Core / Pre-Launch | Medium |
| 8 | Transactional Email — AWS SES | Pre-Launch | Low |
| 9 | Empty State + Guided Onboarding | UX | Medium |
| 10 | In-App Forecast Status Polling | UX | Low |
| 11 | GDPR — Privacy Policy, ToS, Data Export | Pre-Launch | Medium |
| 12 | PostHog Analytics | Pre-Launch | Low |
| 13 | Stripe Billing + Trial Enforcement | Pre-Launch | High |
| 14 | Production Deployment (ECS + RDS + Redis) | Stability | High |

---

## Completed

- `IMPL-01` Suggestion Acknowledgement
- `IMPL-02` Forecast Auto-Trigger After Import
- `IMPL-03` CSV Import Row-Level Validation & Structured Error Response
- `IMPL-04` Server-Side Token Revocation (Redis Blacklist)
- `IMPL-05` Email Verification on First Login
- `IMPL-06` Password Strength Enforcement
- `IMPL-07` Audit Log
- `IMPL-09` Empty State + Guided Onboarding
- `IMPL-10` In-App Forecast Status Polling

### Notes

- `cloud` profile runs against Neon PostgreSQL and disables token-blacklist enforcement so local Docker Redis is not required during cloud development.

---

## IMPL-01 — Suggestion Acknowledgement / Dismissal

### Why
`OrderSuggestion` has no lifecycle state. Every CRITICAL suggestion reappears on every page load. Store managers cannot mark "I've ordered this." The suggestions list becomes noise within one day of use.

### Backend

**New field on `OrderSuggestion.java`**
(`forestock-backend/src/main/java/com/forestock/forestock_backend/domain/OrderSuggestion.java`)

Add two fields to the existing `@Entity`:
```java
private Boolean acknowledged = false;
private LocalDateTime acknowledgedAt;
```

**New Flyway migration: `V8__suggestion_acknowledgement.sql`**
(`forestock-backend/src/main/resources/db/migration/V8__suggestion_acknowledgement.sql`)

```sql
ALTER TABLE order_suggestions
    ADD COLUMN acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN acknowledged_at TIMESTAMP;

CREATE INDEX idx_order_suggestions_acknowledged
    ON order_suggestions (store_id, acknowledged);
```

**New endpoint in `SuggestionController.java`**
(`forestock-backend/src/main/java/com/forestock/forestock_backend/controller/SuggestionController.java`)

```java
@PatchMapping("/{id}/acknowledge")
public ResponseEntity<ApiResponse<SuggestionDto>> acknowledge(@PathVariable UUID id) {
    return ResponseEntity.ok(ApiResponse.success(suggestionService.acknowledge(id)));
}
```

**New method in `SuggestionService.java`**
(`forestock-backend/src/main/java/com/forestock/forestock_backend/service/SuggestionService.java`)

```java
public SuggestionDto acknowledge(UUID id) {
    UUID storeId = TenantContext.getStoreId();
    OrderSuggestion s = orderSuggestionRepository.findByIdAndStoreId(id, storeId)
        .orElseThrow(() -> new EntityNotFoundException("Suggestion not found"));
    s.setAcknowledged(true);
    s.setAcknowledgedAt(LocalDateTime.now());
    return toDto(orderSuggestionRepository.save(s));
}
```

Add `findByIdAndStoreId(UUID id, UUID storeId)` to `OrderSuggestionRepository.java`.

**Filter acknowledged suggestions by default.** Update `GET /api/suggestions` to accept `?includeAcknowledged=false` query param. Filter in the repository query.

**`SuggestionDto.java`** — add `boolean acknowledged` and `LocalDateTime acknowledgedAt` fields.

### Frontend

**`SuggestionsPage.tsx`**
(`forestock-frontend/src/pages/SuggestionsPage.tsx`)

- Add a column "Status" to the table with an "Acknowledge" button for non-acknowledged rows.
- On click: `PATCH /api/suggestions/{id}/acknowledge` → remove row from list (or show "Acknowledged" badge).
- Add toggle: "Show acknowledged" checkbox that appends `&includeAcknowledged=true` to the fetch URL.

---

## IMPL-02 — Forecast Auto-Trigger After Sales Import

### Why
New users import CSV data and see empty suggestions because they don't know to click "Run Forecast." The `ForecastOrchestrator` already exists — it just needs to be called asynchronously after a successful import.

### Backend

**`SalesController.java`**
(`forestock-backend/src/main/java/com/forestock/forestock_backend/controller/SalesController.java`)

After a successful `importCsv()` call (non-zero `imported` count), call:
```java
forecastOrchestrator.runForecast("auto-import");
```
This method is already `@Async` annotated in `ForecastOrchestrator`. Inject `ForecastOrchestrator` into `SalesController`.

**Important:** Only trigger if `result.imported() > 0`. Do not trigger on 0-import (all skipped) responses.

**`ForecastOrchestrator.java`**
(`forestock-backend/src/main/java/com/forestock/forestock_backend/service/ForecastOrchestrator.java`)

Verify the `runForecast(String triggeredBy)` method is marked `@Async` and `@Transactional`. The `storeId` must be captured from `TenantContext` *before* the async boundary (pass it as a parameter, not via `ThreadLocal` inside the async method, since `ThreadLocal` does not cross thread boundaries).

Fix pattern if needed:
```java
@Async
public void runForecast(UUID storeId, String triggeredBy) {
    // use storeId directly, not TenantContext.getStoreId()
}
```
And call it as:
```java
forecastOrchestrator.runForecast(TenantContext.getStoreId(), "auto-import");
```

### Frontend

**`ImportPage.tsx`** — after a successful import response, add a banner:
> "Import complete. A forecast is running in the background — check the Dashboard in a few seconds."

---

## IMPL-03 — CSV Import Row-Level Validation & Structured Error Response

### Why
Malformed dates, negative quantities, or unknown SKUs currently produce generic 500 errors. Users need to know *which rows* failed and *why*, so they can fix their CSV without guessing.

### Backend

**`SalesIngestionService.java`**
(`forestock-backend/src/main/java/com/forestock/forestock_backend/service/SalesIngestionService.java`)

The `ImportResult` record already has `List<String> errors`. Enhance validation per row:

1. **Unknown SKU:** if `productsBySku.get(sku) == null` → add error `"Row N: SKU 'X' not found in product catalogue"` and skip row.
2. **Negative or zero quantity:** if `qty <= 0` → add error `"Row N: quantity_sold must be a positive number (got X)"` and skip row.
3. **Invalid date format:** wrap `LocalDate.parse(dateStr)` in try-catch → add error `"Row N: invalid sale_date format 'X' — expected yyyy-MM-dd"` and skip row.
4. **Missing headers:** validate `EXPECTED_HEADERS` against actual CSV header record at the top of `importCsv()`. Return immediately with a single error if headers are wrong.
5. **File size / line count guard:** if parsed row count > 100,000 return error before processing.

Return `ImportResult(imported, skipped, errors)` — errors already flows through to the frontend `ImportPage.tsx` where it renders `errors: string[]` per row.

**No new DTO needed.** The existing `ImportResult` record and frontend display are already wired up.

---

## IMPL-04 — Server-Side Token Revocation (Redis Blacklist)

### Why
Currently a deactivated user's JWT stays valid for up to 8 hours. An employee whose role is removed or who is deactivated can continue using the API. This is a critical security gap for multi-user SaaS.

### Backend

**Add Redis dependency to `pom.xml`:**
```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
```

**Add Redis config to `application.yml`:**
```yaml
spring:
  data:
    redis:
      host: ${REDIS_HOST:localhost}
      port: ${REDIS_PORT:6379}
      password: ${REDIS_PASSWORD:}
```

**New `TokenBlacklistService.java`**
(`forestock-backend/src/main/java/com/forestock/forestock_backend/service/TokenBlacklistService.java`)

```java
@Service
@RequiredArgsConstructor
public class TokenBlacklistService {
    private final StringRedisTemplate redisTemplate;
    private static final String PREFIX = "jwt:blacklist:";

    public void blacklist(String jti, Duration ttl) {
        redisTemplate.opsForValue().set(PREFIX + jti, "1", ttl);
    }

    public boolean isBlacklisted(String jti) {
        return Boolean.TRUE.equals(redisTemplate.hasKey(PREFIX + jti));
    }
}
```

**Add `jti` claim to `JwtService.java`**
(`forestock-backend/src/main/java/com/forestock/forestock_backend/service/JwtService.java`)

In both `generateAccessToken` and `generateRefreshToken`, add:
```java
.id(UUID.randomUUID().toString())  // sets "jti" claim
```

Add extraction method:
```java
public String extractJti(String token) {
    return extractClaim(token, Claims::getId);
}
```

**`JwtAuthFilter.java`**
(`forestock-backend/src/main/java/com/forestock/forestock_backend/security/JwtAuthFilter.java`)

After extracting and validating the token, add:
```java
String jti = jwtService.extractJti(token);
if (tokenBlacklistService.isBlacklisted(jti)) {
    response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
    return;
}
```

**Blacklist on logout / password change / user deactivation:**

Add `POST /api/auth/logout` to `AuthController.java`:
```java
@PostMapping("/logout")
public ResponseEntity<ApiResponse<Void>> logout(HttpServletRequest request) {
    String token = extractBearer(request);
    if (token != null) {
        String jti = jwtService.extractJti(token);
        Duration remaining = jwtService.getRemainingTtl(token);
        tokenBlacklistService.blacklist(jti, remaining);
    }
    return ResponseEntity.ok(ApiResponse.success("Logged out", null));
}
```

Add `getRemainingTtl(String token)` to `JwtService` — compute `expiry - now`.

Also blacklist the *old* token in `UserManagementService.changePassword()` and `UserManagementService.deactivateUser()` — these need the caller's current token passed in. The cleanest way: accept the current JWT from the `SecurityContext` via `SecurityContextHolder.getContext().getAuthentication()`.

**`SecurityConfig.java`** — add `/api/auth/logout` to authenticated endpoints (not PUBLIC).

### Frontend

**`AuthContext.tsx`** — in `logout()`, call `POST /api/auth/logout` with Bearer token before clearing localStorage.

---

## IMPL-05 — Email Verification on First Login

### Why
Unverified emails make password reset unreliable and allow bot-created accounts. New store admins should verify their email before accessing the application.

### Backend

**`AppUser.java`** — add field:
```java
private Boolean emailVerified = false;
private String emailVerificationToken;
private LocalDateTime emailVerificationSentAt;
```

**V9 migration: `V9__email_verification.sql`**
```sql
ALTER TABLE users
    ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN email_verification_token VARCHAR(255),
    ADD COLUMN email_verification_sent_at TIMESTAMP;

CREATE UNIQUE INDEX idx_users_email_verification_token
    ON users (email_verification_token)
    WHERE email_verification_token IS NOT NULL;
```

**New `EmailVerificationService.java`**

Methods:
- `sendVerificationEmail(AppUser user)` — generates `UUID.randomUUID().toString()` token, stores on user, sends email with link `{frontendUrl}/verify-email?token={token}`
- `verifyEmail(String token)` — finds user by token, checks `emailVerificationSentAt` is within 48 hours, sets `emailVerified = true`, clears token

**`RegisterService.java`** — after creating the store admin user, call `emailVerificationService.sendVerificationEmail(user)`.

**`UserDetailsServiceImpl.java`** — after confirming `active == true`, add:
```java
if (user.getEmail() != null && !Boolean.TRUE.equals(user.getEmailVerified())) {
    throw new DisabledException("Email not verified. Check your inbox.");
}
```

**New endpoint in `AuthController.java`:**
```java
@GetMapping("/verify-email")
public ResponseEntity<ApiResponse<Void>> verifyEmail(@RequestParam String token) { ... }

@PostMapping("/resend-verification")
public ResponseEntity<ApiResponse<Void>> resendVerification(@RequestBody Map<String, String> body) { ... }
```

Add both to `PUBLIC_ENDPOINTS` in `SecurityConfig.java`.

**`AppUserRepository.java`** — add:
```java
Optional<AppUser> findByEmailVerificationToken(String token);
```

### Frontend

**New page `VerifyEmailPage.tsx`** — reads `?token=` from URL, calls `GET /api/auth/verify-email?token=`, shows success/error, links to `/login`.

**`LoginPage.tsx`** — handle `DisabledException` (HTTP 403 with specific message) and show "Please verify your email. [Resend verification email]" with a link/button that calls `POST /api/auth/resend-verification`.

**`App.tsx`** — add public route `/verify-email → VerifyEmailPage`.

---

## IMPL-06 — Password Strength Enforcement

### Why
`CreateUserRequest` has `@Size(min=8)` but no complexity requirement. The seeded super admin default password `Admin@12345` is strong by coincidence, not enforcement. Weak passwords are a breach risk.

### Backend

**New annotation `@StrongPassword`** or use a custom `ConstraintValidator`:
(`forestock-backend/src/main/java/com/forestock/forestock_backend/validation/StrongPasswordValidator.java`)

Rule: min 8 chars, at least 1 uppercase, 1 lowercase, 1 digit, 1 special character. Regex:
```
^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_\-#])[A-Za-z\d@$!%*?&_\-#]{8,100}$
```

Apply `@StrongPassword` to:
- `CreateUserRequest.password`
- `ResetPasswordRequest.newPassword`
- `ChangePasswordRequest.newPassword`

**`DataInitializer.java`** — log a `WARN` if `SUPER_ADMIN_PASSWORD` env var is not set (i.e., default is in use in a non-dev profile).

### Frontend

**`UsersPage.tsx`**, **`SettingsPage.tsx`**, **`ResetPasswordPage.tsx`** — add client-side password strength indicator showing which rules are met (green/red checkmarks). This is purely a UX enhancement — server validation is the authority.

---

## IMPL-07 — Audit Log

### Why
Multi-user stores require accountability. Who deleted all sales data? Who deactivated a product? Who changed a role? Without this, support becomes guesswork and trust erodes.

### Backend

**New entity `AuditLog.java`**
(`forestock-backend/src/main/java/com/forestock/forestock_backend/domain/AuditLog.java`)

```java
@Entity
@Table("audit_logs")
@Getter @Builder @NoArgsConstructor @AllArgsConstructor
public class AuditLog {
    @Id @GeneratedValue UUID id;
    UUID storeId;           // nullable (null = super admin action)
    String actorUsername;
    String action;          // e.g. "USER_DEACTIVATED", "PRODUCT_DELETED", "SALES_IMPORTED"
    String entityType;      // e.g. "AppUser", "Product", "SalesTransaction"
    String entityId;        // UUID or SKU string
    String detail;          // JSON string or short description
    @CreationTimestamp LocalDateTime occurredAt;
}
```

**V10 migration: `V10__audit_log.sql`**
```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES stores(id),
    actor_username VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id VARCHAR(255),
    detail TEXT,
    occurred_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_store_id ON audit_logs (store_id, occurred_at DESC);
CREATE INDEX idx_audit_logs_actor ON audit_logs (actor_username);
```

**New `AuditLogService.java`**

```java
@Service
@RequiredArgsConstructor
public class AuditLogService {
    private final AuditLogRepository auditLogRepository;

    public void log(String action, String entityType, String entityId, String detail) {
        String actor = SecurityContextHolder.getContext().getAuthentication().getName();
        UUID storeId = TenantContext.getStoreId();
        auditLogRepository.save(AuditLog.builder()
            .storeId(storeId)
            .actorUsername(actor)
            .action(action)
            .entityType(entityType)
            .entityId(entityId)
            .detail(detail)
            .build());
    }
}
```

**Inject `AuditLogService` and call `log()` in:**
- `UserManagementService`: `createUser`, `updateUser`, `deactivateUser`, `changePassword`
- `ProductController` or `ProductService`: create, update, soft delete, hard delete, restore
- `SalesIngestionService`: after import (log count of rows imported)
- `SalesController`: delete operations
- `InventoryService`: `updateStock`
- `PlatformAdminController`: store activate/deactivate

**New endpoint `GET /api/audit-logs`** — `ROLE_ADMIN` only, store-scoped, paginated, filterable by `action` and date range.

**`SecurityConfig.java`** — add `/api/audit-logs` to ROLE_ADMIN rules.

### Frontend

**New `AuditLogPage.tsx`** — accessible from the Settings page for ROLE_ADMIN. Table: occurred_at, actor, action, entity, detail. Add route `/audit` to `App.tsx`.

---

## IMPL-08 — Transactional Email via AWS SES

### Why
The current SMTP setup uses a Gmail app password. Gmail rate-limits transactional email to ~500/day, has no bounce/complaint handling, and messages frequently land in spam. Password reset is the *only* account recovery mechanism — if that email doesn't arrive, the user is locked out.

### Backend

**Add SES dependency to `pom.xml`:**
```xml
<dependency>
    <groupId>software.amazon.awssdk</groupId>
    <artifactId>ses</artifactId>
</dependency>
```
(AWS SDK BOM `2.42.18` is already imported — no version needed.)

**New `SesEmailService.java`**
(`forestock-backend/src/main/java/com/forestock/forestock_backend/service/SesEmailService.java`)

Wrap `SesClient` to send `SendEmailRequest` with `from: noreply@forestock.app` (must be verified in SES console). Provide a method:
```java
public void send(String toAddress, String subject, String htmlBody)
```

**`PasswordResetService.java`** and **`EmailVerificationService.java`** — replace `JavaMailSender` calls with `SesEmailService.send()`.

**`application.yml`** — add:
```yaml
aws:
  ses:
    from-address: ${MAIL_FROM:noreply@forestock.app}
```

**Environment variables to add to production:**
- Remove: `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`
- Ensure: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION=eu-central-1` (already present)
- Add SES send permissions to the IAM role/user.

---

## IMPL-09 — Empty State + Guided Onboarding

### Why
A brand-new store admin sees empty tables everywhere. Without guidance, they churn before reaching the "aha moment" (seeing their first suggestion). Time-to-value is the #1 SaaS conversion metric.

### Frontend

**`DashboardPage.tsx`** — when `totalActiveProducts === 0`:
- Replace KPI cards with a 3-step onboarding card:
  1. **Add your products** → link to `/products`
  2. **Import sales data** → link to `/import`
  3. **Run a forecast** → button inline (calls `POST /api/forecast/run`)
- Once `totalActiveProducts > 0` and `lastRunStatus` is null: show step 2 + 3 only.
- Once a forecast has run: hide the wizard entirely.

**`SuggestionsPage.tsx`** — when `suggestions.length === 0` and not `loading`:
- Show a centered empty state:
  - If no products: "No products yet. [Add your first product →]"
  - If products but no forecast: "No suggestions yet. [Run a forecast →] or [Import sales data →]"
  - If post-forecast with 0 suggestions: "Everything looks well-stocked! Check back after your next import."

**`InventoryPage.tsx`** and **`ProductsPage.tsx`** — add a simple empty state with a CTA to the relevant action when the list is empty.

---

## IMPL-10 — In-App Forecast Status Polling

### Why
`POST /api/forecast/run` is async — the backend returns immediately but the forecast runs for several seconds. The dashboard shows a static "Forecast triggered" text with no feedback. Users don't know when to refresh.

### Frontend

**`DashboardPage.tsx`**

After clicking "Run Forecast":
1. Set `forecastStatus = 'RUNNING'` locally.
2. Start polling `GET /api/forecast/latest` every 3 seconds.
3. When the response shows `status === 'COMPLETED'` or `status === 'FAILED'`:
   - Stop polling.
   - Re-fetch dashboard KPIs.
   - Show success or error banner.
4. Timeout after 60 seconds — show "Forecast is taking longer than expected. Refresh the page later."

Use `useRef` to store the polling interval ID and clear it in `useEffect` cleanup.

### Backend

`GET /api/forecast/latest` already exists in `ForecastController.java`. No backend changes needed.

---

## IMPL-11 — GDPR Compliance: Privacy Policy, Terms of Service, Data Export

### Why
Forestock processes personal data (names, emails) and business data of EU retail companies. Operating without a Privacy Policy or ToS is a legal liability. Data export is required under GDPR Article 20 (right to data portability).

### Frontend

**`LoginPage.tsx`** — add footer links: "Privacy Policy" and "Terms of Service". These can link to static external pages (Notion, Google Docs) initially.

**New `GdprPage.tsx`** or a section in **`SettingsPage.tsx`** — "Download my data" button that calls `GET /api/users/me/export`.

### Backend

**New endpoint `GET /api/users/me/export`** in `UserController.java`:

Returns a ZIP file containing:
1. `profile.json` — username, email, role, createdAt
2. `products.csv` — all products for this store
3. `sales.csv` — all sales transactions for this store
4. `inventory.csv` — current inventory snapshot

Use `java.util.zip.ZipOutputStream` to build the archive in memory and stream it as `application/zip`.

Add this endpoint to `SecurityConfig.java` under `authenticated()`.

---

## IMPL-12 — PostHog Analytics

### Why
Without usage data, there's no way to know which features users rely on, where they drop off, or whether the forecast is actually driving order decisions. PostHog's free Cloud tier requires one JS snippet and zero backend changes.

### Frontend

**`forestock-frontend/index.html`** — add PostHog snippet in `<head>`:
```html
<script>
  !function(t,e){...}(window,document)
  posthog.init('<YOUR_PROJECT_API_KEY>', {api_host: 'https://eu.posthog.com'})
</script>
```
Use the EU endpoint (`eu.posthog.com`) to keep data within the EU for GDPR compliance.

**`AuthContext.tsx`** — after successful login, call:
```js
posthog.identify(username, { role });
```

**`AuthContext.tsx`** — in `logout()`, call `posthog.reset()`.

**Key events to capture** (call `posthog.capture('event_name', { properties })` in the relevant page):
- `forecast_run_triggered` — `DashboardPage.tsx`
- `csv_imported` — `ImportPage.tsx` on success, with `{ imported, skipped, errorCount }`
- `suggestion_acknowledged` — `SuggestionsPage.tsx`
- `report_exported` — `SuggestionsPage.tsx`, with `{ format: 'excel'|'pdf' }`

---

## IMPL-13 — Stripe Billing + Trial Enforcement

### Why
There is no monetisation mechanism. This is the highest-effort but most critical pre-launch item for a commercial SaaS. A 14-day free trial → single paid plan is the minimum viable billing flow.

### Backend

**Add Stripe dependency to `pom.xml`:**
```xml
<dependency>
    <groupId>com.stripe</groupId>
    <artifactId>stripe-java</artifactId>
    <version>27.1.0</version>
</dependency>
```

**New fields on `Store.java`:**
```java
private String stripeCustomerId;
private String stripeSubscriptionId;
private String subscriptionStatus;   // "trialing" | "active" | "past_due" | "canceled"
private LocalDateTime trialEndsAt;
private LocalDateTime subscriptionEndsAt;
```

**V11 migration: `V11__stripe_billing.sql`**
```sql
ALTER TABLE stores
    ADD COLUMN stripe_customer_id VARCHAR(255),
    ADD COLUMN stripe_subscription_id VARCHAR(255),
    ADD COLUMN subscription_status VARCHAR(50) DEFAULT 'trialing',
    ADD COLUMN trial_ends_at TIMESTAMP,
    ADD COLUMN subscription_ends_at TIMESTAMP;
```

**`RegisterService.java`** — when creating a new store, set:
```java
store.setSubscriptionStatus("trialing");
store.setTrialEndsAt(LocalDateTime.now().plusDays(14));
```

**New `StripeWebhookController.java`** — listens at `POST /api/webhooks/stripe` (public endpoint). Verifies Stripe webhook signature with `Webhook.constructEvent(payload, sigHeader, endpointSecret)`. Handles events:
- `customer.subscription.updated` → update `subscriptionStatus` on `Store`
- `customer.subscription.deleted` → set `subscriptionStatus = "canceled"`
- `invoice.payment_failed` → set `subscriptionStatus = "past_due"`

Add `/api/webhooks/**` to `PUBLIC_ENDPOINTS` in `SecurityConfig.java`.

**`JwtAuthFilter.java`** — after validating the JWT and setting security context, add a subscription guard:
```java
Store store = storeRepository.findById(storeId).orElseThrow();
String status = store.getSubscriptionStatus();
LocalDateTime trialEnd = store.getTrialEndsAt();
boolean trialExpired = "trialing".equals(status) && trialEnd != null && LocalDateTime.now().isAfter(trialEnd);
boolean canceled = "canceled".equals(status);
if (trialExpired || canceled) {
    response.setStatus(402); // Payment Required
    response.getWriter().write("{\"status\":\"error\",\"message\":\"Subscription expired. Please upgrade.\"}");
    return;
}
```
Skip this check for `ROLE_SUPER_ADMIN` (`storeId == null`).

**New `StripeService.java`** — wraps `Customer.create()` and `Subscription.create()` for onboarding new paid customers via Stripe Checkout.

**New endpoint `POST /api/billing/checkout`** (ROLE_ADMIN only) — creates a Stripe Checkout Session and returns the URL. The frontend redirects the user to Stripe-hosted checkout.

**New endpoint `GET /api/billing/portal`** (ROLE_ADMIN only) — creates a Stripe Customer Portal session URL for managing subscription, cards, and invoices.

### Frontend

**`SettingsPage.tsx`** — add a "Billing" section (ROLE_ADMIN only):
- Shows current plan status, trial end date, or next renewal date.
- "Upgrade Plan" button → calls `POST /api/billing/checkout` → redirect to Stripe Checkout.
- "Manage Billing" button → calls `GET /api/billing/portal` → redirect to Stripe Portal.

**`api.ts`** — handle HTTP 402 responses: redirect to `/settings#billing` with a toast "Your subscription has expired."

---

## IMPL-14 — Production Deployment (AWS ECS + RDS + Redis + CloudFront)

### Why
Without a live deployment, there is no product. All other implementations are irrelevant if the app cannot be accessed by customers.

### Infrastructure Components

| Component | Service | Notes |
|---|---|---|
| Backend containers | AWS ECS Fargate | Use existing `Dockerfile` |
| Database | AWS RDS PostgreSQL 17 | Multi-AZ for production |
| Cache / Redis | AWS ElastiCache Redis | Required for token blacklist + multi-instance rate limiting |
| Frontend CDN | AWS CloudFront + S3 | `npm run build` → upload `dist/` to S3 |
| Load Balancer | AWS ALB | SSL termination, health checks |
| DNS | Route 53 | `api.forestock.app` → ALB, `app.forestock.app` → CloudFront |
| Container Registry | AWS ECR | Push backend image from GitHub Actions |
| Secrets | AWS Secrets Manager | All env vars from the production list in CONTEXT.md |

### Backend Changes Required

**`application.yml` / `application-prod.yml`** — expose actuator health:
```yaml
management:
  endpoints:
    web:
      exposure:
        include: health
  endpoint:
    health:
      show-details: never
```
Add to `PUBLIC_ENDPOINTS` in `SecurityConfig.java`: `/actuator/health`.

**`RateLimitFilter.java`**
(`forestock-backend/src/main/java/com/forestock/forestock_backend/config/RateLimitFilter.java`)

Replace the in-memory `ConcurrentHashMap<String, Deque<Long>>` with a Redis-backed sliding window. Use `StringRedisTemplate` with a sorted set (ZSET) per IP key with TTL. This ensures rate limiting works correctly when running 2+ ECS tasks.

### GitHub Actions — Production CI/CD

**`.github/workflows/deploy-prod.yml`** — on push to `main`:
1. Run tests (`./mvnw test`)
2. Build Docker image, tag with commit SHA, push to ECR
3. Update ECS service with new task definition revision
4. `npm run build` for frontend, sync `dist/` to S3, invalidate CloudFront distribution

### docker-compose.prod.yml

The existing `docker-compose.prod.yml` should be updated to reference ECR image URLs and remove local PostgreSQL (use RDS endpoint via env var instead). Redis service should also be removed (use ElastiCache endpoint).

### Required Environment Variables (Production)

All listed in CONTEXT.md "Production" section, plus:
- `REDIS_HOST` — ElastiCache primary endpoint
- `REDIS_PORT` — `6379`
- `REDIS_PASSWORD` — ElastiCache auth token
- `STRIPE_SECRET_KEY` — from Stripe dashboard
- `STRIPE_WEBHOOK_SECRET` — from Stripe webhook endpoint config
- `STRIPE_PRICE_ID` — the price ID for your subscription plan

---

## Cross-Cutting Conventions to Follow

### Backend patterns (match existing code exactly)
- All services use `@Slf4j @Service @RequiredArgsConstructor`
- All controllers return `ResponseEntity<ApiResponse<T>>` using `ApiResponse.success(data)` / `ApiResponse.error(msg)`
- Multi-tenancy: always call `TenantContext.getStoreId()` and scope all repository queries to `storeId`
- Validation annotations: use `@Valid` on `@RequestBody` parameters; `@NotBlank`, `@Size`, `@Pattern` on DTOs
- Flyway migrations: sequential numbering `V8__`, `V9__`, etc. Never modify existing migrations
- Entities use Lombok `@Builder @NoArgsConstructor @AllArgsConstructor`; `@PrePersist` for `createdAt`
- Repositories extend `JpaRepository<Entity, UUID>`

### Frontend patterns (match existing code exactly)
- All API calls use the `api` axios instance from `forestock-frontend/src/lib/api.ts` — never use raw `fetch` or a new axios instance
- Auth state is read from `useAuth()` from `AuthContext.tsx` — never read localStorage directly in components
- TailwindCSS 4 utility classes only — no CSS modules, no inline styles
- All pages follow the pattern: state declarations → `useEffect` fetch on mount → JSX return
- Loading states: show a spinner/skeleton while fetching
- Error states: show an error message with the `error` string from the API response

---

## File Paths — Quick Reference

| Item | Path |
|---|---|
| AppUser entity | `forestock-backend/src/main/java/com/forestock/forestock_backend/domain/AppUser.java` |
| Store entity | `forestock-backend/src/main/java/com/forestock/forestock_backend/domain/Store.java` |
| OrderSuggestion entity | `forestock-backend/src/main/java/com/forestock/forestock_backend/domain/OrderSuggestion.java` |
| SecurityConfig | `forestock-backend/src/main/java/com/forestock/forestock_backend/config/SecurityConfig.java` |
| JwtService | `forestock-backend/src/main/java/com/forestock/forestock_backend/service/JwtService.java` |
| JwtAuthFilter | `forestock-backend/src/main/java/com/forestock/forestock_backend/security/JwtAuthFilter.java` |
| TenantContext | `forestock-backend/src/main/java/com/forestock/forestock_backend/security/TenantContext.java` |
| SalesIngestionService | `forestock-backend/src/main/java/com/forestock/forestock_backend/service/SalesIngestionService.java` |
| SuggestionService | `forestock-backend/src/main/java/com/forestock/forestock_backend/service/SuggestionService.java` |
| SuggestionController | `forestock-backend/src/main/java/com/forestock/forestock_backend/controller/SuggestionController.java` |
| AuthController | `forestock-backend/src/main/java/com/forestock/forestock_backend/controller/AuthController.java` |
| UserManagementService | `forestock-backend/src/main/java/com/forestock/forestock_backend/service/UserManagementService.java` |
| ForecastOrchestrator | `forestock-backend/src/main/java/com/forestock/forestock_backend/service/ForecastOrchestrator.java` |
| RateLimitFilter | `forestock-backend/src/main/java/com/forestock/forestock_backend/config/RateLimitFilter.java` |
| DataInitializer | `forestock-backend/src/main/java/com/forestock/forestock_backend/config/DataInitializer.java` |
| Flyway migrations | `forestock-backend/src/main/resources/db/migration/` |
| application.yml | `forestock-backend/src/main/resources/application.yml` |
| pom.xml | `forestock-backend/pom.xml` |
| api.ts | `forestock-frontend/src/lib/api.ts` |
| AuthContext.tsx | `forestock-frontend/src/context/AuthContext.tsx` |
| App.tsx | `forestock-frontend/src/App.tsx` |
| SuggestionsPage | `forestock-frontend/src/pages/SuggestionsPage.tsx` |
| DashboardPage | `forestock-frontend/src/pages/DashboardPage.tsx` |
| ImportPage | `forestock-frontend/src/pages/ImportPage.tsx` |
| SettingsPage | `forestock-frontend/src/pages/SettingsPage.tsx` |
| package.json | `forestock-frontend/package.json` |
