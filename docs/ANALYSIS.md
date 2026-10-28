# Codebase Analysis Report

## 1. What the original repository was

The forked repository contained four files:

| File | Purpose |
|---|---|
| `index.html` (265 lines) | The whole application: CSS, markup shell and one ES-module `<script>` with all UI and data logic. Thai UI. |
| `firestore.rules` | Authorization rules enforced by Google Firestore. |
| `README.md`, `README.en.md` | Setup notes for Firebase + static hosting (Netlify/GitHub Pages). |

**Technology stack (as found):** plain JavaScript (no framework, no build step, no `package.json`), Firebase Web SDK 10.14.1 loaded from Google's CDN, Firebase Authentication (email/password, with a fake `@salesforce.local` domain for user names) and Cloud Firestore with real-time `onSnapshot` listeners. Google Fonts (Noto Sans Thai). There was no server code, no database schema, no migrations and no tests.

**Architecture (as found):** a single-page app rendering HTML strings into `#app` on every state change; one global click/change/input/drag handler dispatching on `data-a` attributes; seven Firestore collections; all security in Firestore rules. Hosting was a static file host. Nothing was mock data, but nothing could run without a Google Firebase project and the config pasted into the HTML.

**Implementation status (as found):** every listed feature was implemented and consistent with the rules file. Deployment blockers for a self-hosted VPS: the data and auth layer lived in Google Cloud; the config in the HTML was a placeholder; no Google sign-in; no file uploads.

## 2. What was changed and why

Decisions taken with the owner: self-host on the RunCloud VPS, replace Firebase with **PocketBase**, use **Google sign-in only**, start with an empty database, and add **image uploads on customer-visit entries** and **document attachments on deals**.

| Area | Before | After |
|---|---|---|
| Backend | Firebase Auth + Firestore (Google Cloud) | PocketBase v0.40.6, a single Go binary with embedded SQLite, running as a systemd service on the VPS, reverse-proxied by RunCloud NGINX |
| Auth | e-mail/password, usernames mapped to `@salesforce.local` | Google OAuth2 only. Director pre-registers team members by Google e-mail; sign-in links by e-mail. Unknown Google accounts are rejected server-side. |
| First-time setup | "ตั้งค่าครั้งแรก (Director)" screen + `config/setup` marker | Automatic: `CRM_DIRECTOR_EMAIL` in `.env`, or the very first sign-in, becomes Director (hook) |
| Authorization | `firestore.rules` | Identical matrix as PocketBase collection API rules (`pb_migrations/1761500000_init_collections.js`) plus hooks for Director protection |
| Real-time | Firestore `onSnapshot` | PocketBase realtime (Server-Sent Events); `watch()` helper in `public/app.js` keeps the same UX |
| Files | none | `deals.files` (documents, 10 files × 10 MB) and `reports.photos` (images, 10 × 5 MB, thumbnails). Protected: served only to signed-in team members with a short-lived file token. |
| Front-end | inline script in `index.html` | Same UI; script moved to `public/app.js` so a strict Content-Security-Policy can be applied; SDK self-hosted in `public/vendor/` |
| Hosting | Netlify / GitHub Pages | RunCloud web app (Native NGINX + custom config), `deploy/` scripts, `.env` |
| Ops | none | Nightly built-in backups, off-site copy script, rate limiting, logs, update and rollback procedure |

The original `firestore.rules` is kept for reference at `docs/legacy/firestore.rules`.

## 3. Architecture now

```
Browser ──HTTPS──> RunCloud NGINX (web app, public path = <app>/public)
                     ├─ /            static: index.html, app.js, vendor/pocketbase.es.mjs
                     ├─ /api/*       proxy → 127.0.0.1:8090  (REST, realtime SSE, files, OAuth2 redirect)
                     └─ /_/*         proxy → 127.0.0.1:8090  (PocketBase admin dashboard, restrict by IP)
PocketBase (systemd, runs as the RunCloud app user)
  ├─ pb_data/        SQLite DB + uploaded files + local backups  (not in git)
  ├─ pb_migrations/  schema + settings, versioned in git, applied automatically on start
  └─ pb_hooks/       auth.pb.js (Google sign-in gating), config.pb.js (+lib) env → settings
```

