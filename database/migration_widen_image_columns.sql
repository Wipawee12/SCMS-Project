-- migration_widen_image_columns.sql
-- รันสคริปต์นี้หลัง database_schema_postgresql2.sql ถ้าต้องการเก็บรูปภาพ
-- เป็น base64 data URL ตรง ๆ (ตามที่ frontend เดิมทำ) เพราะ VARCHAR(255)
-- ของสคริปต์ต้นฉบับสั้นเกินไปสำหรับ base64
-- (ถ้าจะเปลี่ยนไปเก็บเป็นไฟล์จริงบน storage แล้วเก็บแค่ path แทน ก็ไม่ต้องรันไฟล์นี้)

ALTER TABLE Post ALTER COLUMN image TYPE TEXT;
ALTER TABLE Report ALTER COLUMN screenshot TYPE TEXT;
