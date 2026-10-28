[English](README.en.md) | [ภาษาไทย](README.md)

# NARA CRM – ระบบ Commit ยอดขายทีม (Self-hosted)

เว็บแอปสำหรับทีมขาย ใช้ติดตามดีล Commit, รายงานประจำสัปดาห์ (พร้อมรูปภาพการเข้าพบลูกค้า),
แพลนเข้าพบลูกค้า, รายงาน Sales Spec และจัดการทีม/เป้าขาย

เวอร์ชันนี้ **ไม่ใช้ Firebase แล้ว** ระบบหลังบ้านคือ [PocketBase](https://pocketbase.io)
(ไบนารีเดียว + SQLite) ติดตั้งบน VPS ของคุณเอง (RunCloud + NGINX) เข้าสู่ระบบด้วย **บัญชี Google**
หน้าเว็บยังเป็นไฟล์ HTML/JS ล้วน ไม่มี build step และอัปเดตข้อมูลแบบ real-time เหมือนเดิม

## ฟีเจอร์

| หน้า | รายละเอียด |
|---|---|
| ภาพรวม | สรุปมูลค่าตามสถานะ แยกทีม PJ-BKK / PJ-PKT มีกราฟโดนัท แท่งซ้อนสี และยอดปิดขายเทียบเป้า (%) |
| Pipeline | Kanban 5 สถานะ ลากการ์ดเพื่อเปลี่ยนสถานะ |
| Commit | ตารางดีลทั้งหมด กรองตามทีม/เซลส์ ค้นหาได้ **แนบไฟล์เอกสารในดีลได้ (PDF, Word, Excel, รูป)** |
| รายงานประจำสัปดาห์ | บันทึกการเข้าพบลูกค้ารายวัน **แนบรูปภาพได้** ผู้บริหาร/Director เพิ่ม comment ต่อท้ายได้ |
| แพลนเข้าพบลูกค้า | ปฏิทินรายเดือน กรอกแผนรายวัน |
| Sales Spec Report | ตารางติดตามโครงการต่อเนื่อง กรอกได้เฉพาะ Sales Spec |
| วิเคราะห์ | แนวโน้ม 12 เดือนเทียบเป้า, Pipeline ณ สิ้นเดือน, Funnel, รอบการขาย, เหตุผลที่ปิดไม่ได้, กลุ่มสินค้า, การเข้าพบ, ตารางผลงานรายบุคคล |
| ลูกค้า | ฐานข้อมูลลูกค้า, หน้ารวมข้อมูลลูกค้า (ดีล การเข้าพบ รูป เอกสาร ไทม์ไลน์), รวมชื่อที่สะกดต่างกัน |
| สรุปสัปดาห์ | สรุปสำหรับผู้บริหาร พิมพ์ได้ ส่งทาง LINE/อีเมลได้ |
| ทีมและเป้า | Director เพิ่มผู้ใช้ด้วยอีเมล Google กำหนดตำแหน่ง ทีม เป้าตั้งต้นและเป้ารายเดือน, ตั้งค่าการวิเคราะห์, ตรวจสุขภาพข้อมูล |

ทุกหน้าตารางส่งออกเป็น CSV (เปิดด้วย Excel ได้) ภาพรวมแสดงยอดพยากรณ์ถ่วงน้ำหนักและดีลที่ค้างนาน รายละเอียดใน [docs/ANALYTICS.md](docs/ANALYTICS.md)

กติกาของดีล: Commit 100%, Commit 80%, รอลูกค้าพิจารณา จะยกยอดไปเดือนถัดไปเอง
ส่วน "ปิดขายแล้ว" และ "ปิดไม่ได้" จะตัดจบในเดือนที่ปิด

## สิทธิ์ตามตำแหน่ง

| ตำแหน่ง | ดีล | รายงานสัปดาห์ | แพลนเข้าพบ | Sales Spec Report | ทีมและเป้า |
|---|---|---|---|---|---|
| Director | ดู/แก้ทั้งหมด | ดูทุกคน + comment | ดูทุกคน | ดู | จัดการทั้งหมด |
| Assistant Manager | ดูทั้งหมด แก้เฉพาะของตัวเอง | กรอกของตัวเอง ดูทุกคน + comment | กรอกของตัวเอง ดูทุกคน | ดู | ดูอย่างเดียว |
| Sales | ดูทั้งหมด แก้เฉพาะของตัวเอง | ของตัวเองเท่านั้น | ของตัวเองเท่านั้น | ดู | ไม่เห็น |
| Sales Spec | ดูอย่างเดียว (ไม่มีเป้า) | ของตัวเองเท่านั้น | ของตัวเองเท่านั้น | กรอก/แก้ไข | ไม่เห็น |
| ผู้เยี่ยมชม | ดูอย่างเดียว | ดูทุกคน + comment | ดูทุกคน | ดู | ไม่เห็น |

สิทธิ์ถูกบังคับที่ฝั่งเซิร์ฟเวอร์ด้วย API rules ของ PocketBase (`pb_migrations/`) และ hooks (`pb_hooks/`)
บัญชี Google ที่ไม่ได้อยู่ในรายชื่อทีมจะเข้าสู่ระบบไม่ได้เลย

## การเข้าสู่ระบบ

- ใช้บัญชี Google เท่านั้น ไม่มีการเก็บรหัสผ่านบนเซิร์ฟเวอร์
- Director เพิ่มสมาชิกที่หน้า **ทีมและเป้า** โดยกรอกอีเมล Google ของคนนั้น เมื่อคนนั้นกด "เข้าสู่ระบบด้วย Google" ระบบจะจับคู่ด้วยอีเมลอัตโนมัติ
- บัญชี Director คนแรกกำหนดด้วย `CRM_DIRECTOR_EMAIL` ในไฟล์ `.env` (ถ้าไม่กำหนด คนแรกที่เข้าสู่ระบบจะเป็น Director)

## โครงสร้างโปรเจกต์

```
public/            หน้าเว็บ (index.html, app.js, vendor/pocketbase.es.mjs)
pb_migrations/     โครงสร้างฐานข้อมูล + rules + settings (รันอัตโนมัติตอนสตาร์ท)
pb_hooks/          ตรรกะฝั่งเซิร์ฟเวอร์: กรองการล็อกอิน Google, ตั้งค่าจาก .env
deploy/            สคริปต์ติดตั้ง/อัปเดต, systemd unit, NGINX config สำหรับ RunCloud, backup
tests/             ชุดทดสอบ rules และการล็อกอิน (รันกับเซิร์ฟเวอร์ทดสอบเท่านั้น)
docs/              คู่มือทั้งหมด (ด้านล่าง)
.env.example       ตัวแปรแวดล้อมที่ต้องตั้ง
```

## เอกสาร

| ไฟล์ | เนื้อหา |
|---|---|
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | ขั้นตอนติดตั้งบน RunCloud + NGINX ทีละขั้น (สร้าง web app, systemd/Supervisor, NGINX proxy, SSL, Google OAuth) |
| [docs/MAINTENANCE.md](docs/MAINTENANCE.md) | backup/restore, อัปเดต, rollback, log, แก้ปัญหา |
| [docs/ANALYSIS.md](docs/ANALYSIS.md) | สถาปัตยกรรม, สิ่งที่เปลี่ยนจากเวอร์ชัน Firebase, โครงสร้างข้อมูล |
| [docs/FEATURES.md](docs/FEATURES.md) | รายการฟีเจอร์และสถานะ |
| [docs/ANALYTICS.md](docs/ANALYTICS.md) | ผลการตรวจด้านการวิเคราะห์ข้อมูล ฟีเจอร์ที่เพิ่ม และนิยามตัวชี้วัด |
| [docs/UX-AUDIT.md](docs/UX-AUDIT.md) | ผลการตรวจ UX/UI บนเดสก์ท็อปและมือถือ (การใช้งาน คีย์บอร์ด WCAG) และแผนปรับปรุง 3 ระยะ |
| [docs/DATAVIZ.md](docs/DATAVIZ.md) | ผลการตรวจด้านการแสดงผลข้อมูล (กราฟ สี โหมดมืด/สว่าง มือถือ การพิมพ์) และสิ่งที่ปรับปรุง |
| [docs/TESTING.md](docs/TESTING.md) | ผลการทดสอบ สิ่งที่ยังไม่ได้ทดสอบ และวิธีรันทดสอบในเครื่อง |
| [docs/OUTSTANDING.md](docs/OUTSTANDING.md) | สิ่งที่ต้องเตรียมเอง (โดเมน, Google OAuth client, ฯลฯ) |

## ติดตั้งแบบย่อ

```bash
# บน VPS ในโฟลเดอร์ web app ของ RunCloud (public path = /public, stack = Native NGINX + Custom Config)
git clone <repo> . && bash deploy/install.sh      # ดาวน์โหลด PocketBase, สร้าง .env, superuser
nano .env                                          # CRM_APP_URL, GOOGLE_CLIENT_ID/SECRET, CRM_DIRECTOR_EMAIL
sudo cp deploy/pocketbase.service.rendered /etc/systemd/system/pocketbase-crm.service
sudo systemctl daemon-reload && sudo systemctl enable --now pocketbase-crm
# RunCloud: NGiNX Config → Add → type location.root → วาง deploy/nginx-proxy.conf → SSL/TLS → Let's Encrypt
```

รายละเอียดทั้งหมดอยู่ใน `docs/DEPLOYMENT.md`

## ข้อควรระวังด้านความปลอดภัย

- ห้าม commit ไฟล์ `.env` และโฟลเดอร์ `pb_data/` (มี `.gitignore` ให้แล้ว)
- จำกัด IP ที่เข้าหน้าแอดมิน `/_/` ใน NGINX config
- ไฟล์แนบทั้งหมดเป็นแบบ protected ดาวน์โหลดได้เฉพาะสมาชิกทีมที่ล็อกอินแล้ว
- ตั้ง `CRM_DEV_PASSWORD_AUTH` เฉพาะเครื่องทดสอบเท่านั้น ห้ามใช้บน production

## สัญญาอนุญาต

MIT (ดู `LICENSE`)
