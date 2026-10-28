/// <reference path="../pb_data/types.d.ts" />
//
// Initial schema for the SalesForce CRM on PocketBase.
// Mirrors the original Firestore data model and the access matrix that was
// enforced by docs/legacy/firestore.rules.
//
// Role values: director | am (Assistant Manager) | rep (Sales) | spec (Sales Spec) | viewer
// A user record with an empty role is "not registered in the team" and can read nothing.

migrate((app) => {
  // ---- reusable rule fragments -------------------------------------------
  const MEMBER  = '@request.auth.id != "" && @request.auth.role != ""';
  const DIR     = '@request.auth.role = "director"';
  const SALES   = '(@request.auth.role = "rep" || @request.auth.role = "am")';
  const WRITER  = '(@request.auth.role = "rep" || @request.auth.role = "am" || @request.auth.role = "spec")';
  const VIEWALL = '(@request.auth.role = "director" || @request.auth.role = "am" || @request.auth.role = "viewer")';
  // system timestamps (not added automatically when fields are given explicitly)
  const AUTODATES = [
    { name: "created", type: "autodate", onCreate: true, onUpdate: false },
    { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
  ];
  const OWNER_UNCHANGED = '(@request.body.owner:isset = false || @request.body.owner = @request.auth.id)';

  // ---- users (auth collection, created by PocketBase; we extend it) -------
  const users = app.findCollectionByNameOrId("users");
  users.fields.removeByName("avatar");
  users.fields.add(new SelectField({
    name: "role",
    values: ["director", "am", "rep", "spec", "viewer"],
    maxSelect: 1,
  }));
  users.fields.add(new TextField({ name: "team", max: 50 }));
  users.fields.add(new NumberField({ name: "quota", min: 0 }));
  users.fields.getByName("name").required = true;
  users.fields.getByName("name").max = 100;
  users.fields.getByName("email").required = true;

  users.listRule   = MEMBER;
  users.viewRule   = MEMBER;
  users.createRule = DIR;                       // Director pre-registers team members
  users.updateRule = DIR;
  users.deleteRule = DIR + ' && id != @request.auth.id && role != "director"';
  users.manageRule = DIR;                       // Director may change email of a team member

  // Google sign-in only. pb_hooks/config.pb.js fills the Google client id/secret
  // from the environment on every start and may re-enable password auth for
  // local development (CRM_DEV_PASSWORD_AUTH=1).
  users.passwordAuth.enabled = String($os.getenv("CRM_DEV_PASSWORD_AUTH") || "") === "1";
  users.oauth2.enabled = true;
  users.authAlert.enabled = false;              // no SMTP configured; avoid "new device" mails

  app.save(users);

  // Relations to users are deliberately NOT required so that a user can be
  // removed from the team while their historical deals/reports stay (same as
  // the original app). The create rules still force owner = the caller.
  // ---- deals ---------------------------------------------------------------
  const deals = new Collection({
    type: "base",
    name: "deals",
    listRule:   MEMBER,
    viewRule:   MEMBER,
    createRule: MEMBER + ' && (' + DIR + ' || (' + SALES + ' && @request.body.owner = @request.auth.id))',
    updateRule: MEMBER + ' && (' + DIR + ' || (' + SALES + ' && owner = @request.auth.id && ' + OWNER_UNCHANGED + '))',
    deleteRule: MEMBER + ' && (' + DIR + ' || (' + SALES + ' && owner = @request.auth.id))',
    fields: [
      ...AUTODATES,
      { name: "title",       type: "text", required: true, max: 200 },
      { name: "company",     type: "text", max: 200 },
      { name: "owner",   type: "relation", required: false, collectionId: users.id, maxSelect: 1, cascadeDelete: false },
      { name: "month",       type: "text", required: true, min: 7, max: 7, pattern: "^\\d{4}-\\d{2}$" },
      { name: "product",     type: "number", min: 0 },
      { name: "install",     type: "number", min: 0 },
      { name: "cat",         type: "select", required: true, maxSelect: 1, values: ["won", "c100", "c80", "pending", "lost"] },
      { name: "note",        type: "text", max: 1000 },
      { name: "closedMonth", type: "text", max: 7 },
      { name: "act",         type: "json", maxSize: 200000 },   // activity log [{t,by,txt}]
      { name: "files",       type: "file", maxSelect: 10, maxSize: 10485760, protected: true,
        mimeTypes: [
          "application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif",
          "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          "text/plain", "text/csv", "application/zip",
        ] },
    ],
    indexes: [
      "CREATE INDEX idx_deals_owner ON deals (owner)",
      "CREATE INDEX idx_deals_month ON deals (month)",
    ],
  });
  app.save(deals);

  // ---- reports (weekly customer-visit log) ---------------------------------
  const reports = new Collection({
    type: "base",
    name: "reports",
    listRule:   MEMBER + ' && (' + VIEWALL + ' || owner = @request.auth.id)',
    viewRule:   MEMBER + ' && (' + VIEWALL + ' || owner = @request.auth.id)',
    createRule: MEMBER + ' && ' + WRITER + ' && @request.body.owner = @request.auth.id',
    updateRule: MEMBER + ' && ' + WRITER + ' && owner = @request.auth.id && ' + OWNER_UNCHANGED,
    deleteRule: MEMBER + ' && ' + WRITER + ' && owner = @request.auth.id',
    fields: [
      ...AUTODATES,
      { name: "owner",   type: "relation", required: false, collectionId: users.id, maxSelect: 1, cascadeDelete: false },
      { name: "date",    type: "text", required: true, min: 10, max: 10, pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
      { name: "week",    type: "text", required: true, min: 10, max: 10, pattern: "^\\d{4}-\\d{2}-\\d{2}$" }, // Monday of the week
      { name: "company", type: "text", required: true, max: 200 },
      { name: "tel",     type: "text", max: 50 },
      { name: "office",  type: "text", max: 200 },
      { name: "project", type: "text", max: 200 },
      { name: "sqm",     type: "text", max: 50 },
      { name: "detail",  type: "text", max: 5000 },
      { name: "photos",  type: "file", maxSelect: 10, maxSize: 5242880, protected: true,
        mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
        thumbs: ["200x200f", "800x0"] },
    ],
    indexes: [
      "CREATE INDEX idx_reports_week ON reports (week)",
      "CREATE INDEX idx_reports_owner_week ON reports (owner, week)",
    ],
  });
  app.save(reports);

  // ---- rcomments (manager comments on report rows) -------------------------
  const rcomments = new Collection({
    type: "base",
    name: "rcomments",
    listRule:   MEMBER + ' && (' + VIEWALL + ' || owner = @request.auth.id)',
    viewRule:   MEMBER + ' && (' + VIEWALL + ' || owner = @request.auth.id)',
    createRule: MEMBER + ' && ' + VIEWALL + ' && @request.body.byId = @request.auth.id',
    updateRule: null,   // locked (superuser only)
    deleteRule: null,
    fields: [
      ...AUTODATES,
      { name: "report", type: "relation", required: true, collectionId: reports.id, maxSelect: 1, cascadeDelete: true },
      { name: "owner",   type: "relation", required: false, collectionId: users.id, maxSelect: 1, cascadeDelete: false }, // report owner (for the read rule)
      { name: "week",   type: "text", required: true, min: 10, max: 10 },
      { name: "by",     type: "text", required: true, max: 100 },
      { name: "byId",   type: "relation", required: false, collectionId: users.id, maxSelect: 1, cascadeDelete: false },
      { name: "txt",    type: "text", required: true, max: 2000 },
    ],
    indexes: [
      "CREATE INDEX idx_rcomments_report ON rcomments (report)",
      "CREATE INDEX idx_rcomments_week ON rcomments (week)",
    ],
  });
  app.save(rcomments);

  // ---- plans (one row per user per day) ------------------------------------
  const plans = new Collection({
    type: "base",
    name: "plans",
    listRule:   MEMBER + ' && (' + VIEWALL + ' || owner = @request.auth.id)',
    viewRule:   MEMBER + ' && (' + VIEWALL + ' || owner = @request.auth.id)',
    createRule: MEMBER + ' && ' + WRITER + ' && @request.body.owner = @request.auth.id',
    updateRule: MEMBER + ' && ' + WRITER + ' && owner = @request.auth.id && ' + OWNER_UNCHANGED,
    deleteRule: MEMBER + ' && ' + WRITER + ' && owner = @request.auth.id',
    fields: [
      ...AUTODATES,
      { name: "owner",   type: "relation", required: false, collectionId: users.id, maxSelect: 1, cascadeDelete: false },
      { name: "date",  type: "text", required: true, min: 10, max: 10, pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
      { name: "month", type: "text", required: true, min: 7, max: 7, pattern: "^\\d{4}-\\d{2}$" },
      { name: "lines", type: "text", required: true, max: 5000 },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_plans_owner_date ON plans (owner, date)",
      "CREATE INDEX idx_plans_owner_month ON plans (owner, month)",
    ],
  });
  app.save(plans);

  // ---- specrep (Sales Spec Report) -----------------------------------------
  const specrep = new Collection({
    type: "base",
    name: "specrep",
    listRule:   MEMBER,
    viewRule:   MEMBER,
    createRule: MEMBER + ' && @request.auth.role = "spec"',
    updateRule: MEMBER + ' && @request.auth.role = "spec"',
    deleteRule: MEMBER + ' && @request.auth.role = "spec"',
    fields: [
      ...AUTODATES,
      { name: "date",    type: "text", max: 10 },
      { name: "company", type: "text", required: true, max: 200 },
      { name: "project", type: "text", max: 200 },
      { name: "status",  type: "select", maxSelect: 1, values: ["Follow", "Pending", "Final"] },
      { name: "plan",    type: "text", max: 20 },   // month name of planned site visit
      { name: "owner",   type: "text", max: 100 },  // free-text project owner (as in the original)
      { name: "sqm",     type: "number", min: 0 },
      { name: "pcs",     type: "number", min: 0 },
      { name: "product", type: "text", max: 200 },
      { name: "dprod",   type: "text", max: 50 },
      { name: "dinst",   type: "text", max: 50 },
      { name: "by",      type: "text", max: 100 },
    ],
  });
  app.save(specrep);
}, (app) => {
  for (const name of ["specrep", "plans", "rcomments", "reports", "deals"]) {
    try { app.delete(app.findCollectionByNameOrId(name)); } catch (_) {}
  }
  const users = app.findCollectionByNameOrId("users");
  for (const f of ["role", "team", "quota"]) {
    try { users.fields.removeByName(f); } catch (_) {}
  }
  users.listRule = users.viewRule = "id = @request.auth.id";
  users.createRule = users.updateRule = users.deleteRule = "";
  users.manageRule = null;
  users.passwordAuth.enabled = true;
  app.save(users);
});
