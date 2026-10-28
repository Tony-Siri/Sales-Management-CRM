# UX / UI Audit and Improvement Plan

Date 2026-10-27. Scope: every screen of the web app (`public/index.html`, `public/app.js`)
at desktop 1280 px and phone 390 px, dark and light theme, plus a 640 px pass (equivalent
to 200 % zoom). Method: the design-critique framework (first impression, usability,
hierarchy, consistency, accessibility) and a WCAG 2.1 AA review (keyboard, focus, touch
targets, contrast, forms, dialogs, semantics). Evidence came from headless-Chrome
screenshots of 36 states and automated measurements of touch targets, labels, headings,
focus order and dialogs. Contrast was measured in the data-visualization audit
(`docs/DATAVIZ.md`) and is not repeated here.

Context: an internal tool for a Thai sales team (Director, Assistant Manager, Sales,
Sales Spec, Viewer). Stage: functional and shipped internally; the question is polish and
robustness, not exploration.

## 1. Overall impression

The app is fast, dense and consistent: one font, one card style, one accent, the same
dialog everywhere, dark and light themes that both work. Desktop is good. The two big
opportunities are **keyboard access** (nothing except form fields is reachable by Tab) and
**phones**, where every data table is squeezed into 390 px and the main action button of a
dialog sits below the fold.

## 2. Findings

### 2.1 Usability

| # | Finding | Evidence | Severity | Recommendation |
|---|---|---|---|---|
| U1 | Wide tables on phones: weekly report (8 columns), Spec report (12), Commit (9), Team (6 + a 13-column target grid) and the digest tables are crushed; headers wrap one word per line and the main text column is cut off | `m-wk`, `m-sr`, `m-al`, `m-tm` screenshots; 1–2 tables wider than the viewport on every data tab | 🔴 Critical | Below 700 px render each row as a **card** (title line, meta line, value right-aligned, status chip) instead of a table; keep the table from 700 px up. Same markup, CSS-driven (`display:grid` rows with `data-label` cells) |
| U2 | Dialog primary action off-screen on phones: the deal dialog is 810 px tall in an 844 px viewport, the report dialog longer; บันทึก is only reachable after scrolling inside the dialog | `m-dialog-deal`, measured `scrollable:true` | 🔴 Critical | Make the dialog a bottom sheet on phones: fixed header with title, scrolling body, **sticky footer** with ปิด / บันทึก; max-height 100 dvh |
| U3 | Nav scrollbar reads as a tab indicator: on phones the thin horizontal scrollbar under the tab row looks like an underline on "Pipeline" whatever tab is active | `m-ov`, `m-tm`, `m-pn` screenshots | 🟡 Moderate | Hide the scrollbar (`scrollbar-width:none`), add real selected styling (filled pill already exists) plus fade edges or arrows to show more tabs exist; scroll the active tab into view on change |
| U4 | Ten top-level tabs is too many to scan; related screens are not grouped | header on both breakpoints | 🟡 Moderate | Group into 4 areas with a secondary row: **ขาย** (ภาพรวม, Pipeline, Commit, วิเคราะห์) · **ลูกค้า** · **รายงาน** (รายงานประจำสัปดาห์, สรุปสัปดาห์, แพลนเข้าพบ, Sales Spec) · **ทีม**. On phones show a bottom tab bar with the 4 areas |
| U5 | Kanban on phones shows one and a half columns and needs horizontal scrolling to find a stage | `m-pl` | 🟡 Moderate | Phone: a segmented control of the 5 stages (with counts) above a single column; keep drag-and-drop on desktop and add a "ย้ายไป…" select in the card dialog for touch |
| U6 | Destructive actions use the browser's `confirm()`; target editing uses `prompt()`; errors on inline team change use `alert()` | `app.js` lines ~561–613 | 🟡 Moderate | One styled confirmation dialog (title, consequence text, destructive button) and inline editing for the default target; inline error text instead of `alert` |
| U7 | Clickable rows and cards have no affordance: no chevron, no hover state on phones, cursor only | all list screens | 🟡 Moderate | Add a trailing chevron/“แก้ไข” affordance on rows, press state, and make the whole row a real button (see A1) |
| U8 | The Team page is five unrelated sections on one long scroll (users, add user, monthly targets, settings, data health, snapshots, notifications) | `d-tm`, `m-tm` | 🟡 Moderate | Split into sub-tabs: ผู้ใช้ · เป้า · ตั้งค่า · ข้อมูล (health, snapshots, notifications) |
| U9 | Filters are placed differently per screen: month in the header on 3 tabs, a filter row on วิเคราะห์, controls inline on others; CSV button position varies | screenshots | 🟢 Minor | One filter-row component used on every list tab, CSV always at the far right |
| U10 | Empty states are a bare sentence inside an empty table (e.g. Spec report for a Viewer shows 12 headers and "0 รายการ") | `m-viewer-sr` | 🟢 Minor | Empty-state block: icon, one sentence, and the primary action when the role can add |
| U11 | "+ ดีลใหม่" is in the header on every tab, including ones where it is unrelated (calendar, team) | header | 🟢 Minor | Show it on ภาพรวม / Pipeline / Commit; elsewhere keep it in an overflow or hide |
| U12 | Week navigation uses a date input that shows a US date format (10/26/2026) next to Thai dates | `d-wk`, `m-wk` | 🟢 Minor | Show the week as text (“26 ต.ค. – 1 พ.ย. 69”) with prev/next and a “สัปดาห์นี้” button; keep the native picker behind the text |
| U13 | No loading skeleton or progress indication on first load and on tab switches that fetch (วิเคราะห์, ลูกค้า → customer page shows “กำลังโหลด...”) | code | 🟢 Minor | Keep the previous frame at reduced opacity with a thin progress bar at the top |

