# Feature Inventory

Status legend: ✅ working and tested locally · ⚠️ working, needs configuration on your side · ❌ not available

| # | Module / feature | Where (front-end → backend) | Status | Notes |
|---|---|---|---|---|
| 1 | Google sign-in | `app.js` login view → `users` OAuth2 (`pb_hooks/auth.pb.js`) | ⚠️ | Needs `GOOGLE_CLIENT_ID/SECRET` in `.env`. Flow verified with a mock OpenID provider; Google itself untested here. |
| 2 | Director bootstrap | `pb_hooks/auth.pb.js` | ✅ | `CRM_DIRECTOR_EMAIL` or first sign-in becomes Director. Replaces the old first-time setup screen. |
| 3 | Rejection of non-team Google accounts | `pb_hooks/auth.pb.js` | ✅ | No record is created; message "บัญชีนี้ยังไม่ได้ลงทะเบียนในทีม ติดต่อ Director". |
| 4 | Sign-out, session persistence | `pb.authStore` (localStorage) | ✅ | Token refreshed on load; removed users are signed out on next refresh. |
| 5 | Overview (ภาพรวม): status cards per team, donut, stacked bars, closed-won vs quota | `ov()/sec()/ch()` → `deals`, `users` | ✅ | Teams PJ-BKK / PJ-PKT + "ยังไม่ระบุทีม" bucket, unchanged. |
| 6 | Month selector + roll-over rule | `inM()` | ✅ | Commit/pending roll forward; won/lost stay in `closedMonth`. |
| 7 | Pipeline Kanban, drag-and-drop status change | `pl()`, drop handler → `deals.update` | ✅ | Only own cards (or all for Director) are draggable; activity log appended. |
| 8 | Commit table, team/rep filter, text search, lock icon for others' deals | `al()` | ✅ | |
| 9 | Deal create / edit / delete, owner selection (Director), activity history | `open()/save()` → `deals` | ✅ | Rules: Director any; Sales/AM own only; Spec/Viewer read-only. |
| 10 | **New:** document attachments on deals | `open()/save()/fileRemove()` → `deals.files` | ✅ | Up to 10 files × 10 MB (PDF, Office, images, text, zip). Protected downloads via file token. 📎 count in table and cards. |
| 11 | Weekly report (รายงานประจำสัปดาห์): week navigation, per-day rows, owner filter | `wk()/subW()` → `reports` | ✅ | Viewers/AM/Director see everyone; Sales/Spec see own. |
| 12 | Weekly report entry create / edit / delete | `wdlg()/wsave()` | ✅ | Saving an entry in another week jumps to that week (unchanged). |
| 13 | **New:** customer-visit photos on report entries | `wdlg()` → `reports.photos` | ✅ | Up to 10 images × 5 MB, thumbnails 200×200 in the dialog, 📷 count in the table, full-size on click, per-photo delete by owner. |
| 14 | Manager comments on report entries | `wcom()` → `rcomments` | ✅ | Director/AM/Viewer can comment on others' entries; comments are create-only. |
| 15 | Visit plan calendar (แพลนเข้าพบลูกค้า): month navigation, per-day text, owner selector for managers | `cal()/pdlg()/psave()` → `plans` | ✅ | Empty text deletes the day. Unique (owner, date). |
| 16 | Sales Spec Report table, status filter, search, create / edit / delete (Spec only) | `sr()/sdlg()/ssave()` → `specrep` | ✅ | Everyone else read-only. |
| 17 | Team & targets (ทีมและเป้า): list, add user by Google e-mail, edit name/role/team/quota/e-mail, inline team select, quota prompt, delete | `tm()/addRep()/udlg()/usave()` → `users` | ✅ | Director only; AM sees read-only. No password field any more. |
| 18 | Real-time updates across users and tabs | `watch()` + PocketBase SSE | ✅ | Verified: a change by one user appears in another session without reload. |
| 19 | Dark / light theme toggle | `setTh()` (localStorage) | ✅ | |
| 20 | Responsive layout | CSS media queries | ✅ | Verified in headless Chrome at a real 390 px viewport: no horizontal page overflow on any tab; navigation scrolls in one row. |
| 21 | Rate limiting | PocketBase settings (`1761500001_settings.js`) | ✅ | Auth 10/min, create 60/min, API 400/10 s per IP. |
| 22 | Nightly backups | PocketBase settings + `deploy/backup-offsite.sh` | ⚠️ | Built-in cron 02:00 keep 7 is set; off-site copy needs a destination (RunCloud cron). |
| 23 | Admin dashboard | PocketBase `/_/` | ✅ | Superuser created by `deploy/install.sh`; restrict by IP in NGINX. |
| 24 | Password reset e-mails | – | ❌ | Not needed with Google sign-in. |
| 26 | Weighted forecast, win rate, average deal, lost value per team and person | `sec()` in `app.js` | ✅ | Probability of "รอลูกค้าพิจารณา" configurable (default 30 %). |
| 27 | Deal aging and stale flags, stale-deal list | `since()`, `stale()` | ✅ | Threshold configurable (default 14 days). |
| 28 | วิเคราะห์ tab: 12-month won vs target, pipeline at month end, funnel, days per stage, sales cycle, lost reasons, product mix, visits by type and outcome, leaderboard | `an()` → `v_won_monthly`, `deal_snapshots`, `deal_events`, `reports` | ✅ | History of statuses starts when this version is installed (see docs/ANALYTICS.md §4). |
| 29 | Status history with actor (server-side) | `pb_hooks/analytics.pb.js` → `deal_events` | ✅ | Shown in the deal dialog and used by funnel/digest. |
| 30 | Month-end pipeline snapshots + backfill | cron + `/api/crm/snapshot/{month}` → `deal_snapshots` | ✅ | Hourly for the running month; Director rebuilds past months. |
| 31 | Monthly targets per person and team (quota history) | ทีมและเป้า grid → `quotas` | ✅ | Blank cell = default target. |
| 32 | Deal fields: expected close, product line, province, lost reason | deal dialog | ✅ | Lists editable in settings. |
| 33 | Customer master, autocomplete, auto-create, merge screen | ลูกค้า tab → `customers`, `/api/crm/link-customer` | ✅ | Name normalisation drops company affixes. |
| 34 | Customer 360 page | ลูกค้า → customer | ✅ | Visits limited by the viewer's report permissions. |
| 35 | Visit type and outcome; plan vs actual; weekly visit summary | weekly report, plan dialog | ✅ | |
| 36 | Manager weekly digest (printable) | สรุปสัปดาห์ (Director, AM, Viewer) | ✅ | |
| 37 | CSV export | Commit, weekly report, Spec report, customers, leaderboard, digest | ✅ | UTF-8 BOM for Excel; formula-injection safe. |
| 38 | Data-health panel | ทีมและเป้า → `/api/crm/health` | ✅ | |
| 39 | Analytics settings (probability, stale days, teams, product lines, lost reasons) | ทีมและเป้า → `crm_settings` | ✅ | Teams are no longer hard-coded. |
| 41 | Validated chart colours (ordered stage ramp, status colours with labels), headline figure with meter and sparkline, change vs last month, open-pipeline bar, analytics filter row, tooltips (mouse, touch, keyboard), table view for every chart, phone-width charts, light-theme printing | `public/index.html` tokens, `fig()`/`svgChart()`/`meter()` in `app.js` | ✅ | See docs/DATAVIZ.md. |
| 40 | Weekly digest via LINE / e-mail | `pb_hooks/notify.pb.js` | ⚠️ | Needs `NOTIFY_LINE_*` or `SMTP_*` in `.env`; preview and send-now on ทีมและเป้า. Not tested against real LINE/SMTP. |
| 25 | Data migration from Firebase | – | ❌ | Not requested (fresh start). |

Removed on purpose: the "ตั้งค่าครั้งแรก (Director)" screen and e-mail/password login (replaced by Google sign-in; a password form is shown only when `CRM_DEV_PASSWORD_AUTH=1` for local testing).
