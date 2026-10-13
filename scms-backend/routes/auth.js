const express = require("express");
const router = express.Router();
const pool = require("../db");
const { nextId, ROLE_DB_TO_APP, ROLE_APP_TO_DB } = require("../helpers");

// ตัดฟิลด์ password ออกก่อนส่งกลับ และแปลง role เป็นรูปแบบที่ frontend ใช้
function toClientUser(row) {
  return {
    id: row.user_id,
    name: row.user_name,
    email: row.email,
    role: ROLE_DB_TO_APP[row.role] || row.role,
    createdAt: row.created_at,
  };
}

// POST /api/auth/login  { email, password }
router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "กรุณากรอกอีเมลและรหัสผ่าน" });
  }
  try {
    const { rows } = await pool.query(
      "SELECT * FROM Users WHERE LOWER(email) = LOWER($1)",
      [email]
    );
    const user = rows[0];
    if (!user || user.password !== password) {
      return res.status(401).json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
    }
    res.json({ user: toClientUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดของเซิร์ฟเวอร์" });
  }
});

// POST /api/auth/register  { name, email, password, role }
// role ที่รับจาก frontend: "student" | "staff" | "admin"
router.post("/register", async (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: "กรุณากรอกข้อมูลให้ครบถ้วน" });
  }
  if (!email.toLowerCase().endsWith("@cdti.ac.th")) {
    // ปรับโดเมนอีเมลสถาบันของคุณได้ตรงนี้ ให้ตรงกับข้อมูลตัวอย่างใน schema (@cdti.ac.th)
    return res.status(400).json({ error: "กรุณาใช้อีเมลสถาบัน (@cdti.ac.th) เท่านั้น" });
  }
  if (String(password).length < 4) {
    return res.status(400).json({ error: "รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร" });
  }
  const dbRole = ROLE_APP_TO_DB[role];
  if (!dbRole) {
    return res.status(400).json({ error: "บทบาทไม่ถูกต้อง" });
  }
  try {
    const existing = await pool.query(
      "SELECT 1 FROM Users WHERE LOWER(email) = LOWER($1)",
      [email]
    );
    if (existing.rows.length) {
      return res.status(409).json({ error: "มีบัญชีที่ใช้อีเมลนี้แล้ว" });
    }
    const id = await nextId("Users", "user_id", "U");
    const { rows } = await pool.query(
      `INSERT INTO Users (User_ID, User_Name, email, password, role)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, name, email, password, dbRole]
    );
    res.status(201).json({ user: toClientUser(rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดของเซิร์ฟเวอร์" });
  }
});

module.exports = router;
