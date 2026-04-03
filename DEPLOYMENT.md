# Forestock — EC2 Deployment Guide

> **CI/CD:** Every push to `main` automatically deploys via GitHub Actions (`.github/workflows/deploy.yml`).
> See the [CI/CD Setup](#cicd-setup--github-actions) section before the first deploy.

## Architecture

```
Browser
  │
  ├── app.forestock.ro  ──→  CloudFront ──→  S3  (React frontend, ~$1/mo)
  │
  └── api.forestock.ro  ──→  EC2 t4g.micro  (Nginx → Spring Boot + Redis)
                                    │
                                    └──→  Neon PostgreSQL  (free tier, auto-suspends)
```

**Cost when running:** ~$8/mo. **When stopped:** ~$2/mo (just EBS + S3).

---

## Neon URLs

Both are in `application-cloud.yml`. You need both — the pooler URL for the app, the direct URL for Flyway (bypasses PgBouncer advisory lock issue).

| Variable | Value |
|----------|-------|
| `NEON_POOLER_URL` | `jdbc:postgresql://ep-soft-credit-agkhx8ux-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require` |
| `NEON_DIRECT_URL` | `jdbc:postgresql://ep-soft-credit-agkhx8ux.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require` |
| `NEON_USERNAME` | `neondb_owner` |
| `NEON_PASSWORD` | your `DB_PASSWORD` value from `application-cloud.yml` |

---

## Step 1 — Launch the EC2 Instance

AWS Console → EC2 → Launch Instance:

- **Name:** `forestock-prod`
- **AMI:** Ubuntu 24.04 LTS
- **Instance type:** `t4g.micro` (ARM, $0.0084/hr) — or `t3.micro` if you prefer x86
- **Key pair:** Create new, download `.pem`, keep it safe
- **Security group inbound rules:**

| Port | Source | Why |
|------|--------|-----|
| 22 | Your IP only | SSH |
| 80 | 0.0.0.0/0 | HTTP → HTTPS redirect + Let's Encrypt |
| 443 | 0.0.0.0/0 | HTTPS (API) |

- **Storage:** 8 GB gp3 (default)
- **Elastic IP:** After launch → EC2 → Elastic IPs → Allocate → Associate to instance. This gives a permanent IP that survives restarts.

---

## Step 2 — Point DNS

In your DNS provider (or Route 53), before getting SSL:

```
A  api.forestock.ro  →  YOUR_ELASTIC_IP
```

Verify propagation:
```bash
nslookup api.forestock.ro
```

---

## Step 3 — Set Up the Server

SSH in:
```bash
ssh -i your-key.pem ubuntu@YOUR_ELASTIC_IP
```

Install Docker:
```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker ubuntu
newgrp docker
```

Install Nginx + Certbot:
```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

---

## Step 4 — Configure Nginx + HTTPS

Create the Nginx config:
```bash
sudo nano /etc/nginx/sites-available/forestock
```

Paste:
```nginx
server {
    listen 80;
    server_name api.forestock.ro;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        client_max_body_size 55M;
    }
}
```

Enable and get SSL certificate:
```bash
sudo ln -s /etc/nginx/sites-available/forestock /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d api.forestock.ro
```

Certbot updates the Nginx config automatically and sets up auto-renewal.

Cloudflare note:
- Set SSL/TLS mode to `Full` or `Full (strict)`.
- Do not use `Flexible`, or Cloudflare will connect to the origin over HTTP and trigger the Nginx `80 -> 443` redirect loop that breaks CORS preflight requests.

---

## Step 5 — Deploy the Backend

Clone the repo:
```bash
cd ~
git clone https://github.com/thatdavidbelll/Forestock---Data-Driven-Inventory-Optimization.git forestock
cd forestock/forestock-backend
```

Create the secrets file (never commit this):
```bash
nano .env
```

Paste and fill in your values:
```env
# Neon Database
NEON_POOLER_URL=jdbc:postgresql://ep-soft-credit-agkhx8ux-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require
NEON_DIRECT_URL=jdbc:postgresql://ep-soft-credit-agkhx8ux.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require
NEON_USERNAME=neondb_owner
NEON_PASSWORD=your_neon_password

