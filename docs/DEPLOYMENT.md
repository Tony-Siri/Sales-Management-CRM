# Deployment Guide – RunCloud-managed NGINX VPS

Target: Ubuntu VPS managed by RunCloud, NGINX, one web application serving the
static page and reverse-proxying `/api/` and `/_/` to PocketBase on
`127.0.0.1:8090`. Replace `crm.example.com`, `runcloud` (system user) and
`crm` (app name) with your values. The application directory below is
`/home/runcloud/webapps/crm`.

## 0. Prerequisites

- A RunCloud server (Ubuntu 20.04+/22.04/24.04, x86_64 or arm64) with NGINX stack.
- A DNS **A record** `crm.example.com → VPS IP` (and AAAA if you use IPv6).
- SSH access as the RunCloud system user, and `sudo` once to install the systemd service
  (or use a RunCloud Supervisor job, see 4b).
- `git`, `curl`, `unzip`, `openssl` on the server (`sudo apt install -y git curl unzip openssl`).
- A Google account to own the OAuth client (section 6).

## 1. Create the web application in RunCloud

RunCloud → **Web Applications → Create Web App → Custom (empty)**:

| Setting | Value |
|---|---|
| Name | `crm` |
| Domain | `crm.example.com` |
| System user | `runcloud` (or a dedicated user) |
| Public path | `/public` |
| Stack | **Native NGINX + Custom Config** (required for the proxy config) |
| Stack mode | Production |
| PHP version | any (not used) |

Create it. The app root is now `/home/runcloud/webapps/crm` and NGINX serves
`/home/runcloud/webapps/crm/public`.

## 2. Put the code on the server

```bash
ssh runcloud@your-vps
cd /home/runcloud/webapps
rm -rf crm && git clone https://github.com/<you>/<repo>.git crm   # or git clone into the empty folder
cd crm
```

## 3. Install PocketBase and create the superuser

```bash
bash deploy/install.sh
```

The script downloads PocketBase v0.40.6 for your CPU, verifies its SHA-256,
creates `pb_data/`, creates `.env` from `.env.example`, generates
`PB_ENCRYPTION_KEY`, renders the systemd unit, and asks for the e-mail and
password of the **PocketBase superuser** (the login for the admin dashboard
at `https://crm.example.com/_/`; this is not a CRM user).

Now edit `.env`:

```bash
nano .env
```

```
CRM_APP_URL=https://crm.example.com
GOOGLE_CLIENT_ID=...            # from section 6 (can be filled later)
GOOGLE_CLIENT_SECRET=...
CRM_DIRECTOR_EMAIL=you@gmail.com   # the Google account that becomes Director
```

## 4a. Run PocketBase as a systemd service (recommended)

```bash
sudo cp deploy/pocketbase.service.rendered /etc/systemd/system/pocketbase-crm.service
sudo systemctl daemon-reload
sudo systemctl enable --now pocketbase-crm
sudo systemctl status pocketbase-crm --no-pager
curl -s http://127.0.0.1:8090/api/health      # {"message":"API is healthy." ...}
```

Pending migrations in `pb_migrations/` are applied automatically at start;
hooks in `pb_hooks/` read `.env`. Logs: `pb_data/pocketbase.log` and
`journalctl -u pocketbase-crm`.

## 4b. Alternative without sudo: RunCloud Supervisor job

RunCloud → server → **Supervisor → Create Supervisor Job**:

| Field | Value |
|---|---|
| Job name | `pocketbase-crm` |
| User | `runcloud` |
| Number of processes | 1 |
| Auto restart / auto start | yes |
| Directory | `/home/runcloud/webapps/crm` |
| Command | `/bin/bash /home/runcloud/webapps/crm/deploy/run-pocketbase.sh` |

`run-pocketbase.sh` loads `.env` and starts PocketBase with the same flags as
the systemd unit. Logs are then in RunCloud's supervisor log view and
`pb_data/`. For updates use `SUPERVISOR_JOB=pocketbase-crm bash deploy/deploy.sh`.

## 5. NGINX reverse proxy (RunCloud custom config)

RunCloud → Web Application `crm` → **NGiNX Config → Add a New Config**:

