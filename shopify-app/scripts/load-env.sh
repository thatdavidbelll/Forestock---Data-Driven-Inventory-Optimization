#!/usr/bin/env bash

set -euo pipefail

ENV_FILE="${1:-.env}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing shopify-app/.env. Copy .env.local.example to .env and fill the required values." >&2
  exit 1
fi

while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    ''|\#*)
      continue
      ;;
  esac

  key="${line%%=*}"
  value="${line#*=}"

  if [ -z "$key" ] || [ "$key" = "$line" ]; then
    continue
  fi

  export "$key=$value"
done < "$ENV_FILE"
