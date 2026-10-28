// Demo data for a LOCAL dev server (never production): customers, deals across
// the last 6 months, status changes, quotas, this week's visits and plans.
// Requires the users created by rules-test.mjs (password testpass123!).
// Usage: node seed-demo.mjs http://127.0.0.1:8090 admin@local.test adminpass123
import PocketBase from 'pocketbase';

const [BASE, SU_EMAIL, SU_PASS] = process.argv.slice(2);
const PW = 'testpass123!';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const su = new PocketBase(BASE); su.autoCancellation(false);
await su.collection('_superusers').authWithPassword(SU_EMAIL, SU_PASS);
const as = async (email) => { const c = new PocketBase(BASE); c.autoCancellation(false); for (let i = 0; ; i++) { try { await c.collection('users').authWithPassword(email, PW); return c; } catch (e) { if (e.status !== 429 || i > 12) throw e; await sleep(6000); } } };
const uid = async (email) => (await su.collection('users').getFirstListItem(`email = "${email}"`)).id;

const pad = (n) => String(n).padStart(2, '0');
const now = new Date();
const mon = (o) => { const t = new Date(now.getFullYear(), now.getMonth() + o, 1); return t.getFullYear() + '-' + pad(t.getMonth() + 1); };
const ymd = (t) => t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate());
const monday = (() => { const t = new Date(now); t.setDate(t.getDate() - ((t.getDay() + 6) % 7)); return t; })();
const day = (i) => { const t = new Date(monday); t.setDate(t.getDate() + i); return ymd(t); };

const D = await as('director@local.test'), AM = await as('am@local.test'), R1 = await as('rep1@local.test'), R2 = await as('rep2@local.test'), SP = await as('spec@local.test');
const ids = { am: await uid('am@local.test'), rep1: await uid('rep1@local.test'), rep2: await uid('rep2@local.test'), spec: await uid('spec@local.test') };
await su.collection('users').update(ids.rep2, { team: 'PJ-PKT' });
await su.collection('users').update(ids.am, { team: 'PJ-BKK', quota: 500000 });
await su.collection('users').update(ids.rep1, { team: 'PJ-BKK', quota: 300000 });
await su.collection('users').update(ids.rep2, { quota: 350000 });

// customers
const CUS = [['บริษัท แสนสิริ จำกัด (มหาชน)', 'กรุงเทพฯ', 'owner'], ['บจก. ภูเก็ต รีสอร์ท', 'ภูเก็ต', 'owner'], ['ช.การช่าง', 'กรุงเทพฯ', 'contractor'],
  ['Design Studio 49', 'กรุงเทพฯ', 'designer'], ['โรงแรมกะตะ บีช', 'ภูเก็ต', 'owner'], ['หจก. ป่าตอง คอนสตรัคชั่น', 'ภูเก็ต', 'contractor']];
const cid = {};
for (const [name, province, type] of CUS) {
  try { cid[name] = (await R1.collection('customers').create({ name, province, type })).id; }
  catch { cid[name] = (await su.collection('customers').getFirstListItem(su.filter('nameKey != "" && name = {:n}', { n: name }))).id; }
}

// deals: [client, owner, title, customer, month offset, product, install, path of statuses, productLine, lostReason]
const DEALS = [
  [R1, 'rep1', 'คอนโด Ideo สาทร', 'บริษัท แสนสิริ จำกัด (มหาชน)', -5, 1200000, 150000, ['c80', 'c100', 'won'], 'ฝ้า'],
  [R1, 'rep1', 'สำนักงานใหญ่ ชั้น 12', 'ช.การช่าง', -4, 450000, 60000, ['c80', 'won'], 'ผนัง'],
  [R1, 'rep1', 'คลับเฮาส์ บางนา', 'บริษัท แสนสิริ จำกัด (มหาชน)', -3, 380000, 40000, ['pending', 'lost'], 'พื้น', 'ราคาสูงกว่าคู่แข่ง'],
  [R1, 'rep1', 'ห้องประชุม Design 49', 'Design Studio 49', -2, 210000, 25000, ['c80', 'c100', 'won'], 'ฝ้า'],
  [R1, 'rep1', 'อาคารจอดรถ', 'ช.การช่าง', -1, 900000, 120000, ['c80', 'c100'], 'พื้น'],
  [R1, 'rep1', 'ทาวน์โฮม ราชพฤกษ์', 'บริษัท แสนสิริ จำกัด (มหาชน)', 0, 650000, 80000, ['c80'], 'ผนัง'],
  [R1, 'rep1', 'โชว์รูม พระราม 9', 'Design Studio 49', 0, 0, 0, ['pending'], ''],
  [AM, 'am', 'โครงการ Siamese', 'ช.การช่าง', -4, 2000000, 300000, ['c80', 'c100', 'won'], 'ฝ้า'],
  [AM, 'am', 'ออฟฟิศ อโศก', 'Design Studio 49', -2, 520000, 70000, ['pending', 'c80', 'lost'], 'ผนัง', 'ลูกค้าเลื่อน/ยกเลิกโครงการ'],
  [AM, 'am', 'คอนโด ริมน้ำ', 'บริษัท แสนสิริ จำกัด (มหาชน)', -1, 1500000, 200000, ['c80', 'c100'], 'ฝ้า'],
  [AM, 'am', 'Lobby renovation', 'ช.การช่าง', 0, 300000, 30000, ['c100', 'won'], 'พื้น'],
  [R2, 'rep2', 'โรงแรมกะตะ เฟส 2', 'โรงแรมกะตะ บีช', -5, 1800000, 250000, ['c80', 'c100', 'won'], 'ฝ้า'],
  [R2, 'rep2', 'วิลล่า กมลา', 'บจก. ภูเก็ต รีสอร์ท', -3, 760000, 90000, ['c80', 'won'], 'ผนัง'],
  [R2, 'rep2', 'รีสอร์ท ราไวย์', 'บจก. ภูเก็ต รีสอร์ท', -2, 540000, 60000, ['pending', 'lost'], 'พื้น', 'ระยะเวลาส่งมอบ'],
  [R2, 'rep2', 'ร้านอาหาร ป่าตอง', 'หจก. ป่าตอง คอนสตรัคชั่น', -1, 280000, 30000, ['c80', 'c100', 'won'], 'ฝ้า'],
  [R2, 'rep2', 'คอนโด กะรน', 'หจก. ป่าตอง คอนสตรัคชั่น', 0, 990000, 110000, ['c80'], 'ผนัง'],
  [R2, 'rep2', 'โรงแรมกะตะ ล็อบบี้', 'โรงแรมกะตะ บีช', 0, 430000, 50000, ['pending'], 'พื้น'],
];
let nDeals = 0;
for (const [c, ow, title, cust, mo, product, install, path, productLine, lostReason] of DEALS) {
  const exists = await su.collection('deals').getList(1, 1, { filter: su.filter('title = {:t}', { t: title }) });
  if (exists.totalItems) continue;
  const m = mon(mo);
  const d = await c.collection('deals').create({ title, company: cust, customer: cid[cust], owner: ids[ow], month: m, product, install, cat: path[0], productLine, act: [], expectedClose: m + '-25' });
  for (const st of path.slice(1)) {
    await sleep(150);
    const closed = st === 'won' || st === 'lost';
    await c.collection('deals').update(d.id, { cat: st, closedMonth: closed ? m : '', lostReason: st === 'lost' ? lostReason : '' });
  }
  nDeals++;
}

