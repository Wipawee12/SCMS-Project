// helpers.js — ฟังก์ชันช่วยเหลือที่ใช้ร่วมกันหลายไฟล์
// อ้างอิงตาม database/database_schema_postgresql2.sql
const pool = require("./db");

// สร้างรหัสถัดไปแบบ PREFIX + เลขนำหน้าศูนย์ (เช่น U017, C008, CM022, R009, H007)
async function nextId(table, column, prefix, padLength = 3) {
  const sql = `SELECT ${column} FROM ${table} WHERE ${column} LIKE $1 ORDER BY ${column} DESC`;
  const { rows } = await pool.query(sql, [`${prefix}%`]);
  let max = 0;
  for (const row of rows) {
    const raw = row[column.toLowerCase()] ?? row[column];
    const numPart = String(raw).replace(prefix, "");
    const n = parseInt(numPart, 10);
    if (!isNaN(n) && n > max) max = n;
  }
  const next = max + 1;
  return prefix + String(next).padStart(padLength, "0");
}

// บทบาท (user_role ENUM): 'Admin' | 'นักศึกษา' | 'อาจารย์' | 'บุคลากร'
// frontend ใช้: admin | student | teacher | staff
const ROLE_DB_TO_APP = {
  "Admin": "admin",
  "นักศึกษา": "student",
  "อาจารย์": "teacher",
  "บุคลากร": "staff",
};
const ROLE_APP_TO_DB = {
  admin: "Admin",
  student: "นักศึกษา",
  teacher: "อาจารย์",
  staff: "บุคลากร",
};

// สถานะโพสต์ (post_status ENUM): 'เปิด' | 'กำลังดำเนินการ' | 'สำเร็จแล้ว' | 'ปิดงานแล้ว'
// frontend ใช้: open | in_progress | resolved | closed
// - "resolved" (สำเร็จแล้ว) ใช้เมื่อเจ้าของโพสต์ปักหมุดปิดปัญหาด้วยตัวเอง
// - "closed" (ปิดงานแล้ว) ใช้เมื่อแอดมิน/บุคลากรเป็นผู้ปิดงานให้อย่างเป็นทางการ
// ทั้งสองสถานะนี้ถือว่า "จบงานแล้ว" เหมือนกัน และถูกย้ายไปเก็บในตาราง History เหมือนกัน
const STATUS_DB_TO_APP = {
  "เปิด": "open",
  "กำลังดำเนินการ": "in_progress",
  "สำเร็จแล้ว": "resolved",
  "ปิดงานแล้ว": "closed",
};
const STATUS_APP_TO_DB = {
  open: "เปิด",
  in_progress: "กำลังดำเนินการ",
  resolved: "สำเร็จแล้ว",
  closed: "ปิดงานแล้ว",
};
// สถานะที่ถือว่า "จบงานแล้ว" ต้องย้ายเข้า History และไม่แสดงในฟีดหลัก
const CLOSED_DB_STATUSES = ["สำเร็จแล้ว", "ปิดงานแล้ว"];

// สถานะรายงานบั๊ก (report_status ENUM): 'รอตรวจสอบ' | 'กำลังแก้ไข' | 'แก้ไขแล้ว'
// frontend ใช้: open | in_progress | resolved
const REPORT_DB_TO_APP = {
  "รอตรวจสอบ": "open",
  "กำลังแก้ไข": "in_progress",
  "แก้ไขแล้ว": "resolved",
};
const REPORT_APP_TO_DB = {
  open: "รอตรวจสอบ",
  in_progress: "กำลังแก้ไข",
  resolved: "แก้ไขแล้ว",
};

module.exports = {
  nextId,
  ROLE_DB_TO_APP,
  ROLE_APP_TO_DB,
  STATUS_DB_TO_APP,
  STATUS_APP_TO_DB,
  CLOSED_DB_STATUSES,
  REPORT_DB_TO_APP,
  REPORT_APP_TO_DB,
};