### 2.2 Visual hierarchy

- **What draws the eye first**: desktop ภาพรวม now leads with the hero figure, which is correct. On phones the header (two rows of controls plus the tab strip) takes 130 px before any content.
- **Reading flow**: top-down works on desktop. On phones the order inside the header is logo → new-deal button → user name → theme → logout → tabs; the user name and theme toggle are noise at the top of every page.
- **Emphasis**: section headings (h2 with inline statistics) and card titles compete; "แก้ไข / ลบ" links in red/blue text carry more visual weight than the row content.
- **Density**: tables use 9 px row padding and 14 px text, fine on desktop; on phones the same density with horizontal scroll is the main pain point.

### 2.3 Consistency

| Element | Issue | Recommendation |
|---|---|---|
| Buttons | Three visual kinds (`.b`, `.b.gh`, `.b.rd`) but text links (`<a data-a>`) are also used as actions (แก้ไข, ลบ, + เพิ่มรายการ, cuBack) | Links navigate, buttons act: convert action links to `.b.sm` buttons or a consistent “text button” class with a 44 px hit area |
| Dates | Three formats: `2026-10` in CSV and tiles, `26/10/69` Thai short, native picker in US format | Thai short date everywhere in the UI; ISO only in exports |
| Headings | h2 only on ภาพรวม; most tabs start with h3 or none; no h1 anywhere after login | One visually-hidden h1 per view (“ภาพรวม – ต.ค. 69”), sections h2, cards h3 |
| Spacing | Section gaps 36 px, card gaps 12 px, dialog field gaps 10 px; the Team page mixes all three | Define 4 spacing tokens (4/8/16/32) and use them |
| Icons | Emoji used as icons (📎 📷 ⚠ ⏱ 🔗 ◀ ▶ ⬇ 🖨 ↻ ✓ ◐) render differently per OS and have no accessible name | Inline SVG icon set (10 icons) with `aria-hidden` and visible text or `aria-label` |
| Theme toggle | Labelled “◐ มืด/สว่าง” in the header and “◐ สลับโหมดมืด/สว่าง” on login | One label, one place (user menu) |

### 2.4 Accessibility (WCAG 2.1 AA)

Summary: **14 issues** – 3 critical, 7 major, 4 minor.

