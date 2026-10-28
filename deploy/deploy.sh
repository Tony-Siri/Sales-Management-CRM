#!/usr/bin/env bash
# Update the running NARA CRM to the latest commit of the current branch.
#
#   cd /home/<runcloud-user>/webapps/<app> && bash deploy/deploy.sh
#
# Steps: backup marker -> git pull --ff-only -> restart service (pending
# pb_migrations run automatically on start) -> health check. The static page is
# served straight from public/, so it is live as soon as git pull finishes.
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE="${SERVICE:-pocketbase-crm}"          # systemd unit name
SUPERVISOR_JOB="${SUPERVISOR_JOB:-}"          # set instead of SERVICE when using RunCloud Supervisor
cd "$APP_DIR"

PREV="$(git rev-parse --short HEAD)"
echo "==> Current version: $PREV"
echo "$PREV" > pb_data/.last_deployed_rev 2>/dev/null || true

echo "==> Pulling latest code"
git pull --ff-only

NEW="$(git rev-parse --short HEAD)"
echo "==> Now at: $NEW"

echo "==> Restarting backend"
if [[ -n "$SUPERVISOR_JOB" ]]; then
  supervisorctl restart "$SUPERVISOR_JOB"
else
  sudo systemctl restart "$SERVICE"
fi

echo "==> Waiting for health"
for i in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:8090/api/health >/dev/null 2>&1; then
    echo "==> Healthy. Deployed $PREV -> $NEW"
    exit 0
  fi
  sleep 1
done

echo "!! Backend did not become healthy. Check logs:" >&2
echo "   tail -n 100 $APP_DIR/pb_data/pocketbase.log" >&2
echo "   To roll back the code:  git checkout $PREV && bash deploy/deploy.sh" >&2
exit 1
