const express = require("express");
const router = express.Router();
const pool = require("../db");
const { nextId } = require("../helpers");

function toClient(row) {
  return { id: row.category_id, name: row.category_name, description: row.description };
}

// GET /api/categories
router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM Category ORDER BY Category_ID");
    res.json({ categories: rows.map(toClient) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดของเซิร์ฟเวอร์" });
  }
});

// POST /api/categories  { name, description }  (สำหรับแอดมิน)
router.post("/", async (req, res) => {
  const { name, description } = req.body || {};
  if (!name) return res.status(400).json({ error: "กรุณาระบุชื่อห้อง" });
  try {
    const id = await nextId("Category", "category_id", "C");
    const { rows } = await pool.query(
      "INSERT INTO Category (Category_ID, Category_name, description) VALUES ($1, $2, $3) RETURNING *",
      [id, name, description || null]
    );
    res.status(201).json({ category: toClient(rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดของเซิร์ฟเวอร์" });
  }
});

// DELETE /api/categories/:id
router.delete("/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM Category WHERE Category_ID = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    // ON DELETE RESTRICT ที่ตาราง Post จะทำให้ลบไม่ได้ถ้ายังมีโพสต์อ้างอิงอยู่
    console.error(err);
    res.status(409).json({ error: "ลบห้องนี้ไม่ได้ เพราะยังมีโพสต์อยู่ในห้องนี้" });
  }
});

module.exports = router;
