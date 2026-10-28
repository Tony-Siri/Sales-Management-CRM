# Outstanding Requirements

Things only you can supply or do. Everything else is in the repository.

## Required before go-live

| # | Item | Where it goes | Notes |
|---|---|---|---|
| 1 | Domain / subdomain and DNS A record | RunCloud web app, `.env` `CRM_APP_URL` | e.g. `crm.yourcompany.com` |
| 2 | RunCloud web app with **Native NGINX + Custom Config** and public path `/public` | RunCloud panel | DEPLOYMENT §1 |
| 3 | One `sudo` step to install the systemd unit, **or** a RunCloud Supervisor job | VPS | DEPLOYMENT §4a / §4b |
| 4 | Google OAuth client (Client ID + secret) with redirect URI `https://<domain>/api/oauth2-redirect` | `.env` | DEPLOYMENT §7. Decide *Internal* (Workspace only) vs *External* consent screen |
| 5 | `CRM_DIRECTOR_EMAIL` (the Google account that becomes Director) | `.env` | If empty, the first account to sign in becomes Director — set it to avoid surprises |
| 6 | PocketBase superuser e-mail + password | asked by `deploy/install.sh` | Admin dashboard login; store in a password manager |
| 7 | Let's Encrypt certificate + HTTPS redirect | RunCloud → SSL/TLS | DEPLOYMENT §6 |
| 8 | Team list: name, Google e-mail, role, team, target for each person | Team page after first sign-in | Users without a Google account cannot sign in (Google-only was the chosen design) |

## Recommended

| # | Item | Notes |
|---|---|---|
| 9 | Off-site backup destination (`BACKUP_DEST`) and the RunCloud cron job | DEPLOYMENT §9; otherwise backups live only on the same disk |
| 10 | Restrict `/_/` (admin dashboard) to office/VPN IPs | uncomment `allow/deny` in `deploy/nginx-proxy.conf` |
| 11 | Decide team names | `PJ-BKK` / `PJ-PKT` are hard-coded in `public/app.js` (`TEAMS`) exactly as in the original; change there if needed |
| 12 | Commit and push this work to your fork | Nothing has been committed by the assistant; review `git status` first |

## Optional (analytics notifications)

| # | Item | Notes |
|---|---|---|
| 13 | LINE Official Account with Messaging API: channel access token and target user/group ID | `.env` `NOTIFY_LINE_TOKEN`, `NOTIFY_LINE_TO`; weekly digest Mondays 08:00 |
| 14 | SMTP account (host, port, user, password, from address) | `.env` `SMTP_*`; alternative or addition to LINE |
| 15 | Decide the forecast probability, stale threshold, product lines and lost reasons | ทีมและเป้า → ตั้งค่าการวิเคราะห์ (defaults: 30 %, 14 days) |

## To discuss later (you said you would)

- Exact behaviour of the new upload features: which roles may delete photos
  of others, maximum sizes, whether Spec report rows should also take
  attachments, whether a gallery view per customer is wanted.
- Any further features (e.g. export to Excel, notifications, more teams).

## Not needed

- No paid services, licences, SMTP or external APIs. Google OAuth and
  Let's Encrypt are free.
