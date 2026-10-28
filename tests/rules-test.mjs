// Rule-enforcement test against a local PocketBase started with CRM_DEV_PASSWORD_AUTH=1.
// Usage: node rules-test.mjs http://127.0.0.1:8090 admin@local.test adminpass123
import PocketBase from 'pocketbase';

const [URL, SU_EMAIL, SU_PASS] = process.argv.slice(2);
const PW = 'testpass123!';
const USERS = [
  ['director', 'director@local.test', 'Director Test', 'director', '', 0],
  ['am',       'am@local.test',       'AM Test',       'am',       'PJ-BKK', 500000],
  ['rep1',     'rep1@local.test',     'Rep One',       'rep',      'PJ-BKK', 300000],
  ['rep2',     'rep2@local.test',     'Rep Two',       'rep',      'PJ-PKT', 300000],
  ['spec',     'spec@local.test',     'Spec Test',     'spec',     'PJ-BKK', 0],
  ['viewer',   'viewer@local.test',   'Management',    'viewer',   '', 0],
  ['norole',   'norole@local.test',   'No Role',       '',         '', 0],
];
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log('  PASS', name); } else { fail++; console.log('  FAIL', name, extra); } };
const expectOk = async (name, fn) => { try { const r = await fn(); ok(name, true); return r; } catch (e) { ok(name, false, e?.response?.message || e.message); } };
const expectFail = async (name, fn, status) => { try { await fn(); ok(name, false, 'unexpectedly succeeded'); } catch (e) { ok(name, !status || e.status === status, 'status ' + e.status + ' ' + (e?.response?.message || '')); } };

const su = new PocketBase(URL); su.autoCancellation(false);
await su.collection('_superusers').authWithPassword(SU_EMAIL, SU_PASS);

console.log('== seed users (superuser) ==');
const ids = {};
for (const [key, email, name, role, team, quota] of USERS) {
  let rec;
  try { rec = await su.collection('users').getFirstListItem(`email = "${email}"`); }
  catch { rec = await su.collection('users').create({ email, emailVisibility: true, password: PW, passwordConfirm: PW, name, role, team, quota, verified: true }); }
  ids[key] = rec.id;
}
console.log('  users:', Object.keys(ids).join(', '));

// sign-in is rate limited (10/min per IP) -> wait and retry on 429
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const as = async (key) => { const c = new PocketBase(URL); c.autoCancellation(false); for (let i = 0; ; i++) { try { await c.collection('users').authWithPassword(USERS.find(u => u[0] === key)[1], PW); return c; } catch (e) { if (e.status !== 429 || i > 12) throw e; await sleep(6000); } } };
const D = await as('director'), AM = await as('am'), R1 = await as('rep1'), R2 = await as('rep2'), SP = await as('spec'), V = await as('viewer'), N = await as('norole');

console.log('== users collection ==');
ok('norole sees no users', (await N.collection('users').getFullList()).length === 0);
ok('viewer sees all users', (await V.collection('users').getFullList()).length >= 6);
ok('rep sees emails (emailVisibility)', (await R1.collection('users').getFullList()).every(u => u.email));
await expectFail('rep cannot create user', () => R1.collection('users').create({ email: 'x@local.test', password: PW, passwordConfirm: PW, name: 'X', role: 'rep' }), 400);
await expectFail('am cannot update user', () => AM.collection('users').update(ids.rep1, { quota: 1 }), 404);
await expectOk('director updates quota', () => D.collection('users').update(ids.rep1, { quota: 300000 }));
await expectFail('director cannot create a 2nd director via API', () => D.collection('users').create({ email: 'd2@local.test', password: PW, passwordConfirm: PW, name: 'D2', role: 'director' }), 400);
await expectFail('director cannot demote director', () => D.collection('users').update(ids.director, { role: 'rep' }), 400);
await expectFail('director cannot delete self', () => D.collection('users').delete(ids.director), 404);
const tmp = await expectOk('director creates user (no password sent by app -> random)', () => D.collection('users').create({ email: 'tmp@local.test', emailVisibility: true, password: PW, passwordConfirm: PW, name: 'Tmp', role: 'viewer' }));
if (tmp) await expectOk('director deletes user', () => D.collection('users').delete(tmp.id));
await expectFail('director cannot create user with uppercase/whitespace email? (normalised)', async () => { const r = await D.collection('users').create({ email: '  MiXed@Local.Test ', emailVisibility: true, password: PW, passwordConfirm: PW, name: 'Mixed', role: 'viewer' }); if (r.email !== 'mixed@local.test') throw new Error('not normalised: ' + r.email); await D.collection('users').delete(r.id); throw Object.assign(new Error('normalised OK'), { status: 0 }); }, 0);

