// Outbound notifications (D4). Every channel is optional and stays inactive
// until its environment variables are set:
//
//   LINE Messaging API: NOTIFY_LINE_TOKEN (channel access token), NOTIFY_LINE_TO (userId/groupId)
//   E-mail:             SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
//                       NOTIFY_EMAIL_TO (comma list; default = Director and Assistant Managers)

function env(k) { return String($os.getenv(k) || "").trim(); }

function channels() {
  return {
    line: !!(env("NOTIFY_LINE_TOKEN") && env("NOTIFY_LINE_TO")),
    email: !!env("SMTP_HOST"),
  };
}

function recipients(app) {
  const list = env("NOTIFY_EMAIL_TO");
  if (list) return list.split(",").map((s) => s.trim()).filter(Boolean);
  const out = [];
  app.findAllRecords("users").forEach((u) => {
    if (["director", "am"].indexOf(u.get("role")) >= 0 && u.email()) out.push(u.email());
  });
  return out;
}

// Branded HTML body for the digest e-mail: table layout and inline styles for
// mail clients; the logo is loaded from the public app URL when one is set.
function digestHtml(text, appURL) {
  const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const url = esc(String(appURL || "").trim().replace(/\/+$/, ""));
  const head = url
    ? "<img src=\"" + url + "/brand/nara-logo.png\" width=\"96\" height=\"96\" alt=\"NARA CRM\" style=\"display:block;border:0\">"
    : "<div style=\"font:600 20px sans-serif;letter-spacing:4px;color:#1A1A1A\">NARA CRM</div>";
  return "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#f3f5fa;padding:24px 0\"><tr><td align=\"center\">" +
    "<table role=\"presentation\" width=\"600\" cellpadding=\"0\" cellspacing=\"0\" style=\"max-width:600px;width:100%;background:#ffffff;border-radius:12px;border-top:4px solid #F1BD48\">" +
    "<tr><td align=\"center\" style=\"padding:20px 24px 8px\">" + head + "</td></tr>" +
    "<tr><td style=\"padding:8px 24px 20px\"><pre style=\"font-family:sans-serif;font-size:14px;line-height:1.6;color:#1b2433;white-space:pre-wrap;margin:0\">" + esc(text) + "</pre></td></tr>" +
    (url ? "<tr><td style=\"padding:0 24px 24px\"><a href=\"" + url + "\" style=\"display:inline-block;background:#2f6fed;color:#ffffff;text-decoration:none;font:600 14px sans-serif;padding:10px 18px;border-radius:8px\">เปิด NARA CRM</a></td></tr>" : "") +
    "</table></td></tr></table>";
}

function send(app, text) {
  const ch = channels();
  const res = { line: "disabled", email: "disabled" };

  if (ch.line) {
    try {
      const r = $http.send({
        method: "POST",
        url: "https://api.line.me/v2/bot/message/push",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + env("NOTIFY_LINE_TOKEN") },
        body: JSON.stringify({ to: env("NOTIFY_LINE_TO"), messages: [{ type: "text", text: text.slice(0, 4900) }] }),
        timeout: 20,
      });
      res.line = r.statusCode === 200 ? "sent" : "error " + r.statusCode + " " + toString(r.body).slice(0, 200);
    } catch (err) { res.line = "error " + err; }
  }

  if (ch.email) {
    try {
      const to = recipients(app);
      if (!to.length) { res.email = "no recipients"; }
      else {
        const s = app.settings();
        app.newMailClient().send(new MailerMessage({
          from: { address: s.meta.senderAddress, name: s.meta.senderName },
          to: to.map((a) => ({ address: a })),
          subject: "NARA CRM – สรุปประจำสัปดาห์",
          html: digestHtml(text, s.meta.appURL),
          text: text,
        }));
        res.email = "sent to " + to.length;
      }
    } catch (err) { res.email = "error " + err; }
  }
  return res;
}

module.exports = { channels, send, digestHtml };
