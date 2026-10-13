// db.js — การเชื่อมต่อฐานข้อมูล PostgreSQL แบบ connection pool
// ใช้ตัวแปรแวดล้อมจากไฟล์ .env (ดูตัวอย่างที่ .env.example)
require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: process.env.PGPORT || 5432,
  database: process.env.PGDATABASE || "issue_report_system",
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "",
});

pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL pool error:", err);
});

module.exports = pool;