Page and API share one origin, so there is no CORS and the Google OAuth popup redirect is `https://<domain>/api/oauth2-redirect`.

## 4. Data model

| Collection | Key fields | Notes |
|---|---|---|
| `users` (auth) | `name`, `email`, `role` (director/am/rep/spec/viewer, empty = not registered), `team`, `quota` | Password auth disabled; Google OAuth2 enabled; `emailVisibility` forced on so the Team page can show e-mails |
| `deals` | `title`, `company`, `owner`→users, `month` YYYY-MM, `product`, `install`, `cat` (won/c100/c80/pending/lost), `note`, `closedMonth`, `act` (JSON activity log), `files[]` | Month roll-over rule unchanged (`inM()` in app.js) |
| `reports` | `owner`, `date`, `week` (Monday), `company`, `tel`, `office`, `project`, `sqm`, `detail`, `photos[]` | Weekly customer-visit log |
| `rcomments` | `report`→reports (cascade), `owner` (report owner, for the read rule), `week`, `by`, `byId`, `txt` | Manager comments; create-only |
| `plans` | `owner`, `date`, `month`, `lines` | Unique index (owner, date) replaces the old `uid_date` document id |
| `specrep` | `date`, `company`, `project`, `status`, `plan`, `owner` (free text), `sqm`, `pcs`, `product`, `dprod`, `dinst`, `by` | Editable by role `spec` only |

Relations to `users` are optional so a person can be removed from the team while their historical deals and reports remain (the original behaviour). All base collections have `created`/`updated` timestamps.

Analytics collections added later (`crm_settings`, `customers`, `deal_events`, `deal_snapshots`, `quotas`, views `v_won_monthly`, `v_customer_totals`) are described in `docs/ANALYTICS.md`.

## 5. Role matrix (enforced server-side)

| Role | Deals | Weekly report | Visit plan | Sales Spec Report | Team page |
|---|---|---|---|---|---|
| Director | all | read all + comment | read all | read | manage users, roles, teams, quotas |
| Assistant Manager | read all, write own | write own, read all + comment | write own, read all | read | read only |
| Sales | read all, write own | own only | own only | read | hidden |
| Sales Spec | read only | own only | own only | write | hidden |
| Viewer | read only | read all + comment | read all | read | hidden |
| (no role / not registered) | nothing | nothing | nothing | nothing | cannot sign in |

Additional server-side guards (hooks): only one Director; the Director role cannot be granted or removed through the app; the Director cannot delete themself; e-mails are normalised to lower case; a Google account whose e-mail is not pre-registered is rejected before any record is created.

## 6. External dependencies

| Dependency | Kind | Required for |
|---|---|---|
| PocketBase v0.40.6 binary | self-hosted, MIT | everything (downloaded and checksum-verified by `deploy/install.sh`) |
| Google OAuth2 client | free, Google Cloud Console | sign-in (client id + secret in `.env`) |
| Google Fonts (Noto Sans Thai) | public CDN, optional | typography; the UI falls back to system fonts if blocked |
| PocketBase JS SDK 0.28.1 | vendored file in `public/vendor/` | front-end |
| Let's Encrypt via RunCloud | free | HTTPS |

No paid services, no licence keys, no e-mail provider needed (no e-mails are sent).

## 7. Known limitations

- **Google sign-in cannot be exercised without your own Google OAuth client and domain.** The hook logic was verified end-to-end with a mock OpenID Connect provider (see `docs/TESTING.md`); the Google-specific part is configuration.
- One Director. Promote/demote of the Director role is done in the PocketBase admin dashboard (superuser), by design.
- Real-time events require the NGINX proxy to keep SSE connections open (configured in `deploy/nginx-proxy.conf`).
- PocketBase is pre-1.0; pin the version (done) and read release notes before upgrading (`docs/MAINTENANCE.md`).
- SQLite is single-writer. For a sales team of tens of users this is far below its limits; it is not intended for thousands of concurrent writers.
