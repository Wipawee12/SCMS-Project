require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/auth");
const categoryRoutes = require("./routes/categories");
const postRoutes = require("./routes/posts");
const commentRoutes = require("./routes/comments");
const reportRoutes = require("./routes/reports");
const userRoutes = require("./routes/users");

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN || "*")
  .split(",")
  .map((s) => s.trim());

app.use(
  cors({
    origin: allowedOrigins.includes("*") ? true : allowedOrigins,
  })
);

app.use(express.json({ limit: "8mb" }));

// Web Frontend
const frontendDir = path.join(__dirname, "..", "scms-frontend", "scms-src");

app.use(express.static(frontendDir));

app.get("/", (req, res) => {
  res.sendFile(path.join(frontendDir, "index.html"));
});

// API
app.get("/api/health", (req, res) =>
  res.json({ ok: true, service: "scms-backend" })
);

app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/users", userRoutes);

app.use((req, res) =>
  res.status(404).json({ error: "ไม่พบ endpoint นี้" })
);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`SCMS running at http://localhost:${PORT}`);
});