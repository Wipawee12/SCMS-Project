const express = require("express");
const router = express.Router();
const pool = require("../db");
const { nextId, STATUS_DB_TO_APP, STATUS_APP_TO_DB, CLOSED_DB_STATUSES } = require("../helpers");

function toClient(row) {
  return {
    id: row.post_id,
    roomId: row.category_id,
    authorId: row.user_id,
    title: row.title,
    body: row.content,
    image: row.image,
    status: STATUS_DB_TO_APP[row.status] || row.status,
    createdAt: row.created_at,
    authorName: row.user_name,
    roomName: row.category_name,
  };
}

const SELECT_BASE = `
  SELECT p.*, u.User_Name, c.Category_name
  FROM Post p
  JOIN Users u ON u.User_ID = p.User_ID
  JOIN Category c ON c.Category_ID = p.Category_ID
`;

// GET /api/posts?status=open|in_progress|resolved|closed|all&roomId=&search=
// ถ้าไม่ส่ง status มา: ดีฟอลต์คือฟีดหลัก (ไม่รวมโพสต์ที่ "สำเร็จแล้ว" หรือ "ปิดงานแล้ว")
// ส่ง status=archive เพื่อดึงเฉพาะโพสต์ที่จบงานแล้วทั้งสองสถานะ (หน้าคลังประวัติ)
router.get("/", async (req, res) => {
  const { status, roomId, search } = req.query;
  const conditions = [];
  const params = [];

  if (status === "archive") {
    conditions.push(`p.status = ANY($${params.length + 1})`);
    params.push(CLOSED_DB_STATUSES);
  } else if (status && status !== "all") {
    params.push(STATUS_APP_TO_DB[status] || status);
    conditions.push(`p.status = $${params.length}`);
  } else if (!status) {
    params.push(CLOSED_DB_STATUSES);
    conditions.push(`p.status <> ALL($${params.length})`);
  }
  if (roomId && roomId !== "all") {
    params.push(roomId);
    conditions.push(`p.category_id = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(p.title ILIKE $${params.length} OR p.content ILIKE $${params.length})`);
  }

  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
  try {
    const { rows } = await pool.query(
      `${SELECT_BASE} ${where} ORDER BY p.created_at DESC`,
      params
    );
    res.json({ posts: rows.map(toClient) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดของเซิร์ฟเวอร์" });
  }
});

// GET /api/posts/:id
router.get("/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(`${SELECT_BASE} WHERE p.post_id = $1`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "ไม่พบโพสต์นี้" });
    res.json({ post: toClient(rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดของเซิร์ฟเวอร์" });
  }
});

// POST /api/posts  { userId, roomId, title, body, image }
router.post("/", async (req, res) => {
  const { userId, roomId, title, body, image } = req.body || {};
  if (!userId || !roomId || !title || !body) {
    return res.status(400).json({ error: "กรุณากรอกข้อมูลให้ครบถ้วน" });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO Post (User_ID, Category_ID, title, content, image, status)
       VALUES ($1, $2, $3, $4, $5, 'เปิด') RETURNING *`,
      [userId, roomId, title, body, image || null]
    );
    const full = await pool.query(`${SELECT_BASE} WHERE p.post_id = $1`, [rows[0].post_id]);
    res.status(201).json({ post: toClient(full.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดของเซิร์ฟเวอร์" });
  }
});

// PATCH /api/posts/:id/status  { status: "open" | "in_progress" | "resolved" | "closed" }
// - "resolved"  → เจ้าของโพสต์ปักหมุดปิดปัญหาเอง (บันทึกเป็น 'สำเร็จแล้ว')
// - "closed"    → แอดมิน/บุคลากรปิดงานให้อย่างเป็นทางการ (บันทึกเป็น 'ปิดงานแล้ว')
// ทั้งสองกรณีจะเพิ่มแถวลงตาราง History ให้อัตโนมัติ (ย้ายไปคลังประวัติ)
router.patch("/:id/status", async (req, res) => {
  const { status } = req.body || {};
  const dbStatus = STATUS_APP_TO_DB[status];
  if (!dbStatus) return res.status(400).json({ error: "สถานะไม่ถูกต้อง" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      "UPDATE Post SET status = $1 WHERE Post_ID = $2 RETURNING *",
      [dbStatus, req.params.id]
    );
    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "ไม่พบโพสต์นี้" });
    }
    if (CLOSED_DB_STATUSES.includes(dbStatus)) {
      const already = await client.query("SELECT 1 FROM History WHERE Post_ID = $1", [req.params.id]);
      if (!already.rows.length) {
        const historyId = await nextId("History", "history_id", "H");
        await client.query(
          "INSERT INTO History (History_ID, Post_ID) VALUES ($1, $2)",
          [historyId, req.params.id]
        );
      }
    }
    await client.query("COMMIT");
    res.json({ post: toClient(rows[0]) });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดของเซิร์ฟเวอร์" });
  } finally {
    client.release();
  }
});

// DELETE /api/posts/:id
router.delete("/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM Post WHERE Post_ID = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดของเซิร์ฟเวอร์" });
  }
});

module.exports = router;
