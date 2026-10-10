[English](README.en.md) | [ภาษาไทย](README.md)

# SalesForce – Sales Team Commit Tracker

A single-file web app (`index.html`) for a sales team: track commit deals, weekly reports, customer visit plans and a Sales Spec report.
No build step. Plain JavaScript plus Firebase (Authentication and Firestore). Data updates in real time. The UI is in Thai.

## Features

| Page | What it does |
|---|---|
| Overview | Value by status, split by team (PJ-BKK / PJ-PKT), donut chart, stacked bars per person, and closed-won vs. target (%) |
| Pipeline | Kanban board with 5 statuses; drag a card to change its status |
| Commit | Table of all deals, filterable by team and salesperson, searchable |
| Weekly report | Daily customer-visit log; managers can add comments under each entry |
| Customer visit plan | Monthly calendar for daily visit plans |
| Sales Spec Report | Running project-tracking table, editable by Sales Spec only |
| Team & targets | The Director manages users, roles, teams and sales targets |

Deal rules: Commit 100%, Commit 80% and "waiting for customer" deals roll over to the next month automatically.
"Closed won" and "closed lost" deals stay in the month they were closed.

## Roles and permissions

| Role | Deals | Weekly report | Visit plan | Sales Spec Report | Team & targets |
|---|---|---|---|---|---|
| Director | View/edit all | View everyone + comment | View everyone | View | Full control |
| Assistant Manager | View all, edit own | Write own, view everyone + comment | Write own, view everyone | View | View only |
| Sales | View all, edit own | Own only | Own only | View | Hidden |
| Sales Spec | View only (no target) | Own only | Own only | Write/edit | Hidden |
| Viewer | View only | View everyone + comment | View everyone | View | Hidden |

Permissions are enforced in the database by Firestore Security Rules (`firestore.rules`), not only hidden in the UI.
People who are not on the team list cannot read any data.

## Setup (use your own Firebase)

1. Create a project in the [Firebase Console](https://console.firebase.google.com) and add a **Web app**.
2. **Authentication** → Sign-in method → enable **Email/Password**.
3. **Firestore Database** → Create database (production mode).
4. Open the **Rules** tab, paste the contents of `firestore.rules`, and click **Publish**.
5. In `index.html`, replace the placeholder values in `cfg` (near the start of the `<script type="module">` block) with your project's Firebase config.
6. Deploy it. It must be served over `http://` or `https://`, not `file://`.
   - **Netlify Drop:** drag the folder containing `index.html` to app.netlify.com/drop
   - **GitHub Pages:** Settings → Pages → choose a branch
   - Local test: `python -m http.server 8000`, then open `http://localhost:8000`
7. Open the site and click **ตั้งค่าครั้งแรก (Director)** ("first-time setup") to create the Director account. This can be done only once.
8. Go to **ทีมและเป้า** (Team & targets) to add users, roles, teams and targets.

### About usernames
The login field accepts an email or a plain username. If there is no `@`, the app appends `@salesforce.local` behind the scenes
(for example, a Viewer can sign in as `Management`). A user removed from the Team page can no longer sign in,
but the account still exists in Firebase Authentication; delete it in the Console if you want to reuse the same email.

## Data model (Firestore)

| Collection | Contents |
|---|---|
| `users` | Name, email, role (`director` `am` `rep` `spec` `viewer`), team, target |
| `deals` | Project, customer, owner, value, status, month, activity history |
| `reports` / `rcomments` | Weekly report entries and manager comments |
| `plans` | Daily visit plans (document id = `uid_date`) |
| `specrep` | Rows of the Sales Spec Report |
| `config/setup` | Marker that the first-time Director setup is done |

## Security notes

- A Firebase web config is not a secret, but all security depends on the Rules. Publish `firestore.rules` before real use.
- Restrict your API key to your site's domain in Google Cloud Console → APIs & Services → Credentials.
- If you publish your own copy in a public repository, keep placeholder values in `cfg`, or use a private repository.
- Never put passwords or real customer data in the code or the README.

## Free-tier limits

Firestore (Spark plan) has daily read/write quotas and Netlify (Free) has monthly quotas. Check the Usage page of each service.
If your data grows large, consider loading only the period being viewed.