console.log('== deals ==');
const d1 = await expectOk('rep1 creates own deal', () => R1.collection('deals').create({ title: 'Deal R1', company: 'ACME', owner: ids.rep1, month: '2026-10', product: 1000, install: 200, cat: 'c80', act: [] }));
await expectFail('rep1 cannot create deal for rep2', () => R1.collection('deals').create({ title: 'Bad', owner: ids.rep2, month: '2026-10', cat: 'c80' }), 400);
await expectFail('spec cannot create deal', () => SP.collection('deals').create({ title: 'Bad', owner: ids.spec, month: '2026-10', cat: 'c80' }), 400);
await expectFail('viewer cannot create deal', () => V.collection('deals').create({ title: 'Bad', owner: ids.viewer, month: '2026-10', cat: 'c80' }), 400);
await expectFail('norole cannot list deals (locked out)', async () => { const l = await N.collection('deals').getFullList(); if (l.length === 0) throw Object.assign(new Error('empty'), { status: 0 }); }, 0);
ok('viewer can list deals', (await V.collection('deals').getFullList()).length >= 1);
await expectFail('rep2 cannot update rep1 deal', () => R2.collection('deals').update(d1.id, { note: 'hack' }), 404);
await expectFail('rep1 cannot reassign own deal to rep2', () => R1.collection('deals').update(d1.id, { owner: ids.rep2 }), 404);
await expectOk('rep1 updates own deal', () => R1.collection('deals').update(d1.id, { cat: 'won', closedMonth: '2026-10' }));
await expectOk('director reassigns deal to rep2', () => D.collection('deals').update(d1.id, { owner: ids.rep2 }));
await expectFail('rep1 cannot delete deal now owned by rep2', () => R1.collection('deals').delete(d1.id), 404);
await expectOk('rep2 deletes own deal', () => R2.collection('deals').delete(d1.id));
await expectFail('deal with bad month rejected', () => R1.collection('deals').create({ title: 'Bad', owner: ids.rep1, month: '10/2026', cat: 'c80' }), 400);

console.log('== reports / rcomments ==');
const rp = await expectOk('rep1 creates report', () => R1.collection('reports').create({ owner: ids.rep1, date: '2026-10-27', week: '2026-10-26', company: 'Cust A', detail: 'visit' }));
await expectFail('rep1 cannot create report for rep2', () => R1.collection('reports').create({ owner: ids.rep2, date: '2026-10-27', week: '2026-10-26', company: 'X' }), 400);
await expectFail('viewer cannot create report', () => V.collection('reports').create({ owner: ids.viewer, date: '2026-10-27', week: '2026-10-26', company: 'X' }), 400);
ok('rep2 cannot see rep1 report', !(await R2.collection('reports').getFullList()).some(x => x.id === rp.id));
ok('am sees rep1 report', (await AM.collection('reports').getFullList()).some(x => x.id === rp.id));
ok('viewer sees rep1 report', (await V.collection('reports').getFullList()).some(x => x.id === rp.id));
ok('director sees rep1 report', (await D.collection('reports').getFullList()).some(x => x.id === rp.id));
const cm = await expectOk('am comments on rep1 report', () => AM.collection('rcomments').create({ report: rp.id, owner: ids.rep1, week: '2026-10-26', by: 'AM Test', byId: ids.am, txt: 'good' }));
await expectFail('rep2 cannot comment', () => R2.collection('rcomments').create({ report: rp.id, owner: ids.rep1, week: '2026-10-26', by: 'Rep Two', byId: ids.rep2, txt: 'x' }), 400);
await expectFail('am cannot forge byId', () => AM.collection('rcomments').create({ report: rp.id, owner: ids.rep1, week: '2026-10-26', by: 'AM', byId: ids.director, txt: 'x' }), 400);
ok('rep1 sees comment on own report', (await R1.collection('rcomments').getFullList()).some(x => x.id === cm.id));
ok('rep2 cannot see comment', !(await R2.collection('rcomments').getFullList()).some(x => x.id === cm.id));
await expectFail('am cannot delete comment (locked)', () => AM.collection('rcomments').delete(cm.id), 403);
await expectFail('rep2 cannot update rep1 report', () => R2.collection('reports').update(rp.id, { detail: 'hack' }), 404);
await expectOk('rep1 updates own report', () => R1.collection('reports').update(rp.id, { detail: 'visit 2' }));

