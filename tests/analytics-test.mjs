// Analytics backend tests: customers, quotas, settings, deal_events, snapshots,
// views and the /api/crm/* routes. Run rules-test.mjs first (it seeds users).
// Usage: node analytics-test.mjs http://127.0.0.1:8090 admin@local.test adminpass123
import PocketBase from 'pocketbase';

const [BASE, SU_EMAIL, SU_PASS] = process.argv.slice(2);
const PW = 'testpass123!';
let pass = 0, fail = 0;
const ok = (n, c, x = '') => { if (c) { pass++; console.log('  PASS', n); } else { fail++; console.log('  FAIL', n, x); } };
const expectOk = async (n, fn) => { try { const r = await fn(); ok(n, true); return r; } catch (e) { ok(n, false, e.status + ' ' + JSON.stringify(e?.response)); } };
const expectFail = async (n, fn, status) => { try { await fn(); ok(n, false, 'unexpectedly succeeded'); } catch (e) { ok(n, !status || e.status === status, 'status ' + e.status + ' ' + (e?.response?.message || '')); } };

const su = new PocketBase(BASE); su.autoCancellation(false);
await su.collection('_superusers').authWithPassword(SU_EMAIL, SU_PASS);
// sign-in is rate limited (10/min per IP, see settings migration) -> wait and retry on 429
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const as = async (email) => { const c = new PocketBase(BASE); c.autoCancellation(false); for (let i = 0; ; i++) { try { await c.collection('users').authWithPassword(email, PW); return c; } catch (e) { if (e.status !== 429 || i > 12) throw e; await sleep(6000); } } };
const D = await as('director@local.test'), R1 = await as('rep1@local.test'), R2 = await as('rep2@local.test'),
  SP = await as('spec@local.test'), V = await as('viewer@local.test'), N = await as('norole@local.test');
const id = async (email) => (await su.collection('users').getFirstListItem(`email = "${email}"`)).id;
const ids = { rep1: await id('rep1@local.test'), rep2: await id('rep2@local.test'), spec: await id('spec@local.test'), director: await id('director@local.test') };
const thisMonth = (() => { const t = new Date(Date.now() + 7 * 3600e3); return t.getUTCFullYear() + '-' + String(t.getUTCMonth() + 1).padStart(2, '0'); })();
const prevMonth = (() => { const [y, m] = thisMonth.split('-').map(Number); const t = new Date(Date.UTC(y, m - 2, 1)); return t.getUTCFullYear() + '-' + String(t.getUTCMonth() + 1).padStart(2, '0'); })();
const api = (c, path, opts = {}) => c.send(path, opts);
const created = { deals: [], customers: [], quotas: [], reports: [] };

// remove fixtures left behind by an aborted earlier run
for (const k of ['เอบีซี คอนสตรัคชั่น', 'forge co', 'acme']) {
  for (const r of await su.collection('customers').getFullList({ filter: `nameKey = "${k}"` })) await su.collection('customers').delete(r.id).catch(() => {});
}
for (const r of await su.collection('quotas').getFullList({ filter: `month = "${thisMonth}" && (user = "${ids.rep1}" || team = "PJ-BKK")` })) await su.collection('quotas').delete(r.id).catch(() => {});
for (const r of await su.collection('deals').getFullList({ filter: `title = "Tower A" || title = "Mall B" || title = "Hotel C" || title = "hotel c"` })) await su.collection('deals').delete(r.id).catch(() => {});
for (const r of await su.collection('reports').getFullList({ filter: `company = "ACME CO LTD"` })) await su.collection('reports').delete(r.id).catch(() => {});

console.log('== crm_settings ==');
const st = (await V.collection('crm_settings').getFullList())[0];
ok('settings row readable by viewer with defaults', st && st.pendingProb === 30 && st.staleDays === 14 && st.teams.length === 2);
await expectFail('rep cannot change settings', () => R1.collection('crm_settings').update(st.id, { pendingProb: 99 }), 404);
await expectFail('nobody creates a second settings row', () => D.collection('crm_settings').create({ pendingProb: 1 }), 403);
await expectOk('director updates settings', () => D.collection('crm_settings').update(st.id, { pendingProb: 30, staleDays: 14 }));
ok('norole cannot read settings', (await N.collection('crm_settings').getFullList()).length === 0);