# AWS
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=eu-central-1
AWS_S3_BUCKET=forestock-forecast-data-104091534682
AWS_SNS_TOPIC_ARN=

# App
JWT_SECRET=generate-a-64-char-random-string-here
FORESTOCK_FRONTEND_URL=https://app.forestock.ro
FORESTOCK_ALERT_EMAIL=
SUPER_ADMIN_USERNAME=your_admin_username
SUPER_ADMIN_PASSWORD=your_strong_password

# Email (password reset)
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=your@gmail.com
MAIL_PASSWORD=your_gmail_app_password
MAIL_FROM=noreply@forestock.ro
```

Generate a JWT secret (run this locally, paste the result into .env):
```bash
openssl rand -base64 48
```

**Important:** Also add `BACKEND_IMAGE=` (empty placeholder) to `.env` — the CI/CD pipeline will fill this in on first deploy:
```bash
echo "BACKEND_IMAGE=" >> .env
```

For the very first manual start (before CI/CD has run), build locally on EC2 just once:
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

After CI/CD is set up, you never need to build manually again — GitHub Actions handles it.

Watch the logs — confirm Flyway ran and the app started:
```bash
docker compose -f docker-compose.prod.yml logs -f app
```

Look for:
- `Successfully applied N migrations` (Flyway)
- `Started ForestockBackendApplication` (Spring Boot)

Test the health endpoint:
```bash
curl https://api.forestock.ro/actuator/health
# Expected: {"status":"UP"}
```

---

## Step 6 — Deploy the Frontend

Run locally on your machine:

```bash
cd forestock-frontend
echo "VITE_API_BASE_URL=https://api.forestock.ro" > .env.production
npm run build
```

Create the S3 bucket:
```bash
aws s3 mb s3://forestock-app-frontend --region eu-central-1
aws s3 website s3://forestock-app-frontend \
  --index-document index.html \
  --error-document index.html
