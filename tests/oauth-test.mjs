// End-to-end test of pb_hooks/auth.pb.js using a mock OpenID Connect provider.
// PocketBase's generic "oidc" provider is pointed at this mock; the hook logic
// (link by e-mail / bootstrap director / reject strangers) is identical for Google.
//
// Usage: node oauth-test.mjs http://127.0.0.1:8090 admin@local.test adminpass123
import http from 'node:http';
import PocketBase from 'pocketbase';

const [BASE, SU_EMAIL, SU_PASS] = process.argv.slice(2);
const MOCK_PORT = 9977;
const MOCK = `http://127.0.0.1:${MOCK_PORT}`;
let pass = 0, fail = 0;
const ok = (n, c, x = '') => { if (c) { pass++; console.log('  PASS', n); } else { fail++; console.log('  FAIL', n, x); } };

// ---- mock OIDC provider: the authorization "code" IS the e-mail to return ----
const tokens = new Map();
const mock = http.createServer((req, res) => {
  let body = '';
  req.on('data', (d) => body += d);
  req.on('end', () => {
    const u = new URL(req.url, MOCK);
    if (u.pathname === '/token') {
      const p = new URLSearchParams(body);
      const code = p.get('code');
      const at = 'at_' + Math.random().toString(36).slice(2);
      tokens.set(at, code);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ access_token: at, token_type: 'Bearer', expires_in: 3600 }));
    } else if (u.pathname === '/userinfo') {
      const at = (req.headers.authorization || '').replace('Bearer ', '');
      const email = tokens.get(at);
      res.setHeader('Content-Type', 'application/json');
      if (!email) { res.statusCode = 401; res.end('{}'); return; }
      res.end(JSON.stringify({ sub: 'sub-' + email, email, email_verified: true, name: 'Name of ' + email.split('@')[0] }));
    } else { res.statusCode = 404; res.end(); }
  });
});
await new Promise((r) => mock.listen(MOCK_PORT, '127.0.0.1', r));

const su = new PocketBase(BASE); su.autoCancellation(false);
await su.collection('_superusers').authWithPassword(SU_EMAIL, SU_PASS);
const users = await su.collections.getOne('users');
const origProviders = users.oauth2.providers;
await su.collections.update('users', { oauth2: { enabled: true, providers: [...origProviders.filter((p) => p.name !== 'oidc'), {
  name: 'oidc', clientId: 'mock', clientSecret: 'mock-secret', authURL: MOCK + '/auth', tokenURL: MOCK + '/token', userInfoURL: MOCK + '/userinfo', displayName: 'Mock', pkce: false,
}] } });

const signIn = async (email) => {
  const c = new PocketBase(BASE); c.autoCancellation(false);
  const am = await c.collection('users').listAuthMethods();
  const prov = am.oauth2.providers.find((p) => p.name === 'oidc');
  const r = await c.collection('users').authWithOAuth2Code('oidc', email, prov.codeVerifier, BASE + '/api/oauth2-redirect');
  return { c, rec: r.record, meta: r.meta };
};
const expectReject = async (name, email) => { try { await signIn(email); ok(name, false, 'signed in'); } catch (e) { ok(name, e.status === 400, 'status ' + e.status + ' ' + JSON.stringify(e.response)); } };

// snapshot & clean state
const all = await su.collection('users').getFullList();
console.log('== link by e-mail ==');
const r1 = await signIn('rep1@local.test');
ok('pre-registered rep1 links to existing record', r1.rec.email === 'rep1@local.test' && r1.rec.role === 'rep' && all.some((u) => u.id === r1.rec.id));
ok('linked account can read deals', (await r1.c.collection('deals').getFullList()).length >= 0);
const r1b = await signIn('REP1@Local.Test');
ok('e-mail match is case-insensitive', r1b.rec.id === r1.rec.id);
const r1c = await signIn('rep1@local.test');
ok('second sign-in reuses the external auth link', r1c.rec.id === r1.rec.id);

console.log('== strangers rejected ==');
await expectReject('unknown Google account is rejected', 'stranger@example.com');
ok('no record created for stranger', !(await su.collection('users').getFullList()).some((u) => u.email === 'stranger@example.com'));
const countBefore = (await su.collection('users').getFullList()).length;

console.log('== director bootstrap via CRM_DIRECTOR_EMAIL ==');
// local server runs with CRM_DIRECTOR_EMAIL=director@local.test; that record already exists -> links
const d = await signIn('director@local.test');
ok('director e-mail links to existing director', d.rec.role === 'director');
// simulate a fresh install: delete the director record, sign in again -> recreated as director by the hook
await su.collection('users').delete(d.rec.id);
const d2 = await signIn('director@local.test');
ok('CRM_DIRECTOR_EMAIL creates a director when missing', d2.rec.role === 'director' && d2.rec.emailVisibility === true && d2.rec.verified === true);
ok('director name taken from provider', d2.rec.name === 'Name of director');
ok('record count unchanged otherwise', (await su.collection('users').getFullList()).length === countBefore);

console.log('== first user on an empty install becomes director ==');
const snapshot = await su.collection('users').getFullList();
for (const u of snapshot) await su.collection('users').delete(u.id);           // empty install
const f = await signIn('first@example.com');
ok('first ever sign-in becomes director', f.rec.role === 'director');
await expectReject('second stranger still rejected', 'second@example.com');
await su.collection('users').delete(f.rec.id);

// restore users (new ids; dependent test data was already cleaned by rules-test)
const PW = 'testpass123!';
for (const u of snapshot) await su.collection('users').create({ email: u.email, emailVisibility: true, password: PW, passwordConfirm: PW, name: u.name, role: u.role, team: u.team, quota: u.quota, verified: true });
await su.collections.update('users', { oauth2: { enabled: true, providers: origProviders } });
mock.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
