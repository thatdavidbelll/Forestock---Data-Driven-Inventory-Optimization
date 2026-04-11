# Shopify App Host Setup Guide (`portal.forestock.ro`)

## Purpose
This guide explains how to stand up a dedicated hostname for the Forestock Shopify app when Forestock is hosted on AWS and fronted by Nginx.

Target hostname:
- `https://portal.forestock.ro`

This guide is for planning and supervised execution. It does **not** imply the change has already been applied.

---

## Change Classification
### Requested action
Create and serve a dedicated Shopify app hostname:
- `portal.forestock.ro`

### Permission level
**Level 4 — Production high-risk / networking / auth-adjacent infrastructure change**

Why:
- touches DNS
- touches TLS
- touches public routing
- affects Shopify application URL / auth callbacks
- can break install/auth if misconfigured

### Approval boundary
Do not apply this directly without explicit approval and a rollback-ready window.

---

## Systems involved
- AWS EC2 host running Nginx
- DNS provider for `forestock.ro`
- TLS certificate management on the EC2/Nginx host
- Shopify app runtime (`shopify-app`)
- Shopify Partner app settings

---

## Recommended architecture
Use a **dedicated hostname** for the Shopify app runtime:
- `app.forestock.ro` → existing Forestock web frontend
- `api.forestock.ro` → existing backend API
- `portal.forestock.ro` → Shopify embedded app runtime

This keeps merchant-facing Shopify auth and callback behavior isolated from the main Forestock frontend.

---

## Preconditions
Before promoting to a dedicated hostname, you should already know:
- the Shopify app works in a local/tunneled dev-store run
- the Shopify runtime can reach the Forestock backend
- the required env vars are correct
- the intended app process/port on EC2 is known

Recommended target runtime port on the EC2 host:
- `127.0.0.1:3000`

---

## Deployment model assumption
This guide assumes:
- Nginx runs on the EC2 host
- the Shopify app runs as a Node process or container behind Nginx
- Nginx terminates HTTPS and proxies to the local Shopify app process

If Forestock later moves the Shopify app behind ALB/CloudFront/Caddy/etc., update this guide.

---

## Step 1 — Choose how the Shopify app runs on EC2
You need a persistent app process serving the `shopify-app` code.

Common options:

### Option A — systemd-managed Node process
Good for a simple single-host setup.

Example runtime command:
```bash
cd /srv/forestock/shopify-app
npm install
npm run build
PORT=3000 node ./node_modules/@react-router/serve/bin.js ./build/server/index.js
```

### Option B — Docker container
Good if you want parity with backend container operations.

### Recommendation
If the backend is already deployed with Docker and Nginx, using Docker for the Shopify app is usually cleaner operationally.

---

## Step 2 — Create DNS for `portal.forestock.ro`
In your DNS provider, create one of:

### If pointing directly to EC2
```text
A     portal.forestock.ro     -> <EC2 elastic IP>
```

### If using another hostname in front of the EC2 host
```text
CNAME portal.forestock.ro     -> <target hostname>
```

### Verification
Run:
```bash
nslookup portal.forestock.ro
```
or:
```bash
dig portal.forestock.ro
```

Do not continue until DNS resolves correctly.

---

## Step 3 — Add Nginx server block
On the EC2 host, create an Nginx site for the Shopify app.

Example file:
- `/etc/nginx/sites-available/forestock-shopify`

Example config:
```nginx
server {
    listen 80;
    server_name portal.forestock.ro;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
        client_max_body_size 20M;
    }
}
```

Enable it:
```bash
sudo ln -s /etc/nginx/sites-available/forestock-shopify /etc/nginx/sites-enabled/forestock-shopify
sudo nginx -t
sudo systemctl reload nginx
```

---

## Step 4 — Add HTTPS/TLS
Use Certbot if Nginx is already managed that way.

Example:
```bash
sudo certbot --nginx -d portal.forestock.ro
```

After issuance, verify:
```bash
curl -I https://portal.forestock.ro
```

Expected:
- valid TLS
- HTTP 200/3xx from the app host
- no cert mismatch

---

## Step 5 — Configure the Shopify app runtime
On the host where the Shopify app runs, set environment variables such as:

```env
SHOPIFY_API_KEY=<shopify client id>
SHOPIFY_API_SECRET=<shopify client secret>
SHOPIFY_APP_URL=https://portal.forestock.ro
SCOPES=read_products,read_inventory,read_orders
DATABASE_URL=postgresql://<user>:<password>@<host>/<shopify_sessions_db>?sslmode=require
FORESTOCK_API_BASE_URL=https://api.forestock.ro
FORESTOCK_PROVISIONING_SECRET=<shared provisioning secret>
```