```

Upload the build:
```bash
aws s3 sync dist/ s3://forestock-app-frontend --delete
```

Create a CloudFront distribution in the AWS Console:
- **Origin:** your S3 bucket
- **Default root object:** `index.html`
- **Custom error responses:** 403 → `/index.html`, HTTP 200 and 404 → `/index.html`, HTTP 200 (required for React Router refreshes on S3/CloudFront)
- **HTTPS:** Use CloudFront's default cert, or add your domain + ACM certificate

Point DNS:
```
CNAME  app.forestock.ro  →  your-cloudfront-id.cloudfront.net
```

---

## Start / Stop to Save Money

**Stop** (you pay ~$0/hour, only EBS ~$1/mo):
```bash
aws ec2 stop-instances --instance-ids YOUR_INSTANCE_ID
```

**Start:**
```bash
aws ec2 start-instances --instance-ids YOUR_INSTANCE_ID
```

The Elastic IP stays attached so DNS never needs updating. Docker `restart: unless-stopped` means containers come back automatically on instance start.

Add shortcuts to your local shell config (`~/.zshrc`):
```bash
alias forestock-start="aws ec2 start-instances --instance-ids YOUR_INSTANCE_ID"
alias forestock-stop="aws ec2 stop-instances --instance-ids YOUR_INSTANCE_ID"
```

**Auto-stop at midnight (optional):** AWS Console → EventBridge → Scheduler → Create schedule:
- Cron: `0 23 * * ? *`
- Target: EC2 StopInstances
- Instance ID: yours

---

## Deploying Updates

Once CI/CD is set up (see below), deploying is just:
```bash
git push origin main
```

GitHub Actions detects what changed (backend vs frontend) and only deploys what's needed.

---

## Cost Summary

| Item | Running | Stopped |
|------|---------|---------|
| EC2 t4g.micro | ~$6/mo | $0/mo |
| EBS 8 GB gp3 | $0.64/mo | $0.64/mo |
| Elastic IP | free (attached) | $3.75/mo if unattached |
| S3 + CloudFront | ~$1/mo | ~$1/mo |
| Neon PostgreSQL | free tier | free tier |
| **Total** | **~$8/mo** | **~$2/mo** |

> **Elastic IP note:** AWS charges $0.005/hr when the IP is allocated but NOT attached to a running instance. If you stop the EC2 for more than ~1 week in a month, either release the IP (update DNS on restart) or accept the small charge (~$3.75/mo max).

---

## Troubleshooting

**App won't start — database connection error:**
- Check Neon is not suspended: log into neon.tech and wake the project
- Verify `.env` has the correct `NEON_PASSWORD`
- Check logs: `docker compose -f docker-compose.prod.yml logs app`

**Flyway migration fails:**
- Make sure `NEON_DIRECT_URL` is the non-pooler URL (no `-pooler` in the hostname)
- Flyway needs the direct connection to avoid PgBouncer advisory lock issues

**502 Bad Gateway from Nginx:**
- The Spring Boot app isn't running yet — check `docker ps` and the app logs
- App binds to `127.0.0.1:8080` so it's only reachable via Nginx, not directly

**CSV upload fails (413 error):**
- Nginx `client_max_body_size` must be at least 55M — already set in the config above

**Login fails with a browser CORS error and preflight redirect:**
- Run:
  `curl -i -X OPTIONS 'https://api.forestock.ro/api/auth/login' -H 'Origin: https://app.forestock.ro' -H 'Access-Control-Request-Method: POST'`
- Expected: `200` or `204`, with no `Location` header
- If you get `301` or `308`, check Cloudflare SSL mode first and make sure the Nginx `443` block proxies to Spring Boot instead of redirecting

**Refreshing `/login`, `/dashboard`, or `/admin` shows an S3/XML AccessDenied page:**
- CloudFront is forwarding the route to S3 as an object key
- Add both custom error responses on the distribution:
  - `403 -> /index.html -> 200`
  - `404 -> /index.html -> 200`

**Containers don't restart after EC2 start:**
- Check they have `restart: unless-stopped` in docker-compose.prod.yml (they do)
- If you manually stopped them with `docker compose stop`, they won't auto-restart — use `docker compose -f docker-compose.prod.yml up -d` after starting the instance

---

## CI/CD Setup — GitHub Actions

Every push to `main` runs `.github/workflows/deploy.yml`, which:
- Detects whether backend, frontend, or both changed
- For backend: builds a Docker image → pushes to ECR → SSHes into EC2 to pull and restart
- For frontend: builds with Vite → syncs to S3 → invalidates CloudFront

### How it works

```
git push origin main
       │
       ▼
