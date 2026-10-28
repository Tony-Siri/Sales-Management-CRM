#!/usr/bin/env bash
# Starts PocketBase with the variables from .env. Used by:
#   - RunCloud Supervisor jobs (Supervisor cannot read .env by itself)
#   - local development:  CRM_DEV_PASSWORD_AUTH=1 bash deploy/run-pocketbase.sh
# systemd users do not need this file (the unit uses EnvironmentFile=.env).
set -euo pipefail
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"
if [[ -f .env ]]; then set -a; . ./.env; set +a; fi
PB_HTTP="${PB_HTTP:-127.0.0.1:8090}"
exec "$APP_DIR/pocketbase" serve \
  --http="$PB_HTTP" \
  --dir="$APP_DIR/pb_data" \
  --hooksDir="$APP_DIR/pb_hooks" \
  --migrationsDir="$APP_DIR/pb_migrations" \
  --encryptionEnv=PB_ENCRYPTION_KEY \
  "$@"
