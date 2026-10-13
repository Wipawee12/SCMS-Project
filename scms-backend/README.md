# SCMS Backend API

Backend REST API สำหรับเว็บ SCMS เชื่อมต่อกับฐานข้อมูล PostgreSQL ตาม
`../database/database_schema_postgresql2.sql` (ตาราง Users, Category, Post,
Comment, History, Report)

**บทบาทผู้ใช้ (user_role):** `Admin` / `นักศึกษา` / `อาจารย์` / `บุคลากร`
↔ ฝั่ง frontend ใช้ `admin` / `student` / `teacher` / `staff`

**สถานะโพสต์ (post_status):** `เปิด` / `กำลังดำเนินการ` / `สำเร็จแล้ว` / `ปิดงานแล้ว`
↔ ฝั่ง frontend ใช้ `open` / `in_progress` / `resolved` / `closed`
โดย `resolved` ("สำเร็จแล้ว") คือเจ้าของโพสต์ปักหมุดปิดปัญหาด้วยตัวเอง และ
`closed` ("ปิดงานแล้ว") คือแอดมิน/บุคลากรปิดงานให้อย่างเป็นทางการ ทั้งสอง
สถานะนี้จะถูกย้ายไปเก็บในตาราง History และแสดงในหน้า "คลังประวัติ" เหมือนกัน

## 1. ติดตั้ง

ต้องมี [Node.js](https://nodejs.org) (v18 ขึ้นไป) และ PostgreSQL ที่สร้าง
ฐานข้อมูลและรันสคริปต์ `../database/database_schema_postgresql2.sql` ไปแล้ว (ไฟล์
`.env.example` ตั้งชื่อฐานข้อมูลดีฟอลต์ไว้เป็น `issue_report_system`
เปลี่ยนให้ตรงกับชื่อฐานข้อมูลจริงที่คุณสร้างได้ที่ `.env`)

```bash
cd scms-backend
npm install
cp .env.example .env
```

แก้ไขไฟล์ `.env` ให้ตรงกับการตั้งค่า PostgreSQL ของคุณ (host, port, ชื่อ
ฐานข้อมูล, user, password)

## 2. รันเซิร์ฟเวอร์

```bash
npm start
```

จะได้ API รันที่ `http://localhost:4000` (หรือพอร์ตที่ตั้งไว้ใน `.env`)
ทดสอบว่าเชื่อมต่อฐานข้อมูลสำเร็จได้ที่ `http://localhost:4000/api/health`

## 3. Endpoint ที่มีให้

| Method | Endpoint | คำอธิบาย |
|---|---|---|
| POST | `/api/auth/login` | เข้าสู่ระบบ `{email, password}` |
| POST | `/api/auth/register` | สมัครสมาชิก `{name, email, password, role}` |
| GET | `/api/categories` | ดึงรายการห้อง/หมวดหมู่ทั้งหมด |
| POST | `/api/categories` | เพิ่มห้องใหม่ (แอดมิน) `{name, description}` |
| DELETE | `/api/categories/:id` | ลบห้อง |
| GET | `/api/posts?status=&roomId=&search=` | ดึงรายการโพสต์ — `status` รับค่า `open`/`in_progress`/`resolved`/`closed`/`all`/`archive` (ไม่ใส่ = ฟีดหลัก ไม่รวมโพสต์ที่จบงานแล้ว, `archive` = เฉพาะโพสต์ที่จบงานแล้วทั้งสองสถานะ) |
| GET | `/api/posts/:id` | ดึงรายละเอียดโพสต์ |
| POST | `/api/posts` | สร้างโพสต์ `{userId, roomId, title, body, image}` |
| PATCH | `/api/posts/:id/status` | เปลี่ยนสถานะ `{status: "open"\|"in_progress"\|"resolved"\|"closed"}` — `resolved`/`closed` จะเพิ่มแถวลง History ให้อัตโนมัติ |
| DELETE | `/api/posts/:id` | ลบโพสต์ |
| GET | `/api/comments?postId=` | ดึงคอมเมนต์ของโพสต์ |
| POST | `/api/comments` | เพิ่มคอมเมนต์ `{postId, userId, text}` |
| GET | `/api/reports?reporterId=` | ดึงรายงานปัญหาระบบ (ใส่ reporterId เพื่อดูของผู้ใช้คนเดียว) |
| POST | `/api/reports` | แจ้งปัญหาระบบใหม่ `{reporterId, title, detail, image}` |
| PATCH | `/api/reports/:id` | อัปเดตสถานะรายงาน `{status: "open"\|"in_progress"\|"resolved"}` |
| GET | `/api/users` | ดึงรายชื่อผู้ใช้ทั้งหมด (แอดมิน) |
| PATCH | `/api/users/:id` | เปลี่ยนบทบาทผู้ใช้ `{role}` |
| DELETE | `/api/users/:id` | ลบผู้ใช้ |

ทุก endpoint คืนค่าเป็น JSON และแปลงชื่อฟิลด์ + ค่า ENUM ภาษาไทยในฐานข้อมูล
(เช่น `นักศึกษา`, `เปิด`, `ปิดงาน`) ให้เป็นรูปแบบภาษาอังกฤษที่ฝั่ง frontend
ใช้อยู่แล้ว (`student`, `open`, `closed`) โดยอัตโนมัติ ดูรายละเอียดการแปลงได้
ที่ `helpers.js`

## 4. รูปภาพ

โค้ด frontend เดิมแนบรูปเป็น base64 data URL ซึ่งจะถูกเก็บลงคอลัมน์
`image` / `screenshot` (VARCHAR 255) ได้ไม่ครบถ้วนเพราะยาวเกินไป — แนะนำให้
ปรับคอลัมน์เป็น `TEXT` แทน หรือเปลี่ยนไปใช้ไฟล์อัปโหลดจริงลง storage
(เช่น โฟลเดอร์ `uploads/` หรือ S3) แล้วเก็บแค่ path/URL ตามที่ schema ตั้งใจ
ไว้ (`uploads/posts/post_03.jpg` แบบในข้อมูลตัวอย่าง) — ถ้าต้องการ ผมช่วยทำ
endpoint อัปโหลดไฟล์เพิ่มให้ได้

## 5. ความปลอดภัยที่ควรทำเพิ่มก่อนใช้งานจริง

โค้ดชุดนี้เป็น prototype ที่ทำงานได้ตรงกับ schema ที่ให้มา แต่ยังไม่เหมาะกับ
การใช้งานจริงจนกว่าจะเพิ่ม:
- การเข้ารหัสรหัสผ่าน (เช่น `bcrypt`) แทนการเก็บ plain text
- ระบบยืนยันตัวตนแบบ session/JWT แทนการส่ง user object ตรง ๆ
- การตรวจสิทธิ์ (authorization) ในแต่ละ endpoint ว่าใครมีสิทธิ์เรียกได้บ้าง
  (ตอนนี้ทุก endpoint เปิดกว้าง ยังไม่เช็กว่าเป็นแอดมินจริงหรือไม่)
