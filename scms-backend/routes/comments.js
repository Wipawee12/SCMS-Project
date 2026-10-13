const express = require("express");
const router = express.Router();
const pool = require("../db");
const { nextId } = require("../helpers");

function toClient(row) {
  return {
    id: row.comment_id,
    postId: row.post_id,
    authorId: row.user_id,
    text: row.comment_text,
    image: row.image,
    createdAt: row.created_at,
    authorName: row.user_name,
    authorRole: row.role
  };
}

// GET /api/comments?postId=1
router.get("/", async (req, res) => {
  const { postId } = req.query;
  if (!postId) return res.status(400).json({ error: "ต้องระบุ postId" });
  try {
    const { rows } = await pool.query(
      `SELECT cm.*, u.User_Name, u.role
       FROM Comment cm
       JOIN Users u ON u.User_ID = cm.User_ID
       WHERE cm.Post_ID = $1
       ORDER BY cm.created_at ASC`,
      [postId]
    );
    res.json({ comments: rows.map(toClient) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดของเซิร์ฟเวอร์" });
  }
});

// POST /api/comments  { postId, userId, text }
router.post("/", async (req, res) => {
  const { postId, userId, text, image } = req.body || {};
  console.log("COMMENT IMAGE:", image);
  if (!postId || !userId || !text && !image) {
    return res.status(400).json({ error: "กรุณากรอกข้อมูลให้ครบถ้วน" });
  }
  try {
    const id = await nextId("Comment", "comment_id", "CM");
    await pool.query(
      `INSERT INTO Comment (comment_id, post_id, user_id, comment_text, image) VALUES ($1, $2, $3, $4, $5)`,
      [id, postId, userId, text || "", image || null]
    );
    const full = await pool.query(
      `SELECT cm.*, u.User_Name, u.role FROM Comment cm
       JOIN Users u ON u.User_ID = cm.User_ID WHERE cm.Comment_ID = $1`,
      [id]
    );
    res.status(201).json({ comment: toClient(full.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดของเซิร์ฟเวอร์" });
  }
});

// DELETE /api/comments/:id
// ลบได้โดย:
// 1. เจ้าของ Comment
// 2. เจ้าของ Post
// 3. Admin
router.delete("/:id", async (req, res) => {
  const commentId = req.params.id;
  const { userId } = req.body || {};

  if (!userId) {
    return res.status(400).json({
      error: "ต้องระบุ userId"
    });
  }

  try {
    const result = await pool.query(
      `
      SELECT
        cm.Comment_ID,
        cm.User_ID AS comment_user_id,
        p.User_ID AS post_user_id,
        u.role
      FROM Comment cm
      JOIN Post p ON p.Post_ID = cm.Post_ID
      JOIN Users u ON u.User_ID = $1
      WHERE cm.Comment_ID = $2
      `,
      [userId, commentId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: "ไม่พบความคิดเห็นนี้"
      });
    }

    const row = result.rows[0];

    const isCommentOwner =
      String(row.comment_user_id) === String(userId);

    const isPostOwner =
      String(row.post_user_id) === String(userId);

    const isAdmin =
      String(row.role).toLowerCase() === "admin";

    if (!isCommentOwner && !isPostOwner && !isAdmin) {
      return res.status(403).json({
        error: "คุณไม่มีสิทธิ์ลบความคิดเห็นนี้"
      });
    }

    await pool.query(
      "DELETE FROM Comment WHERE Comment_ID = $1",
      [commentId]
    );

    res.json({
      ok: true,
      message: "ลบความคิดเห็นเรียบร้อยแล้ว"
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "เกิดข้อผิดพลาดของเซิร์ฟเวอร์"
    });
  }
});

module.exports = router;