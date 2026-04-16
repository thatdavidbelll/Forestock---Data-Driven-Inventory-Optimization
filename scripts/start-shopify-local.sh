#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/forestock-backend"
SHOPIFY_DIR="$ROOT_DIR/shopify-app"
BOOTSTRAP_SCRIPT="$ROOT_DIR/scripts/shopify-local-bootstrap.sh"
BACKEND_LOG_DIR="$ROOT_DIR/.local"
BACKEND_LOG_FILE="$BACKEND_LOG_DIR/shopify-backend.log"
BACKEND_PID=""

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_env_key() {
  local file_path="$1"
  local key="$2"
  if ! grep -Eq "^${key}=" "$file_path"; then
    echo "Missing $key in $file_path" >&2
    exit 1
  fi
}

cleanup() {
  if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" >/dev/null 2>&1; then
    kill "$BACKEND_PID" >/dev/null 2>&1 || true
    wait "$BACKEND_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

require_cmd bash
require_cmd curl
require_cmd npm
require_cmd docker

bash "$BOOTSTRAP_SCRIPT" >/dev/null

require_env_key "$BACKEND_DIR/.env" "JWT_SECRET"
require_env_key "$BACKEND_DIR/.env" "SUPER_ADMIN_USERNAME"
require_env_key "$BACKEND_DIR/.env" "SUPER_ADMIN_PASSWORD"
require_env_key "$BACKEND_DIR/.env" "SHOPIFY_PROVISIONING_SECRET"
require_env_key "$SHOPIFY_DIR/.env" "SHOPIFY_API_KEY"
require_env_key "$SHOPIFY_DIR/.env" "SHOPIFY_API_SECRET"
require_env_key "$SHOPIFY_DIR/.env" "SHOPIFY_APP_URL"
require_env_key "$SHOPIFY_DIR/.env" "DATABASE_URL"
require_env_key "$SHOPIFY_DIR/.env" "FORESTOCK_API_BASE_URL"
require_env_key "$SHOPIFY_DIR/.env" "FORESTOCK_PROVISIONING_SECRET"

mkdir -p "$BACKEND_LOG_DIR"

echo "Starting Forestock backend in background..."
(
  cd "$BACKEND_DIR"
  export SPRING_PROFILES_ACTIVE=dev
  set -a
  source .env
  set +a
  ./mvnw spring-boot:run
) >"$BACKEND_LOG_FILE" 2>&1 &
BACKEND_PID=$!

echo "Waiting for backend readiness..."
for _ in $(seq 1 90); do
  if curl -fsS http://localhost:8080/actuator/health/readiness >/dev/null 2>&1; then
    echo "Backend is ready."
    break
  fi

  if ! kill -0 "$BACKEND_PID" >/dev/null 2>&1; then
    echo "Backend exited early. Check $BACKEND_LOG_FILE" >&2
    exit 1
  fi

  sleep 1
done

if ! curl -fsS http://localhost:8080/actuator/health/readiness >/dev/null 2>&1; then
  echo "Backend did not become ready in time. Check $BACKEND_LOG_FILE" >&2
  exit 1
fi

echo "Starting Shopify app..."
cd "$SHOPIFY_DIR"
npm run dev