Notes:
- Prefer PostgreSQL-compatible session storage for the Shopify app runtime.
- Keep Shopify app session storage separate from the backend’s canonical business tables unless you are doing that deliberately with a managed schema boundary.

---

## Step 6 — Start the Shopify app process
### If using a Node process
Run on the host:
```bash
cd /srv/forestock/shopify-app
npm install
npm run build
PORT=3000 npm start
```

### If using systemd
Create a service like:
- `/etc/systemd/system/forestock-shopify.service`

Example:
```ini
[Unit]
Description=Forestock Shopify App
After=network.target

[Service]
Type=simple
WorkingDirectory=/srv/forestock/shopify-app
EnvironmentFile=/srv/forestock/shopify-app/.env
Environment=PORT=3000
ExecStart=/usr/bin/npm start
Restart=always
User=ubuntu

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable forestock-shopify
sudo systemctl start forestock-shopify
sudo systemctl status forestock-shopify
```

---

## Step 7 — Update Shopify app configuration
Once `https://portal.forestock.ro` is live and serving correctly, update Shopify app config.

### Application URL
```text
https://portal.forestock.ro
```

### Redirect URLs
```text
https://portal.forestock.ro/auth/callback
https://portal.forestock.ro/auth/shopify/callback
```

Repo-side alignment:
- `shopify-app/.env`
- `shopify-app/shopify.app.toml`

Do not update these until the host is actually live.

---

## Step 8 — Validate before calling it usable
Run these checks:

### Host checks
```bash
curl -I https://portal.forestock.ro
curl -I https://portal.forestock.ro/auth/callback
```

### Runtime checks
- app process is running
- Nginx proxies correctly to port `3000`
- backend is reachable from the Shopify app runtime
- logs show no callback/auth loop errors

### Shopify checks
- install succeeds on a dev store
- auth completes
- embedded app loads
- webhook registration succeeds
- provisioning/sync calls reach the backend

Use:
- `docs/SHOPIFY_DEV_STORE_VALIDATION_PLAN.md`
- `docs/SHOPIFY_VALIDATION_EVIDENCE_TEMPLATE.md`

---

## Blast radius
If misconfigured, this change can affect:
- Shopify install/auth flow
- merchant trust during onboarding
- callback handling
- app review readiness

If DNS points at the wrong host or TLS is invalid:
- install/auth may fail entirely
- reviewers/merchants may see broken screens or loops

---

## Merchant impact
- Merchants may need to reinstall or reauthorize if the application URL / scopes / install behavior changes materially
- Shopify review/re-approval risk exists when important app config changes are made
- Merchants should not be directed to this hostname until validation passes

---

## Customer data risk
- Low direct data-risk from DNS/TLS change alone
- Medium indirect risk if callbacks fail and app/webhook lifecycle becomes inconsistent

---

## Downtime risk
- Low to medium if introduced as a new hostname
- Higher if existing Shopify app settings are switched prematurely before the host is healthy

---

## Reversibility
Reasonably reversible if planned:
- revert Shopify app application/callback URLs
- disable or remove Nginx site
- remove DNS record or repoint it
- stop Shopify app process

---

## Rollback plan
If cutover fails:
1. revert Shopify application URL and redirect URLs to last known working values
2. stop routing traffic to `portal.forestock.ro`
3. disable the Nginx site if needed
4. stop the Shopify app process
5. fall back to tunnel/non-prod validation until fixed

---

## Recommended rollout order
### Phase 1 — local validation
- validate app locally with tunnel

### Phase 2 — host validation
- stand up `portal.forestock.ro`
- test directly against the host
- do not announce it yet

### Phase 3 — Shopify config alignment
- update application URL and callbacks
- re-test install/auth

### Phase 4 — launch-readiness review
- confirm runtime stability
- confirm support/runbook readiness
- update launch docs

---

## Exact docs to keep aligned
When this is actually implemented, update:
- `docs/SHOPIFY_OPERATIONS.md`
- `docs/AWS_OPERATIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/ROLLBACK_PROCEDURES.md`
- `docs/CHANGELOG.md`

---

## Honest recommendation
Do not build `portal.forestock.ro` first and hope the app works later.

Validate the app flow with a tunnel first, then promote it to a dedicated AWS + Nginx hostname.
