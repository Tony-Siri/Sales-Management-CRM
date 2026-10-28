#!/usr/bin/env bash
# One-time installation of the NARA CRM backend on a RunCloud VPS.
#
# Run as the RunCloud *web application user* from the application directory
# (the folder that contains public/, pb_migrations/, pb_hooks/):
#
#   cd /home/<runcloud-user>/webapps/<app>
#   bash deploy/install.sh
#
# What it does:
#   1. downloads PocketBase v0.40.6 for this CPU and verifies the SHA-256
#   2. creates pb_data/ and .env (from .env.example) and fills PB_ENCRYPTION_KEY
#   3. renders the systemd unit with this directory and user
#   4. creates the PocketBase superuser (admin dashboard login)
#   5. prints the remaining sudo / RunCloud steps
set -euo pipefail

PB_VERSION="0.40.6"
PB_BASE_URL="https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}"
# SHA-256 of the official release archives (from checksums.txt of v0.40.6)
SHA_AMD64="0e1f609158ed945f809f8a02ae012aa0427129c66ebb63c1aee76f2c0309373f"
SHA_ARM64="d22c66ceb67ca92b7d767f36d826e848a276bcfa3c197ead20bf87c42208984f"

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_USER="$(id -un)"
cd "$APP_DIR"

echo "==> App directory: $APP_DIR"
echo "==> Service user : $APP_USER"

# ---- 1. binary -------------------------------------------------------------
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64)  PB_ARCH="amd64"; PB_SHA="$SHA_AMD64" ;;
  aarch64|arm64) PB_ARCH="arm64"; PB_SHA="$SHA_ARM64" ;;
  *) echo "Unsupported CPU architecture: $ARCH" >&2; exit 1 ;;
esac

if [[ -x ./pocketbase ]] && ./pocketbase --version 2>/dev/null | grep -q "$PB_VERSION"; then
  echo "==> PocketBase $PB_VERSION already installed"
else
  ZIP="pocketbase_${PB_VERSION}_linux_${PB_ARCH}.zip"
  echo "==> Downloading $ZIP"
  curl -fsSL -o "$ZIP" "$PB_BASE_URL/$ZIP"
  echo "$PB_SHA  $ZIP" | sha256sum -c -
  command -v unzip >/dev/null || { echo "unzip is required (apt install unzip)" >&2; exit 1; }
  unzip -o -q "$ZIP" pocketbase
  chmod 750 pocketbase
  rm -f "$ZIP"
  echo "==> Installed $(./pocketbase --version)"
fi

# ---- 2. data dir + .env ----------------------------------------------------
mkdir -p pb_data
chmod 750 pb_data

if [[ ! -f .env ]]; then
  cp .env.example .env
  chmod 600 .env
  echo "==> Created .env from .env.example (fill in CRM_APP_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, CRM_DIRECTOR_EMAIL)"
fi
if ! grep -qE '^PB_ENCRYPTION_KEY=.{32}$' .env; then
  KEY="$(openssl rand -hex 16)"
  if grep -q '^PB_ENCRYPTION_KEY=' .env; then
    sed -i "s|^PB_ENCRYPTION_KEY=.*|PB_ENCRYPTION_KEY=$KEY|" .env
  else
    echo "PB_ENCRYPTION_KEY=$KEY" >> .env
  fi
  echo "==> Generated PB_ENCRYPTION_KEY in .env"
fi

# ---- 3. systemd unit -------------------------------------------------------
sed -e "s|__APP_DIR__|$APP_DIR|g" -e "s|__APP_USER__|$APP_USER|g" \
  deploy/pocketbase.service > deploy/pocketbase.service.rendered
echo "==> Rendered deploy/pocketbase.service.rendered"

# ---- 4. superuser (admin dashboard) ---------------------------------------
if [[ "${SKIP_SUPERUSER:-0}" != "1" ]]; then
  echo
  read -r -p "Superuser e-mail for the PocketBase dashboard (/_/): " SU_EMAIL
  read -r -s -p "Superuser password (min 10 chars): " SU_PASS; echo
  set -a; . ./.env; set +a
  ./pocketbase superuser upsert "$SU_EMAIL" "$SU_PASS" \
    --dir="$APP_DIR/pb_data" --migrationsDir="$APP_DIR/pb_migrations" --hooksDir="$APP_DIR/pb_hooks" \
    --encryptionEnv=PB_ENCRYPTION_KEY
fi

# ---- 5. next steps ---------------------------------------------------------
cat <<EOF

==> Done. Remaining steps:

  A) Start the service (one-time, needs sudo):
       sudo cp $APP_DIR/deploy/pocketbase.service.rendered /etc/systemd/system/pocketbase-crm.service
       sudo systemctl daemon-reload
       sudo systemctl enable --now pocketbase-crm
       sudo systemctl status pocketbase-crm
     (No sudo? Create a RunCloud Supervisor job instead – see docs/DEPLOYMENT.md)

  B) In RunCloud: set the web app public path to "$APP_DIR/public", stack
     "Native NGINX + Custom Config", then add deploy/nginx-proxy.conf as a
     "location.root" custom NGINX config and enable Let's Encrypt SSL.

  C) Fill GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / CRM_APP_URL / CRM_DIRECTOR_EMAIL
     in $APP_DIR/.env and restart:  sudo systemctl restart pocketbase-crm

  D) Health check:  curl -s http://127.0.0.1:8090/api/health
EOF