console.log('== customers ==');
const c1 = await expectOk('rep1 creates customer', () => R1.collection('customers').create({ name: '  บริษัท เอบีซี คอนสตรัคชั่น จำกัด ', province: 'กรุงเทพฯ', type: 'contractor' }));
if (c1) created.customers.push(c1.id);
ok('name trimmed, nameKey normalised, createdBy = rep1', c1 && c1.name === 'บริษัท เอบีซี คอนสตรัคชั่น จำกัด' && c1.nameKey === 'เอบีซี คอนสตรัคชั่น' && c1.createdBy === ids.rep1, JSON.stringify(c1));
await expectFail('duplicate by normalised name rejected', () => R2.collection('customers').create({ name: 'เอบีซี คอนสตรัคชั่น' }), 400);
await expectFail('viewer cannot create customer', () => V.collection('customers').create({ name: 'Viewer Co' }), 400);
await expectFail('createdBy cannot be forged', async () => {
  const r = await R2.collection('customers').create({ name: 'Forge Co', createdBy: ids.rep1 }); created.customers.push(r.id);
  if (r.createdBy !== ids.rep2) throw new Error('forged'); throw Object.assign(new Error('ok'), { status: 0 });
}, 0);
await expectFail('rep2 cannot edit rep1 customer', () => R2.collection('customers').update(c1.id, { phone: '1' }), 404);
await expectOk('rep1 edits own customer', () => R1.collection('customers').update(c1.id, { phone: '02-000-0000' }));
await expectOk('director edits any customer', () => D.collection('customers').update(c1.id, { note: 'key account' }));
await expectFail('rep1 cannot reassign createdBy', async () => {
  const r = await R1.collection('customers').update(c1.id, { createdBy: ids.rep2 });
  if (r.createdBy !== ids.rep1) throw new Error('changed'); throw Object.assign(new Error('ok'), { status: 0 });
}, 0);
await expectFail('rep cannot delete customer', () => R1.collection('customers').delete(c1.id), 404);

console.log('== quotas ==');
const q1 = await expectOk('director sets monthly quota', () => D.collection('quotas').create({ user: ids.rep1, month: thisMonth, amount: 400000 }));
if (q1) created.quotas.push(q1.id);
const q2 = await expectOk('director sets team quota', () => D.collection('quotas').create({ team: 'PJ-BKK', month: thisMonth, amount: 1200000 }));
if (q2) created.quotas.push(q2.id);
await expectFail('duplicate quota (user, month) rejected', () => D.collection('quotas').create({ user: ids.rep1, month: thisMonth, amount: 1 }), 400);
await expectFail('rep cannot set quota', () => R1.collection('quotas').create({ user: ids.rep1, month: prevMonth, amount: 1 }), 400);
ok('viewer reads quotas', (await V.collection('quotas').getFullList()).length >= 2);

console.log('== deal_events ==');
const d1 = await expectOk('rep1 creates deal linked to customer', () => R1.collection('deals').create({ title: 'Tower A', company: 'ABC', owner: ids.rep1, month: thisMonth, product: 100000, install: 20000, cat: 'c80', act: [], customer: c1.id, expectedClose: thisMonth + '-28', productLine: 'ฝ้า' }));
created.deals.push(d1.id);
let ev = await su.collection('deal_events').getFullList({ filter: `deal = "${d1.id}"`, sort: '+created' });
ok('create event "" -> c80 with actor', ev.length === 1 && ev[0].from === '' && ev[0].to === 'c80' && ev[0].byId === ids.rep1 && ev[0].value === 120000, JSON.stringify(ev));
await R1.collection('deals').update(d1.id, { note: 'no status change' });
ev = await su.collection('deal_events').getFullList({ filter: `deal = "${d1.id}"` });
ok('non-status update writes no event', ev.length === 1);
await R1.collection('deals').update(d1.id, { cat: 'c100' });
await D.collection('deals').update(d1.id, { cat: 'won', closedMonth: thisMonth });
ev = await su.collection('deal_events').getFullList({ filter: `deal = "${d1.id}"`, sort: '+created' });
ok('status changes recorded in order with actor', ev.length === 3 && ev[1].from === 'c80' && ev[1].to === 'c100' && ev[2].to === 'won' && ev[2].byId === ids.director, JSON.stringify(ev.map(e => [e.from, e.to, e.byId])));
ok('viewer can read events', (await V.collection('deal_events').getFullList({ filter: `deal = "${d1.id}"` })).length === 3);
await expectFail('client cannot write events', () => D.collection('deal_events').create({ deal: d1.id, from: 'x', to: 'won' }), 403);
const dLost = await R2.collection('deals').create({ title: 'Mall B', company: 'acme co., ltd.', owner: ids.rep2, month: thisMonth, product: 50000, cat: 'pending', act: [] });
created.deals.push(dLost.id);
await R2.collection('deals').update(dLost.id, { cat: 'lost', closedMonth: thisMonth, lostReason: 'ราคาสูงกว่าคู่แข่ง' });
const dOpen = await R2.collection('deals').create({ title: 'Hotel C', company: 'ACME', owner: ids.rep2, month: thisMonth, product: 0, cat: 'c80', act: [] });
created.deals.push(dOpen.id);

console.log('== views ==');
const vw = await V.collection('v_won_monthly').getFullList({ filter: `owner = "${ids.rep1}" && month = "${thisMonth}"` });
ok('v_won_monthly has rep1 won total', vw.length === 1 && vw[0].won >= 120000 && vw[0].n >= 1, JSON.stringify(vw));
const vc = await V.collection('v_customer_totals').getOne(c1.id);
ok('v_customer_totals for linked customer', vc.won === 120000 && vc.deals === 1 && vc.lastWon === thisMonth, JSON.stringify(vc));
ok('norole cannot read views', (await N.collection('v_won_monthly').getFullList()).length === 0);

