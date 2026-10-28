/// <reference path="../pb_data/types.d.ts" />
//
// Production application settings. Secrets are NOT set here; see pb_hooks/config.pb.js
// which reads them from the environment on every start.

migrate((app) => {
  const s = app.settings();

  s.meta.appName = "SalesForce CRM";

  // PocketBase sits behind NGINX on the same host. NGINX sets X-Real-IP from
  // $remote_addr, which a client cannot spoof, so trust that header only.
  s.trustedProxy.headers = ["X-Real-IP"];
  s.trustedProxy.useLeftmostIP = false;

  // Built-in rate limiting for the public API (per client IP).
  s.rateLimits.enabled = true;
  s.rateLimits.rules = [
    { label: "*:auth",     maxRequests: 10,  duration: 60, audience: "" },  // sign-in attempts
    { label: "*:create",   maxRequests: 60,  duration: 60, audience: "" },
    { label: "/api/batch", maxRequests: 5,   duration: 10, audience: "" },
    { label: "/api/",      maxRequests: 400, duration: 10, audience: "" },
  ];

  // Nightly local backup (zip of pb_data incl. uploads) at 02:00 server time,
  // keep the last 7. deploy/backup-offsite.sh copies them off the server.
  s.backups.cron = "0 2 * * *";
  s.backups.cronMaxKeep = 7;

  // Keep log retention modest.
  s.logs.maxDays = 14;

  app.save(s);
}, (app) => {
  const s = app.settings();
  s.rateLimits.enabled = false;
  s.backups.cron = "";
  app.save(s);
});
