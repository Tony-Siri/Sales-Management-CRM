#!/usr/bin/env bash
# Copy the newest PocketBase backup zip off the server.
#
# PocketBase creates pb_data/backups/*.zip nightly (settings migration:
# cron "0 2 * * *", keep 7). Schedule this script in RunCloud > Cron Job,
# e.g. daily at 03:00, as the web application user:
#
#   BACKUP_DEST="user@backup-host:/srv/crm-backups" bash /path/to/app/deploy/backup-offsite.sh
#
# BACKUP_DEST may be an rsync/scp target (host:/path) or a local/mounted path.
# Optional: KEEP=30 (number of remote copies to keep when DEST is a local path).
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="$APP_DIR/pb_data/backups"
DEST="${BACKUP_DEST:?Set BACKUP_DEST to host:/path or /local/path}"
KEEP="${KEEP:-30}"

LATEST="$(ls -1t "$SRC_DIR"/*.zip 2>/dev/null | head -n1 || true)"
if [[ -z "$LATEST" ]]; then
  echo "No backup zip found in $SRC_DIR (has the nightly backup run yet?)" >&2
  exit 1
fi

echo "==> Copying $(basename "$LATEST") to $DEST"
if command -v rsync >/dev/null; then
  rsync -a --partial "$LATEST" "$DEST/"
else
  scp -q "$LATEST" "$DEST/"
fi

# prune local-path destinations
if [[ -d "$DEST" ]]; then
  ls -1t "$DEST"/*.zip 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
fi
echo "==> Done"
