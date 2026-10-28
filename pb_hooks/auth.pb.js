/// <reference path="../pb_data/types.d.ts" />
//
// Google sign-in gating for the "users" auth collection.
//
// Rules:
//  1. A Google account whose e-mail matches a user record that the Director
//     pre-registered on the "ทีมและเป้า" page is linked to that record.
//  2. If nobody is registered yet, OR the e-mail equals CRM_DIRECTOR_EMAIL
//     from .env, the account is created as Director (replaces the old
//     "ตั้งค่าครั้งแรก (Director)" screen and the config/setup marker).
//  3. Any other Google account is rejected and no record is created, so people
//     outside the team can never read data (same guarantee as the old
//     Firestore `member()` rule).

onRecordAuthWithOAuth2Request((e) => {
  const email = String((e.oAuth2User && e.oAuth2User.email) || "").trim().toLowerCase();
  if (!email) {
    throw new BadRequestError("บัญชี Google นี้ไม่ได้ส่งอีเมลมาให้ ระบบไม่สามารถยืนยันตัวตนได้");
  }

  let createdHere = false;
  if (!e.record) {
    // (1) link to a pre-registered record with the same e-mail
    let existing = null;
    try { existing = e.app.findAuthRecordByEmail("users", email); } catch (_) { existing = null; }

    if (existing) {
      e.record = existing;
      e.isNewRecord = false;
    } else {
      // (2) bootstrap the Director
      const total = e.app.countRecords("users");
      const bootstrapEmail = String($os.getenv("CRM_DIRECTOR_EMAIL") || "").trim().toLowerCase();
      const isBootstrap = total === 0 || (bootstrapEmail !== "" && email === bootstrapEmail);

      if (!isBootstrap) {
        // (3) not on the team list
        throw new BadRequestError("บัญชีนี้ยังไม่ได้ลงทะเบียนในทีม ติดต่อ Director");
      }

      const users = e.app.findCollectionByNameOrId("users");
      const rec = new Record(users);
      rec.setEmail(email);
      rec.setEmailVisibility(true);
      rec.setVerified(true);
      rec.setRandomPassword();            // password auth is disabled; value is never used
      rec.set("name", String((e.oAuth2User && e.oAuth2User.name) || email.split("@")[0]));
      rec.set("role", "director");
      rec.set("quota", 0);
      e.app.save(rec);
      e.record = rec;
      createdHere = true;
    }
  }

  // PocketBase pre-matches a verified e-mail itself, so e.record may already be
  // set here. If the record was previously linked to a *different* account of
  // the same provider (e.g. the Director re-pointed the e-mail to a new Google
  // account), drop the stale link so PocketBase can store the new one.
  if (e.record && !createdHere) {
    const providerId = String((e.oAuth2User && e.oAuth2User.id) || "");
    const links = e.app.findAllExternalAuthsByRecord(e.record) || [];
    for (let i = 0; i < links.length; i++) {
      const l = links[i];
      if (l && l.provider() === e.providerName && l.providerId() !== providerId) {
        e.app.delete(l);
      }
    }
  }

  // keep a record's e-mail readable by the team (Team page shows it)
  if (!e.record.emailVisibility()) {
    e.record.setEmailVisibility(true);
    e.app.save(e.record);
  }

  e.next();
}, "users");

// Records created by the Director through the app/API: normalise the e-mail,
// make it visible to the team, and refuse a second Director via the API.
onRecordCreateRequest((e) => {
  const email = String(e.record.email() || "").trim().toLowerCase();
  if (!email) throw new BadRequestError("กรอกอีเมล Google ของผู้ใช้");
  e.record.setEmail(email);
  e.record.setEmailVisibility(true);
  if (e.record.get("role") === "director" && !e.hasSuperuserAuth()) {
    throw new BadRequestError("ไม่สามารถสร้าง Director เพิ่มผ่านหน้าเว็บได้");
  }
  e.next();
}, "users");

// Nobody may demote/rename the Director role through the API except a superuser.
onRecordUpdateRequest((e) => {
  const before = e.record.original();
  if (before.get("role") === "director" && e.record.get("role") !== "director" && !e.hasSuperuserAuth()) {
    throw new BadRequestError("ไม่สามารถเปลี่ยนตำแหน่งของ Director ได้");
  }
  if (before.get("role") !== "director" && e.record.get("role") === "director" && !e.hasSuperuserAuth()) {
    throw new BadRequestError("ไม่สามารถเลื่อนตำแหน่งเป็น Director ผ่านหน้าเว็บได้");
  }
  e.next();
}, "users");
