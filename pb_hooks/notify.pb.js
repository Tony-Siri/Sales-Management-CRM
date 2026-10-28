/// <reference path="../pb_data/types.d.ts" />
//
// Weekly digest (D4): Mondays 01:00 UTC = 08:00 Bangkok. Sends via LINE and/or
// e-mail when configured (see pb_hooks/lib/notify.js); otherwise does nothing.

cronAdd("crm_weekly_digest", "0 1 * * 1", () => {
  try {
    const N = require(`${__hooks}/lib/notify.js`);
    const ch = N.channels();
    if (!ch.line && !ch.email) return;
    const A = require(`${__hooks}/lib/analytics.js`);
    const r = N.send($app, A.digest($app));
    console.log("[crm] weekly digest: " + JSON.stringify(r));
  } catch (err) { console.log("[crm] weekly digest failed: " + err); }
});
