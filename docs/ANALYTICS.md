# Analytics: Audit and Implemented Features

Audit date 2026-10-27. All four recommended phases were approved (waiting-for-customer
probability 30 %) and are implemented in this repository.

## 1. Audit findings (before)

| Area | Finding | Consequence |
|---|---|---|
| Deals | Status overwritten in place; open deals roll forward month to month | Past pipeline could not be reconstructed; no trends |
| Deals | Status history only as free text in the `act` log | No funnel, stage durations or sales-cycle length |
| Deals | No aging signal | Deals could sit in Commit 80 % for months unnoticed |
| Deals | No expected close date, lost reason, product line, province | No win/loss learning, no mix analysis |
| Customers | Free text in three places | Same customer spelled several ways; no per-customer totals |
| Targets | One current number per person | Past attainment recalculated against today's quota |
| Activity | Visits and plans unstructured, not linked to customers | No visit type, outcome, plan adherence |
| Reporting | One month, no export, no trend, no forecast | Managers re-keyed data into Excel |
| Data quality | No duplicate or zero-value checks | Silent errors in totals |

## 2. What was built

| Phase | Feature | Where |
|---|---|---|
| A1 | Weighted forecast per team and person (won and Commit 100 % ×100 %, Commit 80 % ×80 %, waiting × configurable %, default 30) with a lighter bar segment beyond closed-won | ภาพรวม, Pipeline column headers, Commit summary |
| A2 | 12-month trend: closed-won per month vs target; pipeline at month end from snapshots | วิเคราะห์ |
| A3 | Days in current status on cards and rows; stale flag when no activity for N days (default 14); stale-deal list | Pipeline, Commit, ภาพรวม, สรุปสัปดาห์ |
| A4 | Win rate, average won deal, lost value | ภาพรวม, วิเคราะห์ |
| A5 | CSV export (UTF-8 with BOM so Thai opens in Excel; formula-injection safe) | Commit, weekly report, Spec report, customers, leaderboard, digest |
| A6 | Weekly visit summary per person: visits, active days, photos, commented entries, plan lines, plan matches | รายงานประจำสัปดาห์ |
| B1 | Month-end pipeline snapshots: current month updated hourly by cron; past months rebuilt on demand from status history | `deal_snapshots`, `pb_hooks/analytics.pb.js` |
| B2 | Structured status history written server-side on every status change, with actor and value; funnel, days per stage, sales cycle | `deal_events`, วิเคราะห์, deal dialog |
| B3 | Monthly targets per person and per team, falling back to the person's default target | `quotas`, ทีมและเป้า grid |
| B4 | Expected close date, product line, province, lost reason (shown when status is lost); lost-reason and product-mix charts | deal dialog, วิเคราะห์ |
| C1 | Customer master with name normalisation (drops บริษัท / จำกัด / Co.,Ltd. etc.), autocomplete in deal, report and Spec dialogs, optional auto-create; Director merge screen that links all spellings at once | ลูกค้า, `customers` |
| C2 | Customer 360: totals, deals, visits with photos and comments, Spec rows, documents, timeline | ลูกค้า → click a customer |
| C3 | Visit type and outcome on report entries; plan vs actual matching per day; customer insert in the plan dialog | รายงานประจำสัปดาห์, แพลนเข้าพบลูกค้า |
| C4 | Printable manager weekly digest: per person activity, status changes, uncommented entries, stale deals | สรุปสัปดาห์ (Director, AM, Viewer) |
| D1 | Server-side SQL views for monthly won totals and customer totals | `v_won_monthly`, `v_customer_totals` |
| D2 | Data-health panel: stale, zero-value, possible duplicates, unlinked records, users without team, deals without owner | ทีมและเป้า, `/api/crm/health` |
| D3 | Team-level monthly targets, year-to-date attainment, 12-month leaderboard | ทีมและเป้า, วิเคราะห์ |
| D4 | Weekly digest via LINE Messaging API and/or e-mail, Mondays 08:00 Bangkok; preview and "send now" for the Director | `pb_hooks/notify.pb.js`, ทีมและเป้า |

Settings the Director can change on ทีมและเป้า: waiting-for-customer probability, stale days,
team names, product lines, lost reasons.

## 3. Metric definitions

| Metric | Definition |
|---|---|
| Deals in month M | Same rule as before: open deals with `month ≤ M`; won/lost deals whose `closedMonth = M` |
| Weighted forecast | Σ value × probability over deals in month M; lost = 0 |
| Win rate | won ÷ (won + lost), counted by deals closed in the period |
| Days in status | Days since the deal's last status event (or creation) |
| Stale | Open deal whose last update of any kind is ≥ stale days ago |
| Target for person, month | `quotas` row for that person and month, else the person's default target |
| Target for team, month | `quotas` team row, else sum of members' targets |
| Sales cycle | Days from creation to the won event, for deals created in the window |
| Days per stage | Time between consecutive status events, grouped by the status left |
| Plan match | A plan line matches when a visit on the same day has a customer whose normalised name contains, or is contained in, the line |
| Pipeline at month end | `deal_snapshots` rows for that month (`source = live` for months recorded at the time, `reconstructed` for backfills) |

## 4. Important behaviour

- **History starts now.** Status events exist only from the moment this version runs. Past
  months can be backfilled from events, but a deal entered today for an old month did not
  exist at that month's end, so it is not included. Closed-won trends use `closedMonth` and
  are therefore complete from day one.
- **Snapshots of the running month** are refreshed every hour; the last run of a month
  freezes it. A Director can rebuild any past month (ทีมและเป้า → Snapshot, or the button on
  วิเคราะห์).
- **Time zone.** Month boundaries for snapshots use `CRM_UTC_OFFSET_HOURS` (default 7).
- **Visibility.** Sales and Spec users see analytics for all deals (deals were already
  visible to all members), but visit statistics only for their own reports, matching the
  existing report rules. Visit columns for other people show "-" for them.
- **Customers.** Sales, AM, Spec and Director can create customers; the creator or the
  Director can edit; only the Director can delete or merge. Deleting a customer keeps the
  linked deals and reports.

## 5. Notifications setup (optional)

LINE Messaging API: create a LINE Official Account, enable Messaging API, issue a channel
access token, add the bot to the target group or chat, and put the token and the user or
group ID into `.env` as `NOTIFY_LINE_TOKEN` and `NOTIFY_LINE_TO`. LINE Notify was
discontinued in 2025 and is not used.

E-mail: set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (and optionally
`NOTIFY_EMAIL_TO`). Without `NOTIFY_EMAIL_TO` the Director and Assistant Managers receive it.

Restart the service after editing `.env`. ทีมและเป้า shows which channels are ready and has
a preview and a "send now" button.

## 6. Data model added

`crm_settings`, `customers`, `deal_events`, `deal_snapshots`, `quotas`, views
`v_won_monthly` and `v_customer_totals`; optional fields `customer`, `expectedClose`,
`lostReason`, `productLine`, `province` on deals, `customer`, `visitType`, `outcome` on
reports, `customer` on Spec rows. All additive (`pb_migrations/1761600000_analytics.js`).
Events and snapshots cannot be written by any client; they are written by server hooks.
