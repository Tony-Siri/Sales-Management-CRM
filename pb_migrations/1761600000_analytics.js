/// <reference path="../pb_data/types.d.ts" />
//
// Analytics extension (audit phases A–D, approved 2026-10-27).
// Additive only: new collections + optional fields on existing ones.
//
//   crm_settings     single row of tunables (forecast probability, stale days, teams, lists)
//   customers        customer master (C1) – deals/reports/specrep get an optional relation
//   deal_events      structured status history (B2) – written by pb_hooks/analytics.pb.js
//   deal_snapshots   month-end pipeline snapshots (B1) – written by cron / Director route
//   quotas           monthly targets per user or per team (B3, D3)
//   v_won_monthly    view: closed-won per owner per month (D1)
//   v_customer_totals view: won / pipeline / deal count per customer (D1)

migrate((app) => {
  const MEMBER = '@request.auth.id != "" && @request.auth.role != ""';
  const DIR    = '@request.auth.role = "director"';
  const WRITER = '(@request.auth.role = "rep" || @request.auth.role = "am" || @request.auth.role = "spec")';
  const AUTODATES = [
    { name: "created", type: "autodate", onCreate: true, onUpdate: false },
    { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
  ];

  const users   = app.findCollectionByNameOrId("users");
  const deals   = app.findCollectionByNameOrId("deals");
  const reports = app.findCollectionByNameOrId("reports");
  const specrep = app.findCollectionByNameOrId("specrep");

  // ---- crm_settings ------------------------------------------------------
  const settings = new Collection({
    type: "base",
    name: "crm_settings",
    listRule: MEMBER, viewRule: MEMBER,
    createRule: null, updateRule: DIR, deleteRule: null,
    fields: [
      ...AUTODATES,
      { name: "pendingProb",  type: "number", min: 0, max: 100 },
      { name: "staleDays",    type: "number", min: 1, max: 365 },
      { name: "teams",        type: "json", maxSize: 20000 },
      { name: "productLines", type: "json", maxSize: 20000 },
      { name: "lostReasons",  type: "json", maxSize: 20000 },
    ],
  });
  app.save(settings);
  const row = new Record(settings);
  row.set("pendingProb", 30);
  row.set("staleDays", 14);
  row.set("teams", ["PJ-BKK", "PJ-PKT"]);
  row.set("productLines", ["ฝ้า", "ผนัง", "พื้น", "อื่นๆ"]);
  row.set("lostReasons", ["ราคาสูงกว่าคู่แข่ง", "ลูกค้าเลื่อน/ยกเลิกโครงการ", "สเปคไม่ตรง", "ระยะเวลาส่งมอบ", "ความสัมพันธ์กับผู้ขายรายอื่น", "อื่นๆ"]);
  app.save(row);

  // ---- customers ---------------------------------------------------------
  const customers = new Collection({
    type: "base",
    name: "customers",
    listRule: MEMBER, viewRule: MEMBER,
    createRule: MEMBER + ' && (' + WRITER + ' || ' + DIR + ')',
    updateRule: MEMBER + ' && (' + DIR + ' || createdBy = @request.auth.id)',
    deleteRule: MEMBER + ' && ' + DIR,
    fields: [
      ...AUTODATES,
      { name: "name",      type: "text", required: true, max: 200 },
      { name: "nameKey",   type: "text", max: 200 },   // set by hook (normalised name)
      { name: "province",  type: "text", max: 100 },
      { name: "type",      type: "select", maxSelect: 1, values: ["owner", "contractor", "designer", "dealer", "other"] },
      { name: "phone",     type: "text", max: 50 },
      { name: "note",      type: "text", max: 2000 },
      { name: "createdBy", type: "relation", collectionId: users.id, maxSelect: 1, cascadeDelete: false },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_customers_namekey ON customers (nameKey) WHERE nameKey != ''",
      "CREATE INDEX idx_customers_province ON customers (province)",
    ],
  });
  app.save(customers);

  // ---- optional fields on existing collections ---------------------------
  deals.fields.add(new RelationField({ name: "customer", collectionId: customers.id, maxSelect: 1, cascadeDelete: false }));
  deals.fields.add(new TextField({ name: "expectedClose", max: 10, pattern: "^(\\d{4}-\\d{2}-\\d{2})?$" }));
  deals.fields.add(new TextField({ name: "lostReason", max: 200 }));
  deals.fields.add(new TextField({ name: "productLine", max: 100 }));
  deals.fields.add(new TextField({ name: "province", max: 100 }));
  deals.indexes.push("CREATE INDEX idx_deals_customer ON deals (customer)");
  deals.indexes.push("CREATE INDEX idx_deals_closed ON deals (closedMonth)");
  app.save(deals);

  reports.fields.add(new RelationField({ name: "customer", collectionId: customers.id, maxSelect: 1, cascadeDelete: false }));
  reports.fields.add(new SelectField({ name: "visitType", maxSelect: 1, values: ["visit", "call", "survey", "online", "other"] }));
  reports.fields.add(new SelectField({ name: "outcome", maxSelect: 1, values: ["interested", "quote", "followup", "won", "lost", "none"] }));
  reports.indexes.push("CREATE INDEX idx_reports_customer ON reports (customer)");
  reports.indexes.push("CREATE INDEX idx_reports_date ON reports (date)");
  app.save(reports);

  specrep.fields.add(new RelationField({ name: "customer", collectionId: customers.id, maxSelect: 1, cascadeDelete: false }));
  specrep.indexes.push("CREATE INDEX idx_specrep_customer ON specrep (customer)");
  app.save(specrep);

  // ---- deal_events (status history) --------------------------------------
  const events = new Collection({
    type: "base",
    name: "deal_events",
    listRule: MEMBER, viewRule: MEMBER,
    createRule: null, updateRule: null, deleteRule: null,   // written by hooks only
    fields: [
      ...AUTODATES,
      { name: "deal",  type: "relation", required: true, collectionId: deals.id, maxSelect: 1, cascadeDelete: true },
      { name: "owner", type: "relation", collectionId: users.id, maxSelect: 1, cascadeDelete: false },
      { name: "from",  type: "text", max: 20 },
      { name: "to",    type: "text", max: 20 },
      { name: "value", type: "number" },
      { name: "by",    type: "text", max: 100 },
      { name: "byId",  type: "relation", collectionId: users.id, maxSelect: 1, cascadeDelete: false },
    ],
    indexes: [
      "CREATE INDEX idx_events_deal ON deal_events (deal, created)",
      "CREATE INDEX idx_events_created ON deal_events (created)",
    ],
  });
  app.save(events);

  // ---- deal_snapshots (month-end pipeline) -------------------------------
  const snaps = new Collection({
    type: "base",
    name: "deal_snapshots",
    listRule: MEMBER, viewRule: MEMBER,
    createRule: null, updateRule: null, deleteRule: null,   // cron / Director route only
    fields: [
      ...AUTODATES,
      { name: "month",    type: "text", required: true, min: 7, max: 7, pattern: "^\\d{4}-\\d{2}$" },
      { name: "deal",     type: "relation", required: true, collectionId: deals.id, maxSelect: 1, cascadeDelete: true },
      { name: "owner",    type: "relation", collectionId: users.id, maxSelect: 1, cascadeDelete: false },
      { name: "team",     type: "text", max: 50 },
      { name: "cat",      type: "text", max: 20 },
      { name: "product",  type: "number" },
      { name: "install",  type: "number" },
      { name: "value",    type: "number" },
      { name: "customer", type: "relation", collectionId: customers.id, maxSelect: 1, cascadeDelete: false },
      { name: "source",   type: "text", max: 20 },   // live | reconstructed
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_snaps_month_deal ON deal_snapshots (month, deal)",
      "CREATE INDEX idx_snaps_month ON deal_snapshots (month)",
    ],
  });
  app.save(snaps);

  // ---- quotas (monthly targets per user or per team) ---------------------
  const quotas = new Collection({
    type: "base",
    name: "quotas",
    listRule: MEMBER, viewRule: MEMBER,
    createRule: MEMBER + ' && ' + DIR,
    updateRule: MEMBER + ' && ' + DIR,
    deleteRule: MEMBER + ' && ' + DIR,
    fields: [
      ...AUTODATES,
      { name: "user",   type: "relation", collectionId: users.id, maxSelect: 1, cascadeDelete: true },
      { name: "team",   type: "text", max: 50 },
      { name: "month",  type: "text", required: true, min: 7, max: 7, pattern: "^\\d{4}-\\d{2}$" },
      { name: "amount", type: "number", min: 0 },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_quotas_key ON quotas (user, team, month)",
      "CREATE INDEX idx_quotas_month ON quotas (month)",
    ],
  });
  app.save(quotas);

  // ---- views (server-side aggregates) ------------------------------------
  const vWon = new Collection({
    type: "view",
    name: "v_won_monthly",
    listRule: MEMBER, viewRule: MEMBER,
    viewQuery:
      "SELECT (d.owner || '_' || d.closedMonth) AS id, d.owner AS owner, d.closedMonth AS month, " +
      "SUM(d.product + d.install) AS won, COUNT(d.id) AS n " +
      "FROM deals d WHERE d.cat = 'won' AND d.closedMonth != '' GROUP BY d.owner, d.closedMonth",
  });
  app.save(vWon);

  const vCust = new Collection({
    type: "view",
    name: "v_customer_totals",
    listRule: MEMBER, viewRule: MEMBER,
    viewQuery:
      "SELECT c.id AS id, c.name AS name, c.province AS province, " +
      "COALESCE(SUM(CASE WHEN d.cat = 'won' THEN d.product + d.install ELSE 0 END), 0) AS won, " +
      "COALESCE(SUM(CASE WHEN d.cat IN ('c100','c80','pending') THEN d.product + d.install ELSE 0 END), 0) AS pipeline, " +
      "COUNT(d.id) AS deals, " +
      "COALESCE(MAX(CASE WHEN d.cat = 'won' THEN d.closedMonth ELSE '' END), '') AS lastWon " +
      "FROM customers c LEFT JOIN deals d ON d.customer = c.id GROUP BY c.id",
  });
  app.save(vCust);
}, (app) => {
  for (const name of ["v_customer_totals", "v_won_monthly", "quotas", "deal_snapshots", "deal_events"]) {
    try { app.delete(app.findCollectionByNameOrId(name)); } catch (_) {}
  }
  for (const [col, fields] of [
    ["deals", ["customer", "expectedClose", "lostReason", "productLine", "province"]],
    ["reports", ["customer", "visitType", "outcome"]],
    ["specrep", ["customer"]],
  ]) {
    try {
      const c = app.findCollectionByNameOrId(col);
      for (const f of fields) c.fields.removeByName(f);
      c.indexes = c.indexes.filter((i) => !/idx_(deals_customer|deals_closed|reports_customer|reports_date|specrep_customer)/.test(i));
      app.save(c);
    } catch (_) {}
  }
  for (const name of ["customers", "crm_settings"]) {
    try { app.delete(app.findCollectionByNameOrId(name)); } catch (_) {}
  }
});
