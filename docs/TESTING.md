# Testing Report

Date: 2026-10-27. Environment: Windows 11 workstation, PocketBase v0.40.6
(Windows binary) started with this repository's `pb_migrations`, `pb_hooks`
and `public` directories, Node.js 24, Google Chrome (automation) and headless
Chrome. No VPS access was available, so everything below the "Executed"
heading ran locally; the "Not executed" section lists what still has to be
verified on the server.

## Executed and passed

### Backend setup
- Fresh database: `pocketbase superuser upsert` + `serve` applied both
  migrations without error; collections, fields, rules, indexes and settings
  were inspected through the admin API and match the design.
- Env-driven config: with `GOOGLE_CLIENT_ID/SECRET` set, the Google provider
  appears in the `users` collection; `CRM_DEV_PASSWORD_AUTH=1` toggles password
  auth; `CRM_APP_URL` is written to settings.
- Hooks load without errors (verified after fixing: shared helper must be
  `require`d because each handler runs in an isolated VM; there is no `onServe`
  hook in the JS runtime).

### Authorization and data rules — `tests/rules-test.mjs` (61 checks, all pass)
Seeded one user per role plus a user without role, then as each role:
users (no-role sees nothing; viewer sees all; rep sees e-mails; only Director
creates/updates/deletes; no second Director via API; Director cannot demote
Director or delete self; e-mail normalised to lower case), deals (own vs
others, owner reassignment only by Director, Spec/Viewer cannot create, month
format validated), reports and comments (visibility per role, comment only by
Director/AM/Viewer, `byId` cannot be forged, comments locked for update/delete),
plans (unique owner+date, visibility), specrep (Spec writes, others read),
files (PDF accepted, `.exe` rejected by MIME type, protected download needs a
token, download without token denied, file removal, report photo upload,
thumbnail fetch, wrong MIME on photos rejected).

### Google sign-in gating — `tests/oauth-test.mjs` (12 checks, all pass)
A mock OpenID Connect provider was registered as the generic `oidc` provider
and the OAuth2 code exchange was driven through PocketBase. Verified:
pre-registered e-mail links to the existing record; match is
case-insensitive; a second sign-in reuses the link; a stale link to a
different provider account is replaced (Director re-pointed the e-mail);
unknown accounts are rejected with HTTP 400 and no record is created;
`CRM_DIRECTOR_EMAIL` becomes Director when missing (name taken from the
provider, e-mail visible, verified); on an empty install the first sign-in
becomes Director and the next stranger is still rejected.

### Browser (Chrome, driven through the DOM; screenshots of the automated
window timed out, so visual checks used headless Chrome for the login page and
DOM/text inspection for the rest)
- Login page renders with the Google button (dark theme, Thai font).
- Director: create two deals (owner selection), Commit table totals, search
  (`PKT` → 1 deal), team filter, Overview per team with donut/legend/bars and
  quota percentages, Kanban drag-and-drop (synthetic drag events) moved a card
  and appended the activity log, Team page: add user by e-mail (upper-case
  e-mail normalised), inline team change, quota prompt, edit role/team/name,
  delete user; comment on a rep's report entry.
- Real-time: a deal updated by another user (SDK) moved columns in an open
  Director tab without reload; a second tab showed changes made in the first.
- Sales (Rep One): weekly report entry with a PNG photo (thumbnail loaded,
  📷 badge), week prev/next, visit plan create → edit → clear, month
  navigation, own deal edit with PDF attachment (📎 badge, download 200,
  per-file delete), other rep's deal shown with 🔒 and read-only dialog,
  Sales Spec Report read-only, theme toggle, month selector.
- Sales Spec: default tab is the weekly report, no "+ ดีลใหม่", spec row
  create → edit → status filter → delete.
- Viewer: no "+ ดีลใหม่", Team tab hidden, sees all report entries and the
  photo and comment, can comment but not edit, visit plan owner selector,
  all deals locked/read-only.
- Responsive: **correction** – the first report claimed a 600 px check, but
  the automated Chrome window ignored the resize (the page still measured
  1891 px wide), so that check proved nothing. It was redone in the analytics
  round with headless Chrome and a real 390 px viewport (see below).
- Browser console: no errors or exceptions during the whole session.
- Static assets served: `index.html`, `app.js`, `vendor/pocketbase.es.mjs`.

### Scripts and configuration
- `bash -n` passes for `deploy/install.sh`, `deploy/deploy.sh`,
  `deploy/backup-offsite.sh`, `deploy/run-pocketbase.sh`.
- SHA-256 of the downloaded Windows archive matched the published
  `checksums.txt`; the Linux amd64/arm64 hashes embedded in `install.sh` are
  copied from that same file.

## Issues found and fixed during testing
1. `sort=created` failed on new collections: base collections created in a
   migration with explicit `fields` do not get `created/updated` automatically.
   Fixed by adding the two autodate fields in the migration.
2. Second Google account with the same e-mail (e-mail re-pointed by the
   Director) failed with "Value must be unique" on the external-auth link.
   Fixed in `auth.pb.js` by removing the stale link for the same provider.
3. `e.isNewRecord` is computed before the hook runs and is stale once the hook
   attaches an existing record; the hook now tracks that itself.
4. Deleting a user who had written comments/deals failed because relations
   were `required`. Relations to `users` are now optional, restoring the
   original "data stays, user cannot sign in" behaviour.
5. Front-end: view state (month, filters) now resets on logout.

## Analytics round (2026-10-27, second iteration)

Executed on a fresh scratch instance with all three migrations applied from
zero, then on demo data from `tests/seed-demo.mjs`.

