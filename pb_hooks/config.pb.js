/// <reference path="../pb_data/types.d.ts" />
//
// Applies environment-driven configuration on every start (see lib/crm_config.js)
// so that secrets live only in .env, never in migrations or git.

onBootstrap((e) => {
  e.next();
  try {
    require(`${__hooks}/lib/crm_config.js`)(e.app);
  } catch (err) { console.log("[crm] env config failed: " + err); }
});