console.log('== snapshots ==');
await expectFail('rep cannot run snapshot', () => api(R1, `/api/crm/snapshot/${thisMonth}`, { method: 'POST' }), 403);
await expectFail('future month rejected', () => api(D, '/api/crm/snapshot/2999-01', { method: 'POST' }), 400);
await expectFail('bad month rejected', () => api(D, '/api/crm/snapshot/2026-1', { method: 'POST' }), 400);
const s1 = await expectOk('director snapshots current month (live)', () => api(D, `/api/crm/snapshot/${thisMonth}`, { method: 'POST' }));
ok('live snapshot wrote rows', s1 && s1.source === 'live' && s1.result.written >= 3, JSON.stringify(s1));
const s1b = await api(D, `/api/crm/snapshot/${thisMonth}`, { method: 'POST' });
ok('re-run is idempotent', s1b.result.written === 0 && s1b.result.unchanged >= 3, JSON.stringify(s1b));
const snaps = await V.collection('deal_snapshots').getFullList({ filter: `month = "${thisMonth}"` });
const sd1 = snaps.find(s => s.deal === d1.id);
ok('snapshot row carries status, value, team, customer', sd1 && sd1.cat === 'won' && sd1.value === 120000 && sd1.customer === c1.id && sd1.team === 'PJ-BKK', JSON.stringify(sd1));
const sp = await expectOk('director snapshots previous month (reconstructed)', () => api(D, `/api/crm/snapshot/${prevMonth}`, { method: 'POST' }));
const prevRows = await V.collection('deal_snapshots').getFullList({ filter: `month = "${prevMonth}" && (deal = "${d1.id}" || deal = "${dLost.id}")` });
ok('deals created this month are absent from previous month', sp && sp.source === 'reconstructed' && prevRows.length === 0);
await expectFail('client cannot write snapshots', () => D.collection('deal_snapshots').create({ month: thisMonth, deal: d1.id }), 403);

console.log('== health ==');
const h = await expectOk('rep can read data health', () => api(R1, '/api/crm/health'));
ok('zero-value open deal flagged', h && h.zeroValue.some(x => x.id === dOpen.id));
ok('unlinked counts present', h && h.unlinked.deals >= 2);
await expectFail('norole cannot read health', () => api(N, '/api/crm/health'), 403);
const dup = await R2.collection('deals').create({ title: 'hotel c', company: 'Acme Co., Ltd.', owner: ids.rep2, month: thisMonth, product: 1, cat: 'c80', act: [] });
created.deals.push(dup.id);
const h2 = await api(D, '/api/crm/health');
ok('normalised duplicate detected', h2.duplicates.some(g => g.some(x => x.id === dup.id) && g.some(x => x.id === dOpen.id)), JSON.stringify(h2.duplicates));

console.log('== link-customer (merge) ==');
const rp = await R2.collection('reports').create({ owner: ids.rep2, date: thisMonth + '-05', week: thisMonth + '-05', company: 'ACME CO LTD', detail: 'x' });
created.reports.push(rp.id);
const acme = await D.collection('customers').create({ name: 'Acme' });
created.customers.push(acme.id);
await expectFail('rep cannot merge', () => api(R1, '/api/crm/link-customer', { method: 'POST', body: { customer: acme.id, company: 'acme' } }), 403);
const lk = await expectOk('director links all "acme" spellings', () => api(D, '/api/crm/link-customer', { method: 'POST', body: { customer: acme.id, company: 'ACME' } }));
ok('linked deals and report', lk && lk.linked === 4, JSON.stringify(lk));
ok('report now has customer', (await su.collection('reports').getOne(rp.id)).customer === acme.id);
await expectFail('unknown customer -> 404', () => api(D, '/api/crm/link-customer', { method: 'POST', body: { customer: 'nope12345678901', company: 'x' } }), 404);

console.log('== digest ==');
const dg = await expectOk('director previews digest', () => api(D, '/api/crm/digest'));
ok('digest text and channels', dg && dg.text.includes('สรุปประจำสัปดาห์') && dg.channels.line === false && dg.channels.email === false, JSON.stringify(dg));
await expectFail('rep cannot preview digest', () => api(R1, '/api/crm/digest'), 403);
const ds = await api(D, '/api/crm/digest/send', { method: 'POST' });
ok('send with no channels configured is a no-op', ds.line === 'disabled' && ds.email === 'disabled');

console.log('== cleanup ==');
for (const x of created.reports) await su.collection('reports').delete(x).catch(() => {});
for (const x of created.deals) await su.collection('deals').delete(x).catch(() => {});
for (const x of created.quotas) await su.collection('quotas').delete(x).catch(() => {});
for (const x of created.customers) await su.collection('customers').delete(x).catch(() => {});
ok('snapshots/events cascade with deals', (await su.collection('deal_snapshots').getFullList({ filter: `deal = "${d1.id}"` })).length === 0 && (await su.collection('deal_events').getFullList({ filter: `deal = "${d1.id}"` })).length === 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
