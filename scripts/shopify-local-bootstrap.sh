#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/forestock-backend"
SHOPIFY_DIR="$ROOT_DIR/shopify-app"
BACKEND_ENV="$BACKEND_DIR/.env"
BACKEND_ENV_EXAMPLE="$BACKEND_DIR/.env.local.shopify.example"
SHOPIFY_ENV="$SHOPIFY_DIR/.env"
SHOPIFY_ENV_EXAMPLE="$SHOPIFY_DIR/.env.local.example"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

copy_if_missing() {
  local source_path="$1"
  local target_path="$2"

  if [ ! -f "$source_path" ]; then
    echo "Missing example file: $source_path" >&2
    exit 1
  fi

  if [ ! -f "$target_path" ]; then
    cp "$source_path" "$target_path"
    echo "Created $target_path from $(basename "$source_path")"
  fi
}

require_cmd docker

copy_if_missing "$BACKEND_ENV_EXAMPLE" "$BACKEND_ENV"
copy_if_missing "$SHOPIFY_ENV_EXAMPLE" "$SHOPIFY_ENV"

echo "Starting backend dependencies from $BACKEND_DIR"
(cd "$BACKEND_DIR" && docker compose up -d)

cat <<EOF

Backend and Shopify env files are present:
- $BACKEND_ENV
- $SHOPIFY_ENV

Before running the app, fill the required values:

Backend:
- JWT_SECRET
- SUPER_ADMIN_PASSWORD
- FORESTOCK_FRONTEND_URL (only if you also run forestock-frontend locally)

Shopify app:
- SHOPIFY_API_KEY
- SHOPIFY_API_SECRET
- SHOPIFY_APP_URL
- DATABASE_URL

Then run these in separate terminals:

1. Backend
cd "$BACKEND_DIR"
export SPRING_PROFILES_ACTIVE=dev
set -a
source .env
set +a
./mvnw spring-boot:run

2. Shopify app
cd "$SHOPIFY_DIR"
npm install
set -a
source .env
set +a
npm run dev

3. Optional: standalone frontend
cd "$ROOT_DIR/forestock-frontend"
npm install
npm run dev

Notes:
- docker compose already started PostgreSQL and Redis for the backend
- SHOPIFY_APP_URL must be a public HTTPS URL that matches the active Shopify app config
- FORESTOCK_API_BASE_URL can stay on http://localhost:8080 when the Shopify app runs locally

Quick checks:
- curl http://localhost:8080/actuator/health/readiness
- curl -I http://localhost:3000
EOF
