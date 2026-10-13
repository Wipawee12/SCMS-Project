# SCMS · School Community & Grievance Management System

ระบบชุมชนช่วยเหลือและจัดการเรื่องร้องเรียนภายในสถาบัน ผู้ใช้เลือกห้อง/หมวดหมู่ (ห้องสมุด, IT, โรงอาหาร ฯลฯ) แล้วโพสต์ปัญหาพร้อมรูป เจ้าหน้าที่และเพื่อนร่วมสถาบันคอมเมนต์ช่วยเหลือ เจ้าของโพสต์กดปิดปัญหาแล้วโพสต์จะย้ายไปเก็บในคลังประวัติ และผู้ใช้แจ้งบั๊กของระบบถึงแอดมินได้

โครงงาน Mini-DB Project วิชา 310-2209 Business-Driven SQL · ทีม [ชื่อทีม]

เน้นการออกแบบฐานข้อมูล: **PostgreSQL 6 ตาราง** · ENUM 3 ชุด · Foreign Key พร้อมกฎ CASCADE/RESTRICT · Business Queries 5 ข้อ · ฝั่งเว็บใช้ Node.js + Express และ HTML/CSS/JavaScript

## ภาพรวมโครงการ

| ER Diagram | Database ใน pgAdmin |
|---|---|
| ![ER Diagram](Image/เอกสารออกแบบระบบ/er-diagram.png) | ![Tables](Image/ภาพรวมของระบบ/10-pgadmin-tables.png) |

ไฟล์ฐานข้อมูลอยู่ที่ [`database/`](database/): [`database_schema_postgresql2.sql`](database/database_schema_postgresql2.sql) (สร้างตาราง + ข้อมูลตัวอย่าง), [`migration_widen_image_columns.sql`](database/migration_widen_image_columns.sql), [`business_queries.sql`](database/business_queries.sql)

## เริ่มใช้งาน

