# Data-visualization Audit and Changes

Audit date 2026-10-27, done with the dataviz method: pick the form, assign colour by its
job, validate the palette with the validator script (not by eye), apply mark specs, add the
hover layer, check accessibility, then render and look. Colours were measured against the
app's real card surfaces: dark `#141a24`, light `#ffffff`.

## 1. What was wrong

| Area | Finding | Measured |
|---|---|---|
| Colour | Commit 100 % (blue) and Commit 80 % (violet) were indistinguishable for colour-blind readers and hard for everyone; they touch in every stack, the donut and the Kanban | CVD ΔE 2.7 (target ≥ 8), normal-vision ΔE 10.9 (floor 15) |
| Colour | Deal stages are an ordered scale (30 % → 80 % → 100 %) but used five unrelated hues | form error |
| Colour | Status tags and Kanban headers used the status colour as text; unreadable in light mode | 1.94–2.81 : 1 (text needs 4.5 : 1) |
| Colour | Dark-mode stage colours too bright for dark cards; visit-type chart reused stage colours with other meanings | lightness band fail |
| Colour | Warning states (stale deals, missing comments) shown by colour only | — |
| Form | Donut of value by status repeated the five tiles above it and mixed open pipeline with won/lost | anti-pattern |
| Form | No single headline; attainment bars capped at 100 % so over-achievement and forecast beyond target were invisible | — |
| Form | KPI tiles had no comparison or trend | — |
| Marks | Columns up to 34 px with all corners rounded, no gaps between stacked segments, no baseline, no labels | — |
| Mobile | Chart text shrank to about 5 px because the SVG was scaled down | 11 px → ≈ 5 px |
| Interaction | Only native `title` tooltips: slow, no keyboard, no touch; no table view; `aria-label="chart"` | — |
| Filters | Month in the header, team filter in the body, window fixed at 12 months | — |
| Rendering | Every realtime event rebuilt the page, so charts flashed | — |
| Print | The digest printed light text on white paper (dark theme colours) | — |

## 2. What changed

**Colour tokens** (`public/index.html`, `:root` dark and `[data-theme=light]`):

| Role | Light | Dark | Why |
|---|---|---|---|
| รอลูกค้าพิจารณา | `#86b6ef` | `#1c5cab` | blue ramp, lowest probability nearest the surface |
| Commit 80 % | `#3987e5` | `#3987e5` | blue ramp, middle |
| Commit 100 % | `#184f95` | `#86b6ef` | blue ramp, highest probability most prominent |
| ปิดขายแล้ว | `#0ca30c` | `#0ca30c` | status "good", always with its label |
| ปิดไม่ได้ | `#d03b3b` | `#d03b3b` | status "critical", always with its label |
| Categorical slots 1–4 | `#2a78d6 #eb6834 #1baf7a #eda100` | `#3987e5 #d95926 #199e70 #c98500` | documented palette, for visit types |
| Other | `#898781` | `#898781` | de-emphasis |
| Target line | `#52514e` | `#c3c2b7` | secondary ink |
| Up / down text | `#006300` / `#b42323` | `#0ca30c` / `#f87171` | ≥ 5.2 : 1 on cards |

Validation results (validator script, app surfaces):

- Open-stage ramp passes every ordinal check in both themes (monotone lightness, step gaps ≥ 0.06, light end ≥ 2 : 1 – 2.11 light, 2.63 dark, single hue).
- Stack neighbours: won ↔ Commit 100 % CVD ΔE 32.1 light / 24.9 dark; waiting ↔ lost 25.2 light / 18.5 dark; normal-vision ≥ 29.5. (The categorical lightness-band and contrast lines for those pairs fail by design because an ordinal light step is involved; the CVD and normal-vision gates are the ones that apply.)
- Visit-type slots 1–4 pass all categorical checks in both themes; in light mode aqua and yellow are below 3 : 1, so values are always shown in the legend list and the table view (relief rule).
- Tags and labels now use ink colours: ≥ 11.9 : 1.

**Forms**
- Overview: one headline figure (closed-won this month, all teams) with a meter showing the target tick and the forecast extension beyond it, a 12-month sparkline and the change vs last month; KPI tiles with change vs last month; ⚠ on warnings.
- Team sections: open-pipeline 100 % bar (three stages) with a value legend instead of the donut; per-person bars on one shared scale for all teams; meters per person.
- Analytics: one filter row (3 / 6 / 12 months or year-to-date, end month, team) scopes every tile and chart; funnel as ordered steps with step conversion; a separate won / lost / still-open bar; single-colour bars for one-measure lists; visits as a total per month plus a type-mix bar.

**Marks and chrome**: columns ≤ 24 px, 4 px rounded data-end, square at the baseline; 2 px surface gap between stacked segments; baseline hairline; target markers with a surface ring; line key in legends; labels only on the latest and peak bars; empty-state text; axis ticks with ฿ and clean steps; numbers right-aligned with tabular figures in tables; compact tile values with the exact amount on hover.

**Interaction and accessibility**: charts are drawn at the container's real width (text stays 11 px on phones) and redrawn on resize; one tooltip layer for mouse, touch and keyboard focus (crosshair band and all series with total on column charts; meters, sparklines, stacked segments); every chart has a "ดูเป็นตาราง" table view and a descriptive label; realtime updates no longer rebuild the page when nothing visible changed; printing always uses the light theme.

## 3. Verification

Headless Chrome (DevTools protocol), dark and light, 1280 px and 390 px, tabs ภาพรวม, Pipeline,
Commit, วิเคราะห์, ลูกค้า, สรุปสัปดาห์: no horizontal page overflow, no page errors, chart
axis text the same rendered size on phone and desktop. Hover shows the tooltip with the band
highlighted and the crosshair; keyboard focus shows all series and the total (checked with
focus emulation); meter tooltip; table-view toggle (13 rows for 12 months); period preset
(3 months → 3 columns); identical realtime update keeps the same DOM; print emulation gives
white cards with near-black text. Backend suites unchanged and passing (63 rules, 54 analytics).

## 4. Not done / optional

- Texture fill for forced-colours or greyscale print (optional in the method; the table view
  and labels already carry every value).
- Per-chart descriptions in plain language beyond the generated summary.