#### Perceivable
| # | Issue | Criterion | Severity | Recommendation |
|---|---|---|---|---|
| P1 | Form controls rely on placeholders: filters (month, team, rep, search), per-user team selects on the Team page, the add-user form (11 unlabeled controls there) | 3.3.2 / 1.3.1 | 🟡 Major | Visible labels (or `aria-label` for the filter row) on every control; `<label for>` in the add-user form |
| P2 | Emoji-only meaning (📎 count, 🔒 locked, 📷) has no text alternative | 1.1.1 | 🟢 Minor | `aria-label` or visually-hidden text (“2 ไฟล์แนบ”, “แก้ไขไม่ได้”) |
| P3 | No h1 and no heading on several views; headings jump h2→h3 inconsistently | 1.3.1 / 2.4.6 | 🟡 Major | Heading outline per view as in 2.3 |

#### Operable
| # | Issue | Criterion | Severity | Recommendation |
|---|---|---|---|---|
| O1 | **Keyboard cannot reach the navigation, logout, theme toggle, any action link, table rows, Kanban cards or calendar cells.** `<a data-a>` elements have no `href` so they are not focusable; rows/cards/cells are `div`/`tr` with click handlers only. Measured Tab order on ภาพรวม: month input → new-deal button → chart tiles → end | 2.1.1 | 🔴 Critical | Make every action a `<button>` (or `<a href>`), give rows/cards/cells `tabindex="0"`, `role="button"` and Enter/Space handling; nav as `<nav><a href="#tab">` with `aria-current="page"` |
| O2 | No skip link; focus starts at the first control of the sticky header on every re-render | 2.4.1 | 🟢 Minor | “ข้ามไปเนื้อหา” skip link to `main` |
| O3 | Touch targets: tab links 33 px tall, action links ~20 px tall, quota grid inputs 28 px, Kanban card badges; 108 of 111 interactive elements on the Team page are under 44 px on phones | 2.5.5 | 🟡 Major | 44 px minimum on phones: taller tabs, buttons instead of links, padded cells |
| O4 | Focus is lost after every re-render (the app rebuilds `#app` on each state change); only the search boxes restore focus | 2.4.3 | 🟡 Major | Restore focus by element id/`data-a` key after render, as already done for inputs |
| O5 | Drag-and-drop is the only way to change a stage on the Pipeline board (no keyboard or touch alternative other than opening the dialog) | 2.1.1 / 2.5.7 | 🟡 Major | “ย้ายไป” stage select in the card and the dialog |
| O6 | Dialog has no accessible name and no `aria-describedby` for the error line | 4.1.2 | 🟢 Minor | `aria-labelledby` on `<dialog>` pointing at its h3; `aria-live="polite"` on `.er` |

#### Understandable
| # | Issue | Criterion | Severity | Recommendation |
|---|---|---|---|---|
| N1 | Validation errors are generic (“บันทึกไม่ได้ (…)”) and shown far from the field; required fields are not marked | 3.3.1 / 3.3.2 | 🟡 Major | Mark required fields, show the specific field error under the field, keep the summary line |
| N2 | Changing a `select` on the Team page saves immediately with no feedback; the quota grid saves on blur silently | 3.2.2 | 🟢 Minor | Toast or inline “บันทึกแล้ว ✓” for 2 s; `aria-live` region |

#### Robust
| # | Issue | Criterion | Severity | Recommendation |
|---|---|---|---|---|
| R1 | Clickable `tr`, `.cd`, `.cc` elements have no role, name or state | 4.1.2 | 🔴 Critical | See O1; rows get `role="button"` + `aria-label` built from the row text |
| R2 | Live data updates re-render the whole page without announcing anything | 4.1.3 | 🟢 Minor | One polite live region for “อัปเดตข้อมูลแล้ว” on remote changes |
| R3 | Native `confirm/prompt/alert` block the thread and are not themeable or screen-reader friendly in all browsers | 4.1.2 | 🟡 Major | Styled `<dialog>` confirmations (see U6) |

Contrast: all text and chart colours now pass (see `docs/DATAVIZ.md`). Zoom: at 640 px (200 %) no page overflow; tables scroll inside `main`. Dialogs: Escape closes, focus moves to the first field, focus is trapped by the native `showModal()` (good).

