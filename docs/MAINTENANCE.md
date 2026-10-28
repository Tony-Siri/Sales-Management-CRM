# Maintenance Guide

All commands run on the VPS as the RunCloud app user inside the app directory
(`cd /home/runcloud/webapps/crm`). `SERVICE` = `pocketbase-crm`.

## Daily operations cheat-sheet

| Task | Command / place |
|---|---|
| Service status | `sudo systemctl status pocketbase-crm` (or RunCloud → Supervisor) |
| Restart | `sudo systemctl restart pocketbase-crm` |
| Application log | `tail -f pb_data/pocketbase.log` · `journalctl -u pocketbase-crm -n 200` |
| Request / error log with details | PocketBase dashboard `https://<domain>/_/` → **Logs** |
| Health | `curl -s http://127.0.0.1:8090/api/health` |
| Browse / fix data | dashboard → Collections (superuser login) |
| Promote a new Director | dashboard → Collections → users → edit record → `role` |
| Disk usage | `du -sh pb_data pb_data/storage pb_data/backups` |

## Updating the application

```bash
cd /home/runcloud/webapps/crm
bash deploy/deploy.sh            # git pull --ff-only → restart → health check
```

- The static page in `public/` is live immediately after the pull.
- New files in `pb_migrations/` run automatically when PocketBase restarts
  (inside a transaction; a failing migration aborts the start and is logged).
- Before every update a nightly backup already exists; for a risky change
  take a manual one first: dashboard → Settings → Backups → **Initialize new backup**.

### Upgrading PocketBase itself

PocketBase is pinned to **v0.40.6** in `deploy/install.sh`. To upgrade:

1. Read the release notes (https://github.com/pocketbase/pocketbase/releases and
   the project site; releases may move off GitHub) for breaking changes to JS
   hooks, migrations or the SDK.
2. Update `PB_VERSION` and both SHA-256 values in `deploy/install.sh`; if the
   SDK major/minor changed, replace `public/vendor/pocketbase.es.mjs`
   (`npm pack pocketbase@<ver>` → `package/dist/pocketbase.es.mjs`).
3. Test locally (see `docs/TESTING.md`), commit, then on the server:
   `bash deploy/install.sh` with `SKIP_SUPERUSER=1`, then `bash deploy/deploy.sh`.

Never run `./pocketbase update` on the server; keep the version in git.

## Rollback

Code rollback (UI, hooks, migrations that did not change the schema):

```bash
git log --oneline -5
git checkout <previous-commit>      # or a tag
sudo systemctl restart pocketbase-crm
```

Full rollback (schema or data problem): restore the last good backup.

### Restore a backup

Backups are zip files of `pb_data` (database + uploads) in `pb_data/backups/`
or at your off-site destination.

Option A, dashboard: Settings → Backups → ⋯ on the backup → **Restore**
(PocketBase restarts itself).

Option B, manually:

```bash
sudo systemctl stop pocketbase-crm
mv pb_data pb_data.broken.$(date +%F-%H%M)
mkdir pb_data && unzip -q /path/to/pb_backup_xxx.zip -d pb_data
sudo systemctl start pocketbase-crm
curl -s http://127.0.0.1:8090/api/health
```

Keep `pb_data.broken.*` until you are sure, then delete it.

## Backups

- Automatic: nightly 02:00, keep 7 (set in `pb_migrations/1761500001_settings.js`;
  change later in dashboard → Settings → Backups).
- Off-site copy: `deploy/backup-offsite.sh` via RunCloud cron (see DEPLOYMENT §9).
- Test a restore on a laptop once a quarter: unzip into an empty folder and run
  `pocketbase serve --dir=<that folder>` locally.
- `pb_data/pocketbase.log` is not rotated by PocketBase; add it to logrotate or
  truncate it occasionally (`: > pb_data/pocketbase.log`). Dashboard logs are
  pruned after 14 days.

## Secrets

