const express = require("express");
const router = express.Router();
const pool = require("../db");
const { nextId, REPORT_DB_TO_APP, REPORT_APP_TO_DB } = require("../helpers");

function toClient(row) {
  return {
    id: row.report_id,
    reporterId: row.user_id,
    title: row.issue_title,
    detail: row.error_details,
    image: row.screenshot,
    status: REPORT_DB_TO_APP[row.admin_status] || row.admin_status,
    adminStatusRaw: row.admin_status, // ค่าดิบภาษาไทย เผื่อแอดมินอยากเห็นสถานะละเอียดกว่า open/resolved
    createdAt: row.created_at,
    reporterName: row.user_name,
  };
}

// GET /api/reports  (แอดมินดูทั้งหมด) หรือ  /api/reports?reporterId=U002 (ผู้ใช้ดูของตัวเอง)
router.get("/", async (req, res) => {
  const { reporterId } = req.query;
  try {
    const params = [];
    let where = "";
    if (reporterId) {
      params.push(reporterId);
      where = "WHERE r.User_ID = $1";
    }
    const { rows } = await pool.query(
      `SELECT r.*, u.User_Name FROM Report r
       JOIN Users u ON u.User_ID = r.User_ID
       ${where} ORDER BY r.created_at DESC`,
      params
    );
    res.json({ reports: rows.map(toClient) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดของเซิร์ฟเวอร์" });
  }
});

// POST /api/reports  { reporterId, title, detail, image }
router.post("/", async (req, res) => {
  const { reporterId, title, detail, image } = req.body || {};
  if (!reporterId || !title || !detail) {
    return res.status(400).json({ error: "กรุณากรอกข้อมูลให้ครบถ้วน" });
  }
  try {
    const id = await nextId("Report", "report_id", "R");
    await pool.query(
      `INSERT INTO Report (Report_ID, User_ID, issue_title, error_details, screenshot, admin_status)
       VALUES ($1, $2, $3, $4, $5, 'รอตรวจสอบ')`,
      [id, reporterId, title, detail, image || null]
    );
    const full = await pool.query(
      `SELECT r.*, u.User_Name FROM Report r JOIN Users u ON u.User_ID = r.User_ID WHERE r.Report_ID = $1`,
      [id]
    );
    res.status(201).json({ report: toClient(full.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดของเซิร์ฟเวอร์" });
  }
});

// PATCH /api/reports/:id  { status: "open" | "in_progress" | "resolved" }  — สำหรับแอดมินอัปเดตสถานะรายงาน
router.patch("/:id", async (req, res) => {
  const { status } = req.body || {};
  const dbStatus = REPORT_APP_TO_DB[status];
  if (!dbStatus) return res.status(400).json({ error: "สถานะไม่ถูกต้อง" });
  try {
    const { rows } = await pool.query(
      "UPDATE Report SET admin_status = $1 WHERE Report_ID = $2 RETURNING *",
      [dbStatus, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "ไม่พบรายงานนี้" });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดของเซิร์ฟเวอร์" });
  }
});

module.exports = router;
