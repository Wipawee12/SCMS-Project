const express = require("express");
const router = express.Router();
const pool = require("../db");
const { ROLE_DB_TO_APP, ROLE_APP_TO_DB } = require("../helpers");

function toClient(row) {
  return {
    id: row.user_id,
    name: row.user_name,
    email: row.email,
    role: ROLE_DB_TO_APP[row.role] || row.role,
    createdAt: row.created_at,
  };
}

// GET /api/users  (สำหรับแอดมิน)
router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM Users ORDER BY User_Name");
    res.json({ users: rows.map(toClient) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดของเซิร์ฟเวอร์" });
  }
});

// PATCH /api/users/:id  { role }  — เปลี่ยนบทบาทผู้ใช้ (แอดมินเท่านั้น)
router.patch("/:id", async (req, res) => {
  const { role } = req.body || {};
  const dbRole = ROLE_APP_TO_DB[role];
  if (!dbRole) return res.status(400).json({ error: "บทบาทไม่ถูกต้อง" });
  try {
    const { rows } = await pool.query(
      "UPDATE Users SET role = $1 WHERE User_ID = $2 RETURNING *",
      [dbRole, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "ไม่พบผู้ใช้นี้" });
    res.json({ user: toClient(rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดของเซิร์ฟเวอร์" });
  }
});

// DELETE /api/users/:id
router.delete("/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM Users WHERE User_ID = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดของเซิร์ฟเวอร์" });
  }
});

module.exports = router;