- `tests/analytics-test.mjs` – **54 checks pass**, rerunnable: settings
  (read by members, Director-only update, no second row), customers (name
  trimming and normalisation, duplicate by normalised name rejected, creator
  cannot be forged or changed, edit/delete permissions), quotas (Director only,
  unique per person/team/month), status events (create and change events with
  actor and value, no event for non-status edits, read-only for clients),
  views (`v_won_monthly`, `v_customer_totals`), snapshots (Director only,
  future/invalid month rejected, live write, idempotent re-run, row contents,
  reconstruction excludes deals that did not exist yet, read-only for clients),
  data health (zero-value, unlinked, normalised duplicates, member-only),
  merge route (Director only, links all spellings across deals and reports,
  404 for unknown customer), digest preview and send with no channels.
- `tests/rules-test.mjs` – now **63 checks pass** (two new: removing two users
  who both had a plan on the same day). Count-based assertions were replaced
  with checks on the specific records so the suite works with existing data.
- `tests/oauth-test.mjs` – **12 checks pass** after the changes.
- Full sequence rules → analytics → sign-in passes on the same database.
- Browser (DOM-driven, Director): Overview forecast/KPIs/stale list, analytics
  KPIs reconcile by hand (e.g. year-to-date target ฿12,150,000 = ten months of
  default targets plus this month's person and team overrides), funnel, lost
  reasons, product mix, leaderboard, snapshot backfill, customers list, search
  with focus kept, 360 page, merge screen linking "Kata Beach Hotel" to the
  existing hotel, weekly visit summary and plan matching (Rep One 2/4,
  Rep Two 2/3, verified against the seeded plans), digest, quota cell save and
  clear, settings save, snapshot button, deal dialog with new fields, lost
  reason toggle, customer link on save, all six CSV exports (header row,
  UTF-8 BOM bytes EF BB BF confirmed).
- Roles: Sales, Spec and Viewer see the correct tabs and buttons (no digest
  for Sales/Spec, no merge or backfill except Director, Viewer cannot add
  customers, Sales see only their own visits on customer pages).
- Headless Chrome via the DevTools protocol, real viewports 1280×900 and
  390×844, all ten tabs plus customer page and deal dialog: no horizontal page
  overflow, no page errors; screenshots reviewed.

Bugs found and fixed in this round:
1. Removing a second user with a plan on the same day as an already-removed
   user failed ("Value must be unique") because of the (owner, date) unique
   index. New migration `1761600001_fix_plans_unique.js` makes it partial.
2. The embedded JS engine has no locale-aware number formatting; digest text
   now formats numbers manually.
3. Company-suffix normalisation missed "CO LTD" without a dot.
4. Snapshot backfill prompt kept reappearing for months before any deal
   existed; such months are no longer reported as missing.
5. Phone layout: the ten-tab menu filled the first screen; it is now one
   horizontally scrolling row.
6. Sales users saw other reps' visit counts as 0 in the leaderboard (they
   cannot read those reports); now shown as "-".

Not verified in this round: real LINE and SMTP delivery (no credentials),
the hourly snapshot cron firing on its schedule (the same code path was
exercised through the Director route), printing on paper.

## Data-visualization round (2026-10-27, third iteration)

See `docs/DATAVIZ.md` §3. Palette validated with the dataviz validator against the app surfaces in both themes; headless Chrome checks in dark and light at 1280 px and 390 px found no overflow and no page errors; tooltips verified for pointer and keyboard focus (focus checked with focus emulation, since headless Chrome does not deliver focus events to an unfocused page); table views, period presets, render stability and print emulation verified. Bugs fixed during this round: tooltip hidden when keyboard focus scrolled the page; compact numbers showed "7.50M" and rounded 12.15 M to "12M". The sign-in suite was not rerun (no backend change and it deletes all users on the dev database); rules 63/63 and analytics 54/54 pass.

## Not executed (must be verified on the VPS)
- Real Google OAuth flow with your client id/secret and domain (popup,
  consent screen, redirect URI). Mock-provider coverage of the hook logic is
  complete, but Google's own screens and the `redirect_uri_mismatch` class of
  configuration errors can only be checked live.
- RunCloud panel steps: web app creation, `location.root` custom config
  acceptance by "Run and Debug", Let's Encrypt issuance, Supervisor job.
- Linux binary execution, systemd unit, file permissions under the RunCloud
  user, `LimitNOFILE`, log file growth.
- NGINX SSE behaviour through RunCloud (realtime); the config follows
  PocketBase's documented proxy settings but was not run under NGINX here.
- Content-Security-Policy header as emitted by RunCloud NGINX (the header text
  was reviewed against the page's resources; Google Fonts and same-origin
  script/SDK are allowed).
- Nightly backup cron and `backup-offsite.sh` against a real destination.
- Behaviour on Safari/iOS (popup blockers) and Thai font loading on devices.

## Local development (how to re-run the tests)

```bash
# PocketBase binary for your OS in the project root (or elsewhere; adjust path)
cat > .env <<EOF
CRM_APP_URL=http://127.0.0.1:8090
CRM_DEV_PASSWORD_AUTH=1
CRM_DIRECTOR_EMAIL=director@local.test
PB_ENCRYPTION_KEY=$(openssl rand -hex 16)
EOF
./pocketbase superuser upsert admin@local.test adminpass123 --dir=pb_data --hooksDir=pb_hooks --migrationsDir=pb_migrations --encryptionEnv=PB_ENCRYPTION_KEY
bash deploy/run-pocketbase.sh --publicDir=public     # http://127.0.0.1:8090/
cd tests && npm install && npm run test:rules && npm run test:oauth
```

With `CRM_DEV_PASSWORD_AUTH=1` the login page shows an extra "เข้าสู่ระบบด้วย
รหัสผ่าน (สำหรับทดสอบ)" form; the test scripts create users with password
`testpass123!`. Never set that variable in production.