ต้องมี [Node.js](https://nodejs.org) 18 ขึ้นไป และ PostgreSQL

1. สร้างฐานข้อมูลใน PostgreSQL (เช่น `issue_report_system`) แล้วรันสคริปต์สคีมา (สร้างตารางและใส่ข้อมูลตัวอย่าง)

   ```bash
   psql -U postgres -d issue_report_system -f database/database_schema_postgresql2.sql
   ```

2. ถ้าต้องการเก็บรูปแนบเป็น base64 ให้รันไฟล์ขยายคอลัมน์รูปด้วย (VARCHAR(255) สั้นเกินไป)

   ```bash
   psql -U postgres -d issue_report_system -f database/migration_widen_image_columns.sql
   ```

3. ติดตั้งและตั้งค่า backend

   ```bash
   cd scms-backend
   npm install
   cp .env.example .env     # แล้วแก้ค่าใน .env ให้ตรงกับ PostgreSQL ของเครื่อง
   npm start
   ```

4. เปิด http://localhost:4000 (backend ให้บริการหน้าเว็บจาก `scms-frontend/` ด้วย) ตรวจการเชื่อมต่อฐานข้อมูลที่ http://localhost:4000/api/health

ไฟล์ `.env` เก็บรหัสผ่านฐานข้อมูล **ถูกยกเว้นจาก Git** (`.gitignore`) ให้ใช้ `.env.example` เป็นแม่แบบเท่านั้น

### บัญชีสาธิต (ข้อมูลตัวอย่างในสคีมา)

| บทบาท | อีเมล | รหัสผ่าน |
|---|---|---|
| แอดมิน | Phitchayathida@cdti.ac.th | `Admin123` |

ข้อมูลตัวอย่างมีผู้ใช้ 16 คน (แอดมิน นักศึกษา อาจารย์ บุคลากร) ดูอีเมลและบทบาทได้ในไฟล์สคีมา หรือสมัครสมาชิกใหม่ด้วยอีเมล `@cdti.ac.th` รหัสผ่านเป็นข้อมูลสาธิตเท่านั้น

## ภาพรวมของระบบ

| เข้าสู่ระบบ | สมัครสมาชิก | ฟีดชุมชน |
|---|---|---|
| ![Login](Image/ภาพรวมของระบบ/01-login.png) | ![Register](Image/ภาพรวมของระบบ/02-register.png) | ![Feed](Image/ภาพรวมของระบบ/03-feed.png) |

| รายละเอียดโพสต์ | สร้างโพสต์ใหม่ | คลังประวัติ |
|---|---|---|
| ![Post detail](Image/ภาพรวมของระบบ/04-post-detail.png) | ![Create post](Image/ภาพรวมของระบบ/05-create-post.png) | ![History](Image/ภาพรวมของระบบ/06-history.png) |

| แจ้งปัญหาระบบ | แผงควบคุมแอดมิน |
|---|---|
| ![Report](Image/ภาพรวมของระบบ/07-report-issue.png) | ![Admin](Image/ภาพรวมของระบบ/08-admin-panel.png) |

## ความสามารถของระบบ

| บทบาท | สิ่งที่ทำได้ |
|---|---|
| นักศึกษา | สร้างโพสต์ในห้องที่เลือก แนบรูป คอมเมนต์ กดปิดโพสต์ของตนเป็น "สำเร็จแล้ว" ลบโพสต์ของตนที่ยังไม่จบ แจ้งปัญหาระบบ |
| อาจารย์ / บุคลากร | ทำได้เหมือนนักศึกษา และเปลี่ยนสถานะโพสต์เป็น "กำลังดำเนินการ" หรือ "ปิดงานแล้ว" |
| แอดมิน | ทำได้ทุกอย่างข้างต้น ลบโพสต์/คอมเมนต์ และเข้าแผงควบคุมจัดการผู้ใช้ ห้อง/หมวดหมู่ และรายงานปัญหาระบบ |

เมื่อโพสต์เปลี่ยนเป็น "สำเร็จแล้ว" หรือ "ปิดงานแล้ว" backend จะอัปเดตตาราง `Post` และเพิ่มแถวลงตาราง `History` ภายใน Transaction เดียวกัน (`BEGIN … COMMIT/ROLLBACK`) และตรวจก่อนว่ายังไม่มีบันทึกของโพสต์นั้น เพื่อให้ Post–History เป็น 1 ต่อ 1

## แบบจำลองข้อมูล

| ตาราง | PK | FK | หน้าที่ |
|---|---|---|---|
| Users | User_ID | - | บัญชีผู้ใช้ (`email` UNIQUE, `role` เป็น ENUM `user_role`) |
| Category | Category_ID | - | ห้อง/หมวดหมู่ |
| Post | Post_ID (SERIAL) | User_ID, Category_ID | โพสต์ (`status` เป็น ENUM `post_status`) |
| Comment | Comment_ID | Post_ID, User_ID | ความคิดเห็น |
| History | History_ID | Post_ID | คลังประวัติโพสต์ที่จบงานแล้ว |
| Report | Report_ID | User_ID | รายงานปัญหาของระบบถึงแอดมิน (`admin_status` เป็น ENUM `report_status`) |

| ความสัมพันธ์ | ชนิด | ON DELETE |
|---|---|---|
| Users – Post | 1 : N | CASCADE |
| Category – Post | 1 : N | **RESTRICT** (ห้ามลบห้องที่ยังมีโพสต์) |
| Users – Comment | 1 : N | CASCADE |
| Post – Comment | 1 : N | CASCADE |
| Post – History | 1 : 1 | CASCADE |
| Users – Report | 1 : N | CASCADE |

ทุก Foreign Key กำหนด `ON UPDATE CASCADE`

| ENUM | ค่า |
|---|---|
| `user_role` | Admin, นักศึกษา, อาจารย์, บุคลากร |
| `post_status` | เปิด, กำลังดำเนินการ, สำเร็จแล้ว, ปิดงานแล้ว |
| `report_status` | รอตรวจสอบ, กำลังแก้ไข, แก้ไขแล้ว |

## Business Queries

คำสั่งทั้งหมดอยู่ใน [`database/business_queries.sql`](database/business_queries.sql) ผลลัพธ์ด้านล่างมาจากการรันบนข้อมูลตัวอย่างในสคีมา

### Query 1: จำนวนโพสต์และอัตราการจบงานแยกตามห้อง/หมวดหมู่

```sql
SELECT c.category_name,
       COUNT(p.post_id)     AS total_posts,
       COUNT(h.history_id)  AS resolved_posts,
       ROUND(100.0 * COUNT(h.history_id) / NULLIF(COUNT(p.post_id), 0), 1) AS resolved_pct
FROM Category c
LEFT JOIN Post p    ON p.category_id = c.category_id
LEFT JOIN History h ON h.post_id = p.post_id
GROUP BY c.category_id, c.category_name
ORDER BY total_posts DESC, c.category_id;
```

ผลลัพธ์จากข้อมูลตัวอย่าง

| category_name | total_posts | resolved_posts | resolved_pct |
|---|---|---|---|
| IT / ระบบเครือข่าย | 3 | 1 | 33.3 |
| ห้องสมุด | 2 | 1 | 50.0 |
| อาคารเรียน / ห้องเรียน | 2 | 1 | 50.0 |
| โรงอาหาร | 2 | 1 | 50.0 |
| ไฟฟ้า / ประปา | 2 | 1 | 50.0 |
| มุมติว | 2 | 1 | 50.0 |
| ทั่วไป | 2 | 1 | 50.0 |

### Query 2: เวลาเฉลี่ยที่ใช้แก้ปัญหา (ชั่วโมง) แยกตามห้อง/หมวดหมู่

```sql
SELECT c.category_name,
       COUNT(*) AS resolved_posts,
       ROUND(AVG(EXTRACT(EPOCH FROM (h.resolved_at - p.created_at)) / 3600)::numeric, 1) AS avg_hours
FROM History h
JOIN Post p     ON p.post_id = h.post_id
JOIN Category c ON c.category_id = p.category_id
GROUP BY c.category_name
ORDER BY avg_hours DESC;
```

ผลลัพธ์จากข้อมูลตัวอย่าง

| category_name | resolved_posts | avg_hours |
|---|---|---|
| อาคารเรียน / ห้องเรียน | 1 | 78.8 |
| โรงอาหาร | 1 | 48.8 |
| ไฟฟ้า / ประปา | 1 | 25.5 |
| ห้องสมุด | 1 | 19.7 |
| ทั่วไป | 1 | 10.8 |
| มุมติว | 1 | 3.0 |
| IT / ระบบเครือข่าย | 1 | 2.9 |

### Query 3: โพสต์ที่ยังค้างและยังไม่มีคอมเมนต์ตอบกลับ

```sql
SELECT p.post_id, p.title, c.category_name, p.status, p.created_at::date AS created_date
FROM Post p
JOIN Category c     ON c.category_id = p.category_id
LEFT JOIN Comment m ON m.post_id = p.post_id
WHERE p.status IN ('เปิด', 'กำลังดำเนินการ')
GROUP BY p.post_id, p.title, c.category_name, p.status, p.created_at
HAVING COUNT(m.comment_id) = 0
ORDER BY p.created_at;
```

ผลลัพธ์จากข้อมูลตัวอย่าง

| post_id | title | category_name | status | created_date |
|---|---|---|---|---|
| 9 | ลืมกระเป๋าดินสอไว้ที่ตึก 604 โต๊ะม้าหินอ่อน | ทั่วไป | เปิด | 2026-08-25 |
| 11 | ขอเพิ่มโต๊ะนั่งโรงอาหารช่วงพักเที่ยง | โรงอาหาร | เปิด | 2026-09-01 |

### Query 4: ผู้ใช้ที่มีส่วนร่วมสูงสุด 5 อันดับ (โพสต์ + คอมเมนต์)

```sql
SELECT u.user_name, u.role,
       COALESCE(pc.posts, 0)    AS posts,
       COALESCE(cc.comments, 0) AS comments,
       COALESCE(pc.posts, 0) + COALESCE(cc.comments, 0) AS activity
FROM Users u
LEFT JOIN (SELECT user_id, COUNT(*) AS posts    FROM Post    GROUP BY user_id) pc ON pc.user_id = u.user_id
LEFT JOIN (SELECT user_id, COUNT(*) AS comments FROM Comment GROUP BY user_id) cc ON cc.user_id = u.user_id
ORDER BY activity DESC, u.user_id
LIMIT 5;
```

ผลลัพธ์จากข้อมูลตัวอย่าง

| user_name | role | posts | comments | activity |
|---|---|---|---|---|
| พิชญธิดา พ่วงพิศ | Admin | 0 | 5 | 5 |
| ปวีณา ใจดี | นักศึกษา | 2 | 1 | 3 |
| กิตติพงศ์ ศรีสุข | นักศึกษา | 1 | 2 | 3 |
| ปฏิภาณ รักษาดี | Admin | 0 | 3 | 3 |
| ธนภัทร วัฒนชัย | บุคลากร | 1 | 1 | 2 |

### Query 5: จำนวนรายงานปัญหาระบบแยกตามสถานะ

```sql
SELECT admin_status, COUNT(*) AS total_reports
FROM Report
GROUP BY admin_status
ORDER BY total_reports DESC;
```

ผลลัพธ์จากข้อมูลตัวอย่าง

| admin_status | total_reports |
|---|---|
| แก้ไขแล้ว | 2 |
| รอตรวจสอบ | 2 |
| กำลังแก้ไข | 1 |

## REST API

Backend แปลงชื่อฟิลด์และค่า ENUM ภาษาไทยในฐานข้อมูล (`นักศึกษา`, `เปิด`) เป็นรูปแบบที่หน้าเว็บใช้ (`student`, `open`) ดูรายละเอียดที่ [`scms-backend/helpers.js`](scms-backend/helpers.js)

| Method | Endpoint | คำอธิบาย |
|---|---|---|
| GET | `/api/health` | ตรวจการเชื่อมต่อฐานข้อมูล |
| POST | `/api/auth/login` | เข้าสู่ระบบ `{email, password}` |
| POST | `/api/auth/register` | สมัครสมาชิก `{name, email, password, role}` |
| GET / POST | `/api/categories` | ดู / เพิ่มห้อง/หมวดหมู่ |
| DELETE | `/api/categories/:id` | ลบห้อง |
| GET | `/api/posts?status=&roomId=&search=` | รายการโพสต์ (`status`: `open`, `in_progress`, `resolved`, `closed`, `all`, `archive`) |
| GET | `/api/posts/:id` | รายละเอียดโพสต์ |
| POST | `/api/posts` | สร้างโพสต์ |
| PATCH | `/api/posts/:id/status` | เปลี่ยนสถานะ (`resolved`/`closed` เพิ่มแถวใน History อัตโนมัติ) |
| DELETE | `/api/posts/:id` | ลบโพสต์ |
| GET / POST | `/api/comments` | ดู / เพิ่มคอมเมนต์ |
| GET / POST | `/api/reports` | ดู / แจ้งปัญหาระบบ |
| PATCH | `/api/reports/:id` | อัปเดตสถานะรายงาน |
| GET | `/api/users` | รายชื่อผู้ใช้ (แอดมิน) |
| PATCH / DELETE | `/api/users/:id` | เปลี่ยนบทบาท / ลบผู้ใช้ |

## โครงสร้างโครงการ

```text
.
├── database/
│   ├── database_schema_postgresql2.sql   # ENUM + 6 ตาราง + ข้อมูลตัวอย่าง
│   ├── migration_widen_image_columns.sql # ขยายคอลัมน์รูปเป็น TEXT
│   ├── business_queries.sql              # Business Queries 5 ข้อ
│   └── ER_Diagram.png
├── scms-backend/                         # Express API (db.js, helpers.js, routes/)
├── scms-frontend/scms-src/               # หน้าเว็บ (index.html, app.js, api.js, style.css)
└── Image/                                # ภาพหน้าจอและ ER Diagram
```

## ข้อจำกัดและแนวทางพัฒนา

โปรเจกต์นี้เป็น prototype เพื่อการเรียนรู้ ยังไม่เหมาะกับการใช้งานจริงจนกว่าจะปรับดังนี้

- รหัสผ่านเก็บเป็นข้อความธรรมดา → ควรใช้ `bcrypt`
- ยังไม่มีระบบยืนยันตัวตนแบบ session/JWT และยังไม่ตรวจสิทธิ์ในแต่ละ endpoint ฝั่ง server
- `History.Post_ID` ยังไม่มี `UNIQUE` ความสัมพันธ์ 1:1 จึงอาศัยการตรวจในโค้ด ควรเพิ่ม constraint ที่ฐานข้อมูล
- รูปแนบเก็บเป็น base64 ในฐานข้อมูล ควรเปลี่ยนเป็นเก็บไฟล์แล้วบันทึกเฉพาะพาธ
- รหัส Comment, History, Report เป็น VARCHAR ที่โค้ดสร้างเอง ควรใช้ `IDENTITY`/`SERIAL`

## ทีมผู้จัดทำ

| ชื่อ | หน้าที่ |
|---|---|
| [ชื่อ-นามสกุล] | [หน้าที่] |
