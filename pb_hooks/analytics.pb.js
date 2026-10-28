/// <reference path="../pb_data/types.d.ts" />
//
// Analytics hooks (see pb_hooks/lib/analytics.js for the helpers).
//
//  - deal_events: one row per status change (B2), written for API requests so
//    that the acting user is known.
//  - customers.nameKey: normalised name for de-duplication (C1).
//  - deal_snapshots: hourly upsert of the running month (B1); the last run of a
//    month freezes it. Director route backfills any past month from events.
//  - /api/crm/health (D2), /api/crm/link-customer (C1 merge), /api/crm/digest (D4 preview).

// ---- status history ---------------------------------------------------------
onRecordCreateRequest((e) => {
  e.next();
  try {
    const A = require(`${__hooks}/lib/analytics.js`);
    const col = e.app.findCollectionByNameOrId("deal_events");
    const ev = new Record(col);
    ev.set("deal", e.record.id);
    ev.set("owner", e.record.get("owner"));
    ev.set("from", "");
    ev.set("to", e.record.get("cat"));
    ev.set("value", A.val(e.record));
    ev.set("by", e.auth ? (e.auth.get("name") || e.auth.email()) : "system");
    if (e.auth && e.auth.collection().name === "users") ev.set("byId", e.auth.id);
    e.app.save(ev);
  } catch (err) { console.log("[crm] deal_events create failed: " + err); }
}, "deals");

onRecordUpdateRequest((e) => {
  const before = e.record.original().get("cat");
  e.next();
  try {
    const after = e.record.get("cat");
    if (before === after) return;
    const A = require(`${__hooks}/lib/analytics.js`);
    const col = e.app.findCollectionByNameOrId("deal_events");
    const ev = new Record(col);
    ev.set("deal", e.record.id);
    ev.set("owner", e.record.get("owner"));
    ev.set("from", before);
    ev.set("to", after);
    ev.set("value", A.val(e.record));
    ev.set("by", e.auth ? (e.auth.get("name") || e.auth.email()) : "system");
    if (e.auth && e.auth.collection().name === "users") ev.set("byId", e.auth.id);
    e.app.save(ev);
  } catch (err) { console.log("[crm] deal_events update failed: " + err); }
}, "deals");

// ---- customer name key + creator ------------------------------------------------
onRecordCreate((e) => {
  const A = require(`${__hooks}/lib/analytics.js`);
  e.record.set("name", String(e.record.get("name") || "").trim());
  e.record.set("nameKey", A.normKey(e.record.get("name")));
  e.next();
}, "customers");

onRecordUpdate((e) => {
  const A = require(`${__hooks}/lib/analytics.js`);
  e.record.set("name", String(e.record.get("name") || "").trim());
  e.record.set("nameKey", A.normKey(e.record.get("name")));
  e.next();
}, "customers");

onRecordCreateRequest((e) => {
  if (e.auth && e.auth.collection().name === "users") e.record.set("createdBy", e.auth.id);
  e.next();
}, "customers");

onRecordUpdateRequest((e) => {
  // createdBy is immutable through the API
  e.record.set("createdBy", e.record.original().get("createdBy"));
  e.next();
}, "customers");

// ---- snapshots ------------------------------------------------------------------
cronAdd("crm_pipeline_snapshot", "7 * * * *", () => {
  try {
    const A = require(`${__hooks}/lib/analytics.js`);
    const m = A.monthOf(new Date());
    const r = A.snapshotMonth($app, m, true);
    if (r.written || r.removed) console.log("[crm] snapshot " + m + ": " + JSON.stringify(r));
  } catch (err) { console.log("[crm] snapshot cron failed: " + err); }
});

// ---- Director / member API routes -----------------------------------------------
routerAdd("POST", "/api/crm/snapshot/{month}", (e) => {
  const role = (function (a) { return !a ? "" : a.collection().name === "_superusers" ? "director" : (a.get("role") || ""); })(e.auth);
  if (role !== "director") throw new ForbiddenError("Director only");
  const A = require(`${__hooks}/lib/analytics.js`);
  const m = e.request.pathValue("month");
  if (!/^\d{4}-\d{2}$/.test(m)) throw new BadRequestError("month must be YYYY-MM");
  const live = m === A.monthOf(new Date());
  if (m > A.monthOf(new Date())) throw new BadRequestError("future month");
  let res;
  e.app.runInTransaction((tx) => { res = A.snapshotMonth(tx, m, live); });
  return e.json(200, { month: m, source: live ? "live" : "reconstructed", result: res });
}, $apis.requireAuth("users", "_superusers"));

routerAdd("GET", "/api/crm/health", (e) => {
  const role = (function (a) { return !a ? "" : a.collection().name === "_superusers" ? "director" : (a.get("role") || ""); })(e.auth);
  if (!role) throw new ForbiddenError("team members only");
  const A = require(`${__hooks}/lib/analytics.js`);
  return e.json(200, A.health(e.app));
}, $apis.requireAuth("users", "_superusers"));

routerAdd("POST", "/api/crm/link-customer", (e) => {
  const role = (function (a) { return !a ? "" : a.collection().name === "_superusers" ? "director" : (a.get("role") || ""); })(e.auth);
  if (role !== "director") throw new ForbiddenError("Director only");
  const A = require(`${__hooks}/lib/analytics.js`);
  const body = e.requestInfo().body || {};
  const cid = String(body.customer || "");
  const key = A.normKey(body.company || "");
  if (!cid || !key) throw new BadRequestError("customer and company are required");
  e.app.findRecordById("customers", cid);   // 404 if missing
  const n = A.linkCustomer(e.app, cid, key);
  return e.json(200, { linked: n });
}, $apis.requireAuth("users", "_superusers"));

routerAdd("GET", "/api/crm/digest", (e) => {
  const role = (function (a) { return !a ? "" : a.collection().name === "_superusers" ? "director" : (a.get("role") || ""); })(e.auth);
  if (role !== "director") throw new ForbiddenError("Director only");
  const A = require(`${__hooks}/lib/analytics.js`);
  const N = require(`${__hooks}/lib/notify.js`);
  return e.json(200, { text: A.digest(e.app), channels: N.channels() });
}, $apis.requireAuth("users", "_superusers"));

routerAdd("POST", "/api/crm/digest/send", (e) => {
  const role = (function (a) { return !a ? "" : a.collection().name === "_superusers" ? "director" : (a.get("role") || ""); })(e.auth);
  if (role !== "director") throw new ForbiddenError("Director only");
  const A = require(`${__hooks}/lib/analytics.js`);
  const N = require(`${__hooks}/lib/notify.js`);
  return e.json(200, N.send(e.app, A.digest(e.app)));
}, $apis.requireAuth("users", "_superusers"));
