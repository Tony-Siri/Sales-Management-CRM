[English](README.en.md) | [ภาษาไทย](README.md)

# NARA CRM – Sales Team Commit Tracker (self-hosted)

A web app for a sales team: commit deals, weekly customer-visit reports (with
photos), visit plans, a Sales Spec report and team/target management. The UI is in Thai.

This version **no longer uses Firebase**. The backend is [PocketBase](https://pocketbase.io)
(single binary + SQLite) running on your own VPS behind RunCloud/NGINX, and
users sign in with their **Google account**. The front-end is still plain
HTML/JS with no build step and keeps its real-time updates.

## Features

| Page | What it does |
|---|---|
| Overview | Value by status, split by team (PJ-BKK / PJ-PKT), donut chart, stacked bars per person, closed-won vs target (%) |
| Pipeline | Kanban board with 5 statuses; drag a card to change its status |
| Commit | Table of all deals, filterable by team and salesperson, searchable. **Document attachments per deal (PDF, Office, images)** |
| Weekly report | Daily customer-visit log, **photo uploads**, managers can comment under each entry |
| Customer visit plan | Monthly calendar for daily visit plans |
| Sales Spec Report | Running project-tracking table, editable by Sales Spec only |
| Analytics | 12-month won vs target, pipeline at month end, funnel, sales cycle, lost reasons, product mix, visits, leaderboard |
| Customers | Customer master, customer 360 page (deals, visits, photos, documents, timeline), merge of differently spelled names |
| Weekly digest | Printable manager summary; optional delivery via LINE or e-mail |
| Team & targets | The Director adds users by Google e-mail, manages roles, teams, default and monthly targets, analytics settings and data health |

Every table exports to CSV (opens in Excel). The overview adds a weighted forecast and stale-deal flags. Details in [docs/ANALYTICS.md](docs/ANALYTICS.md).

Deal rules: Commit 100%, Commit 80% and "waiting for customer" deals roll over
to the next month automatically; "closed won" and "closed lost" stay in the
month they were closed.

## Roles and permissions

| Role | Deals | Weekly report | Visit plan | Sales Spec Report | Team & targets |
|---|---|---|---|---|---|
| Director | View/edit all | View everyone + comment | View everyone | View | Full control |
| Assistant Manager | View all, edit own | Write own, view everyone + comment | Write own, view everyone | View | View only |
| Sales | View all, edit own | Own only | Own only | View | Hidden |
| Sales Spec | View only (no target) | Own only | Own only | Write/edit | Hidden |
| Viewer | View only | View everyone + comment | View everyone | View | Hidden |

Permissions are enforced server-side by PocketBase API rules (`pb_migrations/`)
and hooks (`pb_hooks/`). A Google account that is not on the team list cannot sign in at all.

## Sign-in

- Google only; no passwords are stored on your server.
- The Director adds a member on **Team & targets** by typing their Google e-mail.
  When that person clicks "Sign in with Google" the account is linked by e-mail.
- The first Director is defined by `CRM_DIRECTOR_EMAIL` in `.env` (if empty, the
  first account to sign in becomes Director).

## Project layout

```
public/            the web page (index.html, app.js, vendor/pocketbase.es.mjs)
pb_migrations/     schema, access rules and settings (applied automatically on start)
pb_hooks/          server-side logic: Google sign-in gating, config from .env
deploy/            install/update scripts, systemd unit, RunCloud NGINX config, backup
tests/             integration tests for rules and sign-in (local test server only)
docs/              all guides (below)
.env.example       required environment variables
```

## Documentation

| File | Contents |
|---|---|
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Step-by-step RunCloud + NGINX deployment (web app, systemd/Supervisor, NGINX proxy, SSL, Google OAuth) |
| [docs/MAINTENANCE.md](docs/MAINTENANCE.md) | Backups/restore, updates, rollback, logs, troubleshooting |
| [docs/ANALYSIS.md](docs/ANALYSIS.md) | Architecture, what changed from the Firebase version, data model |
| [docs/FEATURES.md](docs/FEATURES.md) | Feature inventory with status |
| [docs/ANALYTICS.md](docs/ANALYTICS.md) | Analytics audit, added features and metric definitions |
| [docs/UX-AUDIT.md](docs/UX-AUDIT.md) | UX/UI audit on desktop and mobile (usability, keyboard, WCAG) and a 3-phase improvement plan |
| [docs/DATAVIZ.md](docs/DATAVIZ.md) | Data-visualization audit (charts, colour, themes, mobile, print) and the changes made |
| [docs/TESTING.md](docs/TESTING.md) | Test results, what remains unverified, how to run the tests locally |
| [docs/OUTSTANDING.md](docs/OUTSTANDING.md) | What you still need to provide (domain, Google OAuth client, …) |

## Quick install

```bash
# on the VPS, inside the RunCloud web app folder (public path = /public, stack = Native NGINX + Custom Config)
git clone <repo> . && bash deploy/install.sh      # downloads PocketBase, creates .env and the superuser
nano .env                                          # CRM_APP_URL, GOOGLE_CLIENT_ID/SECRET, CRM_DIRECTOR_EMAIL
sudo cp deploy/pocketbase.service.rendered /etc/systemd/system/pocketbase-crm.service
sudo systemctl daemon-reload && sudo systemctl enable --now pocketbase-crm
# RunCloud: NGiNX Config → Add → type location.root → paste deploy/nginx-proxy.conf → SSL/TLS → Let's Encrypt
```

Full details in `docs/DEPLOYMENT.md`.

## Security notes

- Never commit `.env` or `pb_data/` (already in `.gitignore`).
- Restrict the admin dashboard `/_/` to your IP addresses in the NGINX config.
- All attachments are protected: downloadable only by signed-in team members.
- `CRM_DEV_PASSWORD_AUTH` is for local testing only; never set it in production.

## License

MIT (see `LICENSE`)