GitHub Actions detects changes
       │
       ├── forestock-backend/** changed?
       │       │
       │       ▼
       │   Build Docker image (GitHub runner, fast)
       │   Push to ECR with commit SHA tag
       │   SSH → EC2: pull new image, restart container
       │
       └── forestock-frontend/** changed?
               │
               ▼
           npm run build
           Sync dist/ to S3
           Invalidate CloudFront
```

### Step 1 — Create the ECR repository

```bash
aws ecr create-repository \
  --repository-name forestock-backend \
  --region eu-central-1
```

Note the repository URI from the output — it looks like:
`123456789.dkr.ecr.eu-central-1.amazonaws.com/forestock-backend`

### Step 2 — Create an IAM user for GitHub Actions

AWS Console → IAM → Users → Create user → name: `forestock-github-actions`

Attach this inline policy (replace `ACCOUNT_ID`, `DISTRIBUTION_ID`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ECRAuth",
      "Effect": "Allow",
      "Action": ["ecr:GetAuthorizationToken"],
      "Resource": "*"
    },
    {
      "Sid": "ECRPush",
      "Effect": "Allow",
      "Action": [
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:PutImage"
      ],
      "Resource": "arn:aws:ecr:eu-central-1:ACCOUNT_ID:repository/forestock-backend"
    },
    {
      "Sid": "S3Frontend",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:DeleteObject", "s3:ListBucket", "s3:GetObject"],
      "Resource": [
        "arn:aws:s3:::forestock-app-frontend",
        "arn:aws:s3:::forestock-app-frontend/*"
      ]
    },
    {
      "Sid": "CloudFrontInvalidate",
      "Effect": "Allow",
      "Action": ["cloudfront:CreateInvalidation"],
      "Resource": "arn:aws:cloudfront::ACCOUNT_ID:distribution/DISTRIBUTION_ID"
    }
  ]
}
```

Create access keys for this user and save them — you'll need them for GitHub secrets.

### Step 3 — Give EC2 permission to pull from ECR

The EC2 instance needs to pull Docker images from ECR. Instead of storing credentials on the server, give it an IAM role.

AWS Console → IAM → Roles → Create role:
- Trusted entity: AWS service → EC2
- Name: `forestock-ec2-role`
- Attach this inline policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage"
      ],
      "Resource": "*"
    }
  ]
}
```

Then attach the role to your EC2 instance:
EC2 Console → select your instance → Actions → Security → Modify IAM role → select `forestock-ec2-role`

### Step 4 — Add GitHub Secrets

GitHub → your repo → Settings → Secrets and variables → Actions → New repository secret

| Secret name | Value |
|-------------|-------|
| `AWS_ACCESS_KEY_ID` | Access key from the `forestock-github-actions` IAM user |
| `AWS_SECRET_ACCESS_KEY` | Secret key from the `forestock-github-actions` IAM user |
| `EC2_HOST` | Your Elastic IP address |
| `EC2_SSH_KEY` | Contents of your `.pem` key file (the whole file including `-----BEGIN RSA PRIVATE KEY-----`) |
| `VITE_API_BASE_URL` | `https://api.forestock.ro` |
| `S3_FRONTEND_BUCKET` | `forestock-app-frontend` |
| `CLOUDFRONT_DISTRIBUTION_ID` | Your CloudFront distribution ID (e.g. `E1ABCDEF123456`) |

### Step 5 — Push and verify

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add GitHub Actions deploy workflow"
git push origin main
```

Go to GitHub → your repo → Actions tab. You should see the workflow running. First run takes ~5 minutes (Docker image build). Subsequent runs are faster because Docker layer caching kicks in.

### What a typical deploy looks like

```
Push to main
└── changes job (5s)
    ├── backend changed → deploy-backend job (~4 min)
    │     ├── Build Docker image on GitHub runner
    │     ├── Push to ECR (forestock-backend:abc1234)
    │     └── SSH into EC2:
    │           git pull
    │           docker pull ECR_URL/forestock-backend:abc1234
    │           docker compose up -d
    │           docker image prune
    │
    └── frontend changed → deploy-frontend job (~2 min)
          ├── npm ci + npm run build
          ├── aws s3 sync dist/ → S3 (--delete)
          └── CloudFront invalidation /*
```

If only the frontend changed, the backend job is skipped entirely (and vice versa).

### Troubleshooting CI/CD

**`permission denied` on SSH:**
- Make sure the `EC2_SSH_KEY` secret contains the full `.pem` file contents including the header/footer lines
- The key must match the key pair assigned to the EC2 instance

**`no basic auth credentials` on ECR pull:**
- The EC2 instance role (`forestock-ec2-role`) is not attached — attach it in EC2 console → Security → Modify IAM role
- Wait 1-2 minutes for the role to propagate, then retry

**`BACKEND_IMAGE is not set` error on EC2:**
- The `.env` file is missing the `BACKEND_IMAGE=` line — add it: `echo "BACKEND_IMAGE=" >> ~/.forestock/forestock-backend/.env`

**Build fails with out-of-memory:**
- This happens on the GitHub runner, not EC2 — it has plenty of RAM. If it happens, check the Dockerfile for a Maven step that needs more memory and add `-Xmx512m` to the Maven build args.

**CloudFront invalidation succeeds but old content still shows:**
- Browser cache — hard refresh with Cmd+Shift+R. The `index.html` is served with `no-cache` so it always fetches fresh.
