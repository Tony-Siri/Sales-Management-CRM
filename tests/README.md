# Integration tests and demo data

These scripts exercise the real PocketBase backend (rules, hooks, uploads,
analytics, Google sign-in gating via a mock OpenID provider). **Run them only
against a throw-away local server.** They create and delete users and records,
and `oauth-test.mjs` temporarily deletes *all* users and re-creates them.

```bash
# 1. start a local dev server (dev-start.cmd on Windows, see docs/TESTING.md)
# 2. install the SDK once
cd tests && npm install
# 3. run (rules first: it creates the test users the others need)
npm run test:rules       # 63 checks: role matrix, ownership, uploads, protected files, user removal
npm run test:analytics   # 54 checks: customers, quotas, settings, status events, snapshots, views, /api/crm/*
npm run test:oauth       # 12 checks: link-by-e-mail, stranger rejection, Director bootstrap (destructive, run last)
npm test                 # all three in that order
npm run seed:demo        # optional: demo customers, 6 months of deals, visits and plans for the analytics screens
```

The local server must be started with `CRM_DEV_PASSWORD_AUTH=1` and
`CRM_DIRECTOR_EMAIL=director@local.test`, with a superuser
`admin@local.test` / `adminpass123` (change the arguments otherwise). The test
users all use the password defined as `PW` in `rules-test.mjs`.

Sign-in is rate limited to 10 per minute per IP (production setting); the
scripts wait and retry automatically, so a full run takes a few minutes.
