// Shared server-side analytics helpers (loaded with require() from pb_hooks).
//
// Time zone: PocketBase stores timestamps in UTC. Month boundaries are
// computed in the business time zone given by CRM_UTC_OFFSET_HOURS (default 7,
// Thailand), so "October" means October in Bangkok, not in UTC.

const OPEN = ["c100", "c80", "pending"];
const CLOSED = ["won", "lost"];

function offsetHours() {
  const v = parseFloat(String($os.getenv("CRM_UTC_OFFSET_HOURS") || "7"));
  return isNaN(v) ? 7 : v;
}

// "YYYY-MM" of a JS Date in business time
function monthOf(date) {
  const t = new Date(date.getTime() + offsetHours() * 3600000);
  return t.getUTCFullYear() + "-" + String(t.getUTCMonth() + 1).padStart(2, "0");
}

// UTC instant of the first moment AFTER business month `m` ("YYYY-MM")
function monthEndUTC(m) {
  const y = parseInt(m.slice(0, 4), 10), mo = parseInt(m.slice(5, 7), 10);
  return new Date(Date.UTC(y, mo, 1) - offsetHours() * 3600000);
}

// PocketBase datetime string ("2026-10-27 06:34:21.835Z") -> JS Date
function pbDate(s) {
  return new Date(String(s || "").replace(" ", "T"));
}

// PocketBase datetime string for SQL comparisons
function pbStr(d) {
  return d.toISOString().replace("T", " ");
}