### 2.5 What works well
- One coherent visual system: tokens, one card, one button family, consistent dark and light themes.
- Real-time updates without flashing, and a correct, labelled chart layer.
- Dialog pattern is consistent across deals, reports, plans, spec rows, customers and users.
- Phone layout never overflows the page horizontally; the tab strip scrolls.
- Login is a single clear action with the fallback hidden behind a disclosure.

## 3. Improvement plan

Priorities by user impact ÷ effort. Effort: S ≤ ½ day, M 1–2 days, L 3+ days. All changes
stay in `public/index.html` (CSS) and `public/app.js`; no backend change.

### Phase 1 – Access for everyone (keyboard + phones), ~3 days
1. **Keyboard reachability (O1, R1, O4)** – M. Convert `<a data-a>` actions to `<button class="lnk">`; nav items to `<a href="#ov">` with `aria-current`; rows/cards/cells get `tabindex="0" role="button"` and an Enter/Space handler in the existing click dispatcher; restore focus after render by `data-a`+`data-id` key. Add a skip link (O2).
2. **Phone tables → cards (U1)** – M. A `@media (max-width:700px)` rule set: `table.cards tr` becomes a grid card, each `td` shows its header via `data-label`; applied to Commit, weekly report, Spec report, customers, digest and Team users. Header labels are added once in the render functions.
3. **Phone dialogs as bottom sheets with sticky footer (U2)** – S. CSS only plus wrapping the dialog body in a scroll container.
4. **Touch targets (O3)** – S. Tabs 44 px, `.lnk` buttons 44 px hit area, quota inputs 40 px with padding.

### Phase 2 – Navigation and structure, ~2 days
5. **Grouped navigation (U4, U3)** – M. Four areas with a secondary row on desktop; bottom tab bar on phones; hide the scrollbar; scroll the active tab into view.
6. **Team page sub-tabs (U8)** – S.
7. **Heading outline, labels, live regions (P1, P3, O6, N2, R2)** – S. Visually-hidden h1 per view, `<label>`s in the filter row and add-user form, `aria-labelledby` on the dialog, one `aria-live` region.
8. **Pipeline on phones (U5, O5)** – M. Stage segmented control + single column; “ย้ายไป” select in card dialog.

### Phase 3 – Consistency and polish, ~2 days
9. **Styled confirmations and inline target editing (U6, R3)** – S.
10. **Action affordances and icon set (U7, P2, consistency)** – M. Chevrons on rows, inline SVG icons with accessible names, one button vocabulary.
11. **Date/filters/CSV placement and week header (U9, U12)** – S.
12. **Empty states and loading (U10, U13, U11)** – S.
13. **Field-level validation messages (N1)** – S.

### Verification for each phase
- Automated (existing headless-Chrome script, extended): Tab through each view and assert every `data-a` element is reachable; count elements under 44 px on phones (target 0 outside dense grids); no unlabeled controls; one h1 per view; no page overflow at 390 px and 640 px.
- Manual: operate the full deal flow (create, move stage, attach file, delete) with keyboard only; NVDA or VoiceOver pass over nav, a table, a dialog; phone pass on a real device for the card lists and bottom sheets.
- Regression: `tests/rules-test.mjs` and `tests/analytics-test.mjs` unchanged; screenshot comparison of all 36 states.

## 4. Appendix – measurements

| Measure | Result |
|---|---|
| Interactive elements under 44 px on phones | ภาพรวม 21/21 (all nav), Commit 18/27, weekly report 18/25, Team 108/111 |
| Unlabeled controls | Commit 4, Team 11, weekly report 2, customers 2, calendar 2 |
| Focusable clickable rows/cards/cells | 0 of 9 (Pipeline), 0 of 9 (Commit), 0 of 45 (digest), 0 of 31 (calendar) |
| h1 after login | 0 on every view |
| Tables wider than the phone viewport | 1 on Commit, weekly report, Spec, customers; 2 on digest and Team |
| Dialog on phone | 810 px tall / 844 px viewport, body scrolls, actions below the fold |
| Page overflow | none at 390 px and 640 px |
| Escape closes dialog / focus moves into dialog | yes / yes |