| Secret | Where | Rotate by |
|---|---|---|
| Google client secret | `.env` | new secret in Google Cloud Console → edit `.env` → restart |
| `PB_ENCRYPTION_KEY` | `.env` | **do not change** after first start unless you re-enter all settings secrets; it encrypts the stored Google secret and S3/SMTP settings |
| Superuser password | PocketBase | `./pocketbase superuser upsert <email> <newpass> --dir=pb_data --encryptionEnv=PB_ENCRYPTION_KEY` (with `.env` loaded) |

`.env` must stay `chmod 600` and is never committed.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Login page says Google sign-in not configured | `GOOGLE_CLIENT_ID/SECRET` missing or service not restarted | fill `.env`, restart, check log for "[crm] Google OAuth2 provider configured" |
| Google popup shows `redirect_uri_mismatch` | redirect URI not registered | add `https://<domain>/api/oauth2-redirect` in the Google client |
| "บัญชีนี้ยังไม่ได้ลงทะเบียนในทีม" | the Google e-mail is not in the Team page / typo / different Google account | Director adds or corrects the e-mail (lower-case is applied automatically) |
| Director cannot sign in on a fresh install | `CRM_DIRECTOR_EMAIL` differs from the account used and another user signed in first | set `CRM_DIRECTOR_EMAIL`, delete the wrong record in the dashboard, restart |
| Page loads, data never appears, no errors | `/api/` not proxied (NGINX config missing) | re-add `deploy/nginx-proxy.conf`, Run and Debug |
| Data appears only after reload (no realtime) | proxy buffering/timeouts | ensure `proxy_buffering off`, `proxy_read_timeout 360s`, `Connection ''` in the `/api/` location |
| Upload fails with 413 | NGINX `client_max_body_size` | it is 25M in the proxy config; RunCloud's global setting may be lower → raise in RunCloud → Web App → Settings |
| 429 Too Many Requests | PocketBase rate limit | adjust in dashboard → Settings → Application → Rate limits |
| `Too many open files` in log | many realtime clients | `LimitNOFILE` is 8192 in the unit; raise if needed |
| Service restarts in a loop | failing migration or corrupt `pb_data` | `journalctl -u pocketbase-crm`, fix or restore backup |
| Admin dashboard 403 | IP restriction in NGINX `/_/` | add your IP to `allow` |
| CSP error in browser console | a new external resource was added to the page | extend the `Content-Security-Policy` header in `deploy/nginx-proxy.conf` |

## Analytics operations

| Task | How |
|---|---|
| Rebuild a past month's pipeline snapshot | ทีมและเป้า → Snapshot Pipeline → pick month → สร้าง / อัปเดต, or `POST /api/crm/snapshot/YYYY-MM` as Director |
| Check the hourly snapshot job | log lines `[crm] snapshot YYYY-MM: {...}` appear when something changed |
| Change forecast probability, stale days, teams, product lines, lost reasons | ทีมและเป้า → ตั้งค่าการวิเคราะห์ |
| Monthly targets | ทีมและเป้า → เป้ารายเดือน (blank = default target) |
| Clean duplicate customer spellings | ลูกค้า → รวมชื่อลูกค้า (Director) |
| Data quality review | ทีมและเป้า → สุขภาพข้อมูล |
| Weekly digest channels | `.env` `NOTIFY_LINE_TOKEN`/`NOTIFY_LINE_TO` and/or `SMTP_*`, restart; preview and send-now on ทีมและเป้า; log `[crm] weekly digest: {...}` |

Renaming a team in settings does not rename the `team` value already stored on
users; reassign people on the Team page afterwards.

## Removing a user

Team page → ลบ. The user record is deleted, the person can no longer sign in,
their deals/reports stay (owner shows blank/"ยังไม่ระบุทีม" in the Overview).
To hand their deals to someone else, the Director opens each deal and changes
the owner, or edits in the dashboard.