// Same normalisation as the front-end normKey(): lower case, collapse spaces,
// drop common Thai/English company affixes so "บริษัท เอบีซี จำกัด" == "เอบีซี".
function normKey(name) {
  let s = String(name || "").toLowerCase().trim();
  s = s.replace(/\(มหาชน\)|มหาชน|บริษัท|บจก\.?|บมจ\.?|หจก\.?|ห้างหุ้นส่วนจำกัด|จำกัด|co\.?,?\s*ltd\.?|company limited|limited|ltd\.?|inc\.?|corp\.?|plc\.?/g, " ");
  s = s.replace(/[.,()\-_/"'`]+/g, " ").replace(/\s+/g, " ").trim();
  return s;
}

function val(r) {
  return (Number(r.get("product")) || 0) + (Number(r.get("install")) || 0);
}

// Status of a deal as of the end of month `m`, reconstructed from deal_events.
// Returns { cat, closedMonth } or null when the deal did not exist yet.
function statusAsOf(app, deal, m) {
  const end = monthEndUTC(m);
  if (pbDate(deal.get("created")) >= end) return null;
  let evs = [];
  try {
    evs = app.findRecordsByFilter("deal_events", "deal = {:d} && created < {:end}", "-created", 1, 0,
      { d: deal.id, end: pbStr(end) });
  } catch (_) { evs = []; }
  if (evs.length) {
    const ev = evs[0];
    const cat = ev.get("to");
    return { cat: cat, closedMonth: CLOSED.indexOf(cat) >= 0 ? monthOf(pbDate(ev.get("created"))) : "" };
  }
  // no event before month end: either the deal pre-dates event tracking (use
  // current status) or its first event is later (use that event's "from").
  let first = [];
  try {
    first = app.findRecordsByFilter("deal_events", "deal = {:d}", "+created", 1, 0, { d: deal.id });
  } catch (_) { first = []; }
  if (first.length && first[0].get("from")) {
    const cat = first[0].get("from");
    return { cat: cat, closedMonth: CLOSED.indexOf(cat) >= 0 ? (deal.get("closedMonth") || deal.get("month")) : "" };
  }
  return { cat: deal.get("cat"), closedMonth: deal.get("closedMonth") || "" };
}

// Is a deal in the month-`m` pipeline? Mirrors inM() in public/app.js.
function inMonth(cat, closedMonth, dealMonth, m) {
  if (CLOSED.indexOf(cat) >= 0) return (closedMonth || dealMonth) === m;
  return m >= dealMonth;
}

// Upsert deal_snapshots for month `m`. live=true uses the current status
// (used for the running month); otherwise status is reconstructed.
// Returns { written, unchanged, removed }.
function snapshotMonth(app, m, live) {
  const col = app.findCollectionByNameOrId("deal_snapshots");
  const userTeam = {};
  app.findAllRecords("users").forEach((u) => { userTeam[u.id] = u.get("team") || ""; });
  const keep = {};
  let written = 0, unchanged = 0, removed = 0;

  app.findAllRecords("deals").forEach((d) => {
    let st;
    if (live) st = { cat: d.get("cat"), closedMonth: d.get("closedMonth") || "" };
    else st = statusAsOf(app, d, m);
    if (!st || !inMonth(st.cat, st.closedMonth, d.get("month"), m)) return;
    keep[d.id] = true;

    let rec = null;
    try { rec = app.findFirstRecordByFilter("deal_snapshots", "month = {:m} && deal = {:d}", { m: m, d: d.id }); } catch (_) { rec = null; }
    const data = {
      month: m, deal: d.id, owner: d.get("owner") || "", team: userTeam[d.get("owner")] || "",
      cat: st.cat, product: Number(d.get("product")) || 0, install: Number(d.get("install")) || 0,
      value: val(d), customer: d.get("customer") || "", source: live ? "live" : "reconstructed",
    };
    if (rec) {
      let same = true;
      for (const k in data) if (String(rec.get(k)) !== String(data[k])) { same = false; break; }
      if (same) { unchanged++; return; }
    } else {
      rec = new Record(col);
    }
    for (const k in data) rec.set(k, data[k]);
    app.save(rec);
    written++;
  });

  // remove rows of deals that are no longer part of that month
  app.findRecordsByFilter("deal_snapshots", "month = {:m}", "", 0, 0, { m: m }).forEach((r) => {
    if (!keep[r.get("deal")]) { app.delete(r); removed++; }
  });
  return { written: written, unchanged: unchanged, removed: removed };
}

function settingsRow(app) {
  try {
    const rows = app.findRecordsByFilter("crm_settings", "", "+created", 1, 0);
    if (rows.length) return rows[0];
  } catch (_) {}
  return null;
}

function staleDays(app) {
  const s = settingsRow(app);
  const v = s ? Number(s.get("staleDays")) : 0;
  return v > 0 ? v : 14;
}

// Data-health report (D2). Small data set -> plain JS over all records.
function health(app) {
  const now = new Date();
  const stale = staleDays(app);
  const users = {};
  app.findAllRecords("users").forEach((u) => { users[u.id] = u; });
  const deals = app.findAllRecords("deals");

  const dupMap = {};
  const out = { duplicates: [], zeroValue: [], stale: [], noOwner: [], usersNoTeam: [], unlinked: { deals: 0, reports: 0, specrep: 0 }, staleDays: stale };

  deals.forEach((d) => {
    const key = normKey(d.get("company")) + "|" + String(d.get("title") || "").toLowerCase().trim();
    (dupMap[key] = dupMap[key] || []).push(d);
    const brief = { id: d.id, title: d.get("title"), company: d.get("company"), owner: d.get("owner"), cat: d.get("cat"), value: val(d) };
    if (val(d) === 0 && d.get("cat") !== "lost") out.zeroValue.push(brief);
    if (!d.get("owner") || !users[d.get("owner")]) out.noOwner.push(brief);
    if (OPEN.indexOf(d.get("cat")) >= 0) {
      const days = Math.floor((now - pbDate(d.get("updated"))) / 86400000);
      if (days >= stale) { brief.days = days; out.stale.push(brief); }
    }
    if (!d.get("customer")) out.unlinked.deals++;
  });
  for (const k in dupMap) {
    if (dupMap[k].length > 1) out.duplicates.push(dupMap[k].map((d) => ({ id: d.id, title: d.get("title"), company: d.get("company"), owner: d.get("owner"), cat: d.get("cat") })));
  }
  for (const id in users) {
    const u = users[id];
    if (["rep", "am", "spec"].indexOf(u.get("role")) >= 0 && !u.get("team")) out.usersNoTeam.push({ id: id, name: u.get("name"), role: u.get("role") });
  }
  try { out.unlinked.reports = app.countRecords("reports", $dbx.hashExp({ customer: "" })); } catch (_) {}
  try { out.unlinked.specrep = app.countRecords("specrep", $dbx.hashExp({ customer: "" })); } catch (_) {}
  out.stale.sort((a, b) => b.days - a.days);
  return out;
}

// Link every record whose free-text company matches `key` to customer `cid`.
function linkCustomer(app, cid, key) {
  let n = 0;
  app.runInTransaction((tx) => {
    [["deals", "company"], ["reports", "company"], ["specrep", "company"]].forEach(([col, field]) => {
      tx.findRecordsByFilter(col, "customer = ''", "", 0, 0).forEach((r) => {
        if (normKey(r.get(field)) === key) { r.set("customer", cid); tx.saveNoValidate(r); n++; }
      });
    });
  });
  return n;
}

// Weekly digest text (D4)
function digest(app) {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const h = health(app);
  let won = 0, wonN = 0;
  try {
    app.findRecordsByFilter("deal_events", "to = 'won' && created >= {:t}", "", 0, 0, { t: pbStr(weekAgo) }).forEach((e) => { won += Number(e.get("value")) || 0; wonN++; });
  } catch (_) {}
  let uncommented = 0;
  try {
    const reps = app.findRecordsByFilter("reports", "created >= {:t}", "", 0, 0, { t: pbStr(weekAgo) });
    reps.forEach((r) => {
      if (app.countRecords("rcomments", $dbx.hashExp({ report: r.id })) === 0) uncommented++;
    });
  } catch (_) {}
  // the embedded JS engine has no locale support -> manual thousands separator
  const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const lines = [
    "NARA CRM – สรุปประจำสัปดาห์",
    "ปิดขายได้ 7 วันที่ผ่านมา: " + wonN + " ดีล ฿" + fmt(won),
    "ดีลค้างนานเกิน " + h.staleDays + " วัน: " + h.stale.length + " ดีล",
  ];
  h.stale.slice(0, 10).forEach((d) => lines.push("  • " + d.title + " (" + (d.company || "-") + ") " + d.days + " วัน ฿" + fmt(d.value)));
  lines.push("รายงานเข้าพบที่ยังไม่มี comment (7 วัน): " + uncommented + " รายการ");
  if (h.duplicates.length) lines.push("ดีลที่อาจซ้ำ: " + h.duplicates.length + " กลุ่ม");
  return lines.join("\n");
}

module.exports = {
  OPEN, CLOSED, monthOf, monthEndUTC, pbDate, pbStr, normKey, val,
  statusAsOf, inMonth, snapshotMonth, settingsRow, staleDays, health, linkCustomer, digest,
};
