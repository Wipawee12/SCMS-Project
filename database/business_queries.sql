-- =========================================================
-- Business Queries ของ SCMS (รันบนข้อมูลตัวอย่างใน database_schema_postgresql2.sql)
-- =========================================================

-- ---------------------------------------------------------
-- Query 1: จำนวนโพสต์และอัตราการจบงานแยกตามห้อง/หมวดหมู่
-- ---------------------------------------------------------
SELECT c.category_name,
       COUNT(p.post_id)     AS total_posts,
       COUNT(h.history_id)  AS resolved_posts,
       ROUND(100.0 * COUNT(h.history_id) / NULLIF(COUNT(p.post_id), 0), 1) AS resolved_pct
FROM Category c
LEFT JOIN Post p    ON p.category_id = c.category_id
LEFT JOIN History h ON h.post_id = p.post_id
GROUP BY c.category_id, c.category_name
ORDER BY total_posts DESC, c.category_id;

-- ---------------------------------------------------------
-- Query 2: เวลาเฉลี่ยที่ใช้แก้ปัญหา (ชั่วโมง) แยกตามห้อง/หมวดหมู่
-- ---------------------------------------------------------
SELECT c.category_name,
       COUNT(*) AS resolved_posts,
       ROUND(AVG(EXTRACT(EPOCH FROM (h.resolved_at - p.created_at)) / 3600)::numeric, 1) AS avg_hours
FROM History h
JOIN Post p     ON p.post_id = h.post_id
JOIN Category c ON c.category_id = p.category_id
GROUP BY c.category_name
ORDER BY avg_hours DESC;

-- ---------------------------------------------------------
-- Query 3: โพสต์ที่ยังค้างและยังไม่มีคอมเมนต์ตอบกลับ
-- ---------------------------------------------------------
SELECT p.post_id, p.title, c.category_name, p.status, p.created_at::date AS created_date
FROM Post p
JOIN Category c     ON c.category_id = p.category_id
LEFT JOIN Comment m ON m.post_id = p.post_id
WHERE p.status IN ('เปิด', 'กำลังดำเนินการ')
GROUP BY p.post_id, p.title, c.category_name, p.status, p.created_at
HAVING COUNT(m.comment_id) = 0
ORDER BY p.created_at;

-- ---------------------------------------------------------
-- Query 4: ผู้ใช้ที่มีส่วนร่วมสูงสุด 5 อันดับ (โพสต์ + คอมเมนต์)
-- ---------------------------------------------------------
SELECT u.user_name, u.role,
       COALESCE(pc.posts, 0)    AS posts,
       COALESCE(cc.comments, 0) AS comments,
       COALESCE(pc.posts, 0) + COALESCE(cc.comments, 0) AS activity
FROM Users u
LEFT JOIN (SELECT user_id, COUNT(*) AS posts    FROM Post    GROUP BY user_id) pc ON pc.user_id = u.user_id
LEFT JOIN (SELECT user_id, COUNT(*) AS comments FROM Comment GROUP BY user_id) cc ON cc.user_id = u.user_id
ORDER BY activity DESC, u.user_id
LIMIT 5;

-- ---------------------------------------------------------
-- Query 5: จำนวนรายงานปัญหาระบบแยกตามสถานะ
-- ---------------------------------------------------------
SELECT admin_status, COUNT(*) AS total_reports
FROM Report
GROUP BY admin_status
ORDER BY total_reports DESC;