// quotas for this month (override defaults) and a team target
for (const [u, amt] of [[ids.rep1, 400000], [ids.rep2, 380000]]) {
  try { await D.collection('quotas').create({ user: u, month: mon(0), amount: amt }); } catch {}
}
try { await D.collection('quotas').create({ team: 'PJ-PKT', month: mon(0), amount: 900000 }); } catch {}

// this week's visits and plans
const VIS = [
  [R1, 'rep1', 0, 'บริษัท แสนสิริ จำกัด (มหาชน)', 'visit', 'quote', 'นำเสนอตัวอย่างฝ้า ลูกค้าขอใบเสนอราคา'],
  [R1, 'rep1', 1, 'ช.การช่าง', 'survey', 'followup', 'สำรวจหน้างานอาคารจอดรถ'],
  [R1, 'rep1', 2, 'Design Studio 49', 'call', 'interested', 'โทรติดตามแบบโชว์รูม'],
  [R2, 'rep2', 0, 'โรงแรมกะตะ บีช', 'visit', 'interested', 'ประชุมกับฝ่ายจัดซื้อ'],
  [R2, 'rep2', 3, 'หจก. ป่าตอง คอนสตรัคชั่น', 'visit', 'quote', 'ลูกค้าต้องการราคาผนังกันเสียง'],
  [AM, 'am', 1, 'ช.การช่าง', 'online', 'followup', 'ประชุมออนไลน์เรื่อง Lobby'],
  [SP, 'spec', 2, 'Design Studio 49', 'visit', 'interested', 'ส่งสเปควัสดุให้ผู้ออกแบบ'],
];
let nVis = 0;
for (const [c, ow, di, cust, visitType, outcome, detail] of VIS) {
  const dt = day(di);
  const ex = await su.collection('reports').getList(1, 1, { filter: su.filter('owner = {:o} && date = {:d} && company = {:c}', { o: ids[ow], d: dt, c: cust }) });
  if (ex.totalItems) continue;
  await c.collection('reports').create({ owner: ids[ow], date: dt, week: day(0), company: cust, customer: cid[cust], visitType, outcome, detail, project: '' });
  nVis++;
}
const PLANS = [[R1, 'rep1', 0, 'แสนสิริ\nประชุมทีม'], [R1, 'rep1', 1, 'ช.การช่าง'], [R1, 'rep1', 3, 'ภูเก็ต รีสอร์ท'], [R2, 'rep2', 0, 'โรงแรมกะตะ บีช'], [R2, 'rep2', 3, 'ป่าตอง คอนสตรัคชั่น\nWFH']];
for (const [c, ow, di, lines] of PLANS) {
  const dt = day(di);
  try { await c.collection('plans').create({ owner: ids[ow], date: dt, month: dt.slice(0, 7), lines }); } catch {}
}
// one unlinked spelling variant to try the merge screen
const ex = await su.collection('deals').getList(1, 1, { filter: 'title = "ฝ้าห้องจัดเลี้ยง"' });
if (!ex.totalItems) await R2.collection('deals').create({ title: 'ฝ้าห้องจัดเลี้ยง', company: 'Kata Beach Hotel', owner: ids.rep2, month: mon(0), product: 150000, cat: 'c80', act: [] });
const ex2 = await su.collection('deals').getList(1, 1, { filter: 'title = "งานซ่อมฝ้า"' });
if (!ex2.totalItems) await R1.collection('deals').create({ title: 'งานซ่อมฝ้า', company: 'บริษัท ช.การช่าง จำกัด', owner: ids.rep1, month: mon(0), product: 90000, cat: 'pending', act: [] });

// snapshots: current month live
const snap = await D.send('/api/crm/snapshot/' + mon(0), { method: 'POST' });
console.log(`seeded: ${Object.keys(cid).length} customers, ${nDeals} new deals, ${nVis} visits; snapshot ${JSON.stringify(snap.result)}`);
