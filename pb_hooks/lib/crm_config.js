// Shared helper for pb_hooks/config.pb.js (PocketBase runs each hook handler in
// an isolated VM, so shared code has to be loaded with require()).
//
// Applies environment-driven configuration so that secrets live only in .env:
//   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET  -> users.oauth2.providers[google]
//   CRM_APP_URL                               -> settings.meta.appURL
//   CRM_DEV_PASSWORD_AUTH=1                   -> re-enables e-mail/password login (LOCAL DEV ONLY)

module.exports = function applyEnvConfig(app) {
  let users;
  try { users = app.findCollectionByNameOrId("users"); } catch (_) { return; } // first boot, before migrations

  let changed = false;

  const clientId = String($os.getenv("GOOGLE_CLIENT_ID") || "").trim();
  const clientSecret = String($os.getenv("GOOGLE_CLIENT_SECRET") || "").trim();
  if (clientId && clientSecret) {
    const current = users.oauth2.providers || [];
    let g = null;
    for (let i = 0; i < current.length; i++) if (current[i].name === "google") g = current[i];
    if (!g || g.clientId !== clientId || g.clientSecret !== clientSecret || !users.oauth2.enabled) {
      users.oauth2.enabled = true;
      users.oauth2.providers = [{ name: "google", clientId: clientId, clientSecret: clientSecret }];
      changed = true;
      console.log("[crm] Google OAuth2 provider configured from environment");
    }
  } else {
    console.log("[crm] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set: Google sign-in is NOT configured yet");
  }

  const devPassword = String($os.getenv("CRM_DEV_PASSWORD_AUTH") || "") === "1";
  if (users.passwordAuth.enabled !== devPassword) {
    users.passwordAuth.enabled = devPassword;
    changed = true;
  }
  if (devPassword) console.log("[crm] WARNING: CRM_DEV_PASSWORD_AUTH=1 -> password login enabled (development only)");

  if (changed) app.save(users);

  // optional SMTP (weekly digest e-mails)
  const smtpHost = String($os.getenv("SMTP_HOST") || "").trim();
  if (smtpHost) {
    const s = app.settings();
    const port = parseInt(String($os.getenv("SMTP_PORT") || "587"), 10) || 587;
    const user = String($os.getenv("SMTP_USER") || "");
    const pass = String($os.getenv("SMTP_PASS") || "");
    const from = String($os.getenv("SMTP_FROM") || user || "").trim();
    const want = { enabled: true, host: smtpHost, port: port, username: user, password: pass, tls: port === 465 };
    let dirty = !s.smtp.enabled || s.smtp.host !== want.host || s.smtp.port !== want.port ||
      s.smtp.username !== want.username || s.smtp.password !== want.password || s.smtp.tls !== want.tls;
    if (from && s.meta.senderAddress !== from) { s.meta.senderAddress = from; dirty = true; }
    if (s.meta.senderName !== "NARA CRM") { s.meta.senderName = "NARA CRM"; dirty = true; }
    if (dirty) {
      s.smtp.enabled = true; s.smtp.host = want.host; s.smtp.port = want.port;
      s.smtp.username = want.username; s.smtp.password = want.password; s.smtp.tls = want.tls;
      app.save(s);
      console.log("[crm] SMTP configured from environment (" + smtpHost + ":" + port + ")");
    }
  }

  const appURL = String($os.getenv("CRM_APP_URL") || "").trim();
  if (appURL) {
    const s = app.settings();
    if (s.meta.appURL !== appURL) {
      s.meta.appURL = appURL;
      app.save(s);
    }
  }

  // product name (the initial migration wrote the old name "SalesForce CRM")
  const sn = app.settings();
  if (sn.meta.appName !== "NARA CRM") {
    sn.meta.appName = "NARA CRM";
    app.save(sn);
  }
};