| Field | Value |
|---|---|
| Type | `location.root` |
| Config name | `crm-proxy` |
| Content | paste the whole of `deploy/nginx-proxy.conf` |

Before saving, optionally edit the `/_/` block to allow only your office/VPN
IP addresses (uncomment `allow …; deny all;`). Click **Run and Debug**
(syntax check), then **Create Config**. RunCloud reloads NGINX.

Test:

```bash
curl -sI http://crm.example.com/ | head -1              # 200
curl -s  http://crm.example.com/api/health              # API is healthy
```

## 6. HTTPS

RunCloud → Web Application `crm` → **SSL/TLS → Let's Encrypt**, enable
**HTTPS redirection** and **HSTS**. Wait for the certificate, then confirm
`https://crm.example.com/` loads the login page.

## 7. Google OAuth client

1. Google Cloud Console → create/select a project → **APIs & Services → OAuth consent screen**.
   User type *Internal* if the team is a Google Workspace organisation
   (only your domain can sign in), otherwise *External* and publish the app.
   Fill app name, support e-mail; scopes `email`, `profile`, `openid` are enough.
2. **Credentials → Create credentials → OAuth client ID → Web application**:
   - Authorised JavaScript origins: `https://crm.example.com`
   - Authorised redirect URIs: `https://crm.example.com/api/oauth2-redirect`
3. Copy **Client ID** and **Client secret** into `.env`, then restart:

```bash
sudo systemctl restart pocketbase-crm      # or restart the Supervisor job
tail -n 20 pb_data/pocketbase.log          # expect "[crm] Google OAuth2 provider configured from environment"
```

The provider is written into PocketBase settings (encrypted at rest with
`PB_ENCRYPTION_KEY`) on every start, so rotating the secret is just editing
`.env` and restarting.

## 8. First sign-in and team setup

1. Open `https://crm.example.com/`, click **เข้าสู่ระบบด้วย Google** with the
   account in `CRM_DIRECTOR_EMAIL` (or, if left empty, the first account ever).
   You are the **Director**.
2. Go to **ทีมและเป้า** and add each team member: display name, **Google e-mail**,
   role, team, monthly target. They sign in with Google; the account links by e-mail.
3. Anyone not on that list is refused at sign-in.

## 9. Backups and cron

PocketBase already creates a backup zip (database + uploads) every night at
02:00 server time and keeps 7 (`pb_data/backups/`). Copy them off the server:

RunCloud → **Cron Jobs → Create**: user `runcloud`, daily 03:00, command

```
BACKUP_DEST="backup@backup-host:/srv/crm-backups" /bin/bash /home/runcloud/webapps/crm/deploy/backup-offsite.sh
```

(`BACKUP_DEST` can also be a mounted/local path such as `/mnt/backup/crm`.)
You can additionally point PocketBase at S3-compatible storage in the admin
dashboard → Settings → Backups.

## 10. Verify the deployment

- `https://crm.example.com/` shows the login page; browser console has no CSP errors.
- Sign in with Google works and shows the Director name in the header.
- `https://crm.example.com/_/` opens the PocketBase dashboard (only from allowed IPs if restricted).
- Open the site in two browsers; a deal moved in one appears in the other without reload (realtime through NGINX).
- Upload a PDF to a deal and a photo to a report entry; the thumbnail loads.
- `sudo systemctl status pocketbase-crm` shows `active (running)`; `pb_data/pocketbase.log` has no errors.

## Optional: weekly digest notifications

Add `NOTIFY_LINE_TOKEN` / `NOTIFY_LINE_TO` (LINE Messaging API) and/or `SMTP_*`
to `.env` and restart. The server needs outbound HTTPS to `api.line.me` (LINE)
or outbound SMTP to your mail host. See `docs/ANALYTICS.md` §5.

## File permissions

Everything runs as the RunCloud app user; no root ownership is needed. Keep:

```
chmod 600 .env
chmod 750 pocketbase pb_data
```

`pb_data/` must stay writable by that user (SQLite, uploads, backups, logs).
The public web root is only `public/`; `pb_data`, `pb_hooks`, `.env` are
outside it and additionally denied in the NGINX config.

## Updating

See `docs/MAINTENANCE.md` (`bash deploy/deploy.sh`).