console.log('== plans ==');
const pl = await expectOk('spec creates plan', () => SP.collection('plans').create({ owner: ids.spec, date: '2026-10-28', month: '2026-10', lines: 'WFH' }));
await expectFail('duplicate plan (owner,date) rejected', () => SP.collection('plans').create({ owner: ids.spec, date: '2026-10-28', month: '2026-10', lines: 'dup' }), 400);
await expectFail('viewer cannot create plan', () => V.collection('plans').create({ owner: ids.viewer, date: '2026-10-28', month: '2026-10', lines: 'x' }), 400);
ok('viewer sees spec plan', (await V.collection('plans').getFullList()).some(x => x.id === pl.id));
ok('rep1 cannot see spec plan', !(await R1.collection('plans').getFullList()).some(x => x.id === pl.id));
await expectOk('spec deletes plan', () => SP.collection('plans').delete(pl.id));
// regression: removing two users who both had a plan on the same day
for (const e of ['tmpa@local.test', 'tmpb@local.test']) { try { const u = await su.collection('users').getFirstListItem(`email = "${e}"`); await su.collection('users').delete(u.id); } catch {} }
const tA = await su.collection('users').create({ email: 'tmpa@local.test', emailVisibility: true, password: PW, passwordConfirm: PW, name: 'Tmp A', role: 'rep', team: 'PJ-BKK', verified: true });
const tB = await su.collection('users').create({ email: 'tmpb@local.test', emailVisibility: true, password: PW, passwordConfirm: PW, name: 'Tmp B', role: 'rep', team: 'PJ-BKK', verified: true });
for (const t of [tA, tB]) await su.collection('plans').create({ owner: t.id, date: '2026-10-29', month: '2026-10', lines: 'x' });
await expectOk('director removes first user who had plans', () => D.collection('users').delete(tA.id));
await expectOk('director removes second user with a plan on the same day', () => D.collection('users').delete(tB.id));
for (const p of await su.collection('plans').getFullList({ filter: 'owner = "" && date = "2026-10-29"' })) await su.collection('plans').delete(p.id);

console.log('== specrep ==');
const sr = await expectOk('spec creates specrep row', () => SP.collection('specrep').create({ date: '2026-10-27', company: 'Spec Co', status: 'Follow' }));
await expectFail('rep cannot create specrep row', () => R1.collection('specrep').create({ company: 'X' }), 400);
await expectFail('director cannot edit specrep row', () => D.collection('specrep').update(sr.id, { status: 'Final' }), 404);
ok('rep can read specrep', (await R1.collection('specrep').getFullList()).some(x => x.id === sr.id));
await expectOk('spec updates row', () => SP.collection('specrep').update(sr.id, { status: 'Final' }));

console.log('== files ==');
const f1 = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a])], 'quote.pdf', { type: 'application/pdf' });
const d2 = await expectOk('rep1 creates deal with pdf', () => R1.collection('deals').create({ title: 'Deal Files', owner: ids.rep1, month: '2026-10', cat: 'c100', act: [], files: [f1] }));
ok('file stored', d2 && d2.files && d2.files.length === 1 && d2.files[0].startsWith('quote'));
await expectFail('exe upload rejected (mime)', () => R1.collection('deals').update(d2.id, { 'files+': [new File([new Uint8Array([0x4d, 0x5a, 0, 0])], 'virus.exe', { type: 'application/x-msdownload' })] }), 400);
const tok = await R2.files.getToken();
const url = R2.files.getURL(d2, d2.files[0], { token: tok });
const res = await fetch(url); ok('member can download protected file with token', res.status === 200, 'status ' + res.status);
const res2 = await fetch(R2.files.getURL(d2, d2.files[0])); ok('protected file without token denied', res2.status === 400 || res2.status === 403 || res2.status === 404, 'status ' + res2.status);
await expectOk('rep1 removes file', () => R1.collection('deals').update(d2.id, { 'files-': [d2.files[0]] }));
const png = new File([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), c => c.charCodeAt(0))], 'site.png', { type: 'image/png' });
const rp2 = await expectOk('rep1 attaches photo to report', () => R1.collection('reports').update(rp.id, { 'photos+': [png] }));
ok('photo stored', rp2 && rp2.photos && rp2.photos.length === 1);
const t2 = await AM.files.getToken();
const th = await fetch(AM.files.getURL(rp2, rp2.photos[0], { token: t2, thumb: '200x200f' })); ok('am can fetch thumbnail', th.status === 200, 'status ' + th.status);
await expectFail('report photo of wrong mime rejected', () => R1.collection('reports').update(rp.id, { 'photos+': [f1] }), 400);

console.log('== cleanup ==');
await su.collection('deals').delete(d2.id).catch(() => {});
await su.collection('reports').delete(rp.id).catch(() => {});
await su.collection('specrep').delete(sr.id).catch(() => {});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
