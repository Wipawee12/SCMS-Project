/* ============================================================
   api.js — ตัวเชื่อมต่อกับ SCMS backend (Express + PostgreSQL)
   แทนที่การเก็บข้อมูลใน localStorage ของเวอร์ชันก่อนหน้า
   แก้ไข API_BASE ด้านล่างให้ตรงกับที่ backend รันอยู่จริง
   ============================================================ */

// ระหว่างพัฒนาบนเครื่อง (npm start ที่ scms-backend) ค่าเริ่มต้นนี้ใช้ได้เลย
// เมื่อ deploy จริง ให้เปลี่ยนเป็น URL ของ backend บนเซิร์ฟเวอร์ เช่น
// "https://api.yourdomain.ac.th/api"
const API_BASE = "/api";
async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(API_BASE + path, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch (err) {
    throw new Error("เชื่อมต่อ backend ไม่ได้ กรุณาตรวจสอบว่าเซิร์ฟเวอร์ API กำลังทำงานอยู่");
  }
  let data = null;
  try { data = await res.json(); } catch (e) { /* ไม่มี body */ }
  if (!res.ok) {
    throw new Error((data && data.error) || `คำขอล้มเหลว (HTTP ${res.status})`);
  }
  return data;
}

const Api = {
  // ---------- Auth ----------
  login(email, password) {
    return request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) })
      .then((d) => d.user);
  },
  register(name, email, password, role) {
    return request("/auth/register", { method: "POST", body: JSON.stringify({ name, email, password, role }) })
      .then((d) => d.user);
  },

  // ---------- Categories / Rooms ----------
  getCategories() {
    return request("/categories").then((d) => d.categories);
  },
  addCategory(name, description) {
    return request("/categories", { method: "POST", body: JSON.stringify({ name, description }) })
      .then((d) => d.category);
  },
  deleteCategory(id) {
    return request(`/categories/${id}`, { method: "DELETE" });
  },

  // ---------- Posts ----------
  getPosts({ status, roomId, search } = {}) {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (roomId) params.set("roomId", roomId);
    if (search) params.set("search", search);
    const qs = params.toString();
    return request(`/posts${qs ? "?" + qs : ""}`).then((d) => d.posts);
  },
  getPost(id) {
    return request(`/posts/${id}`).then((d) => d.post);
  },
  createPost({ userId, roomId, title, body, image }) {
    return request("/posts", { method: "POST", body: JSON.stringify({ userId, roomId, title, body, image }) })
      .then((d) => d.post);
  },
  setPostStatus(id, status) {
    return request(`/posts/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) })
      .then((d) => d.post);
  },
  deletePost(id) {
    return request(`/posts/${id}`, { method: "DELETE" });
  },

  // ---------- Comments ----------
  getComments(postId) {
    return request(`/comments?postId=${encodeURIComponent(postId)}`).then((d) => d.comments);
  },
  addComment(postId, userId, text, image) {
    return request("/comments", {
      method: "POST",
      body: JSON.stringify({
        postId,
        userId,
        text,
        image
      })
    });
  },
  deleteComment(commentId, userId) {
    return request(`/comments/${commentId}`, {
      method: "DELETE",
      body: JSON.stringify({ userId })
    });
  },

  // ---------- Issue reports ----------
  getReports(reporterId) {
    const qs = reporterId ? `?reporterId=${encodeURIComponent(reporterId)}` : "";
    return request(`/reports${qs}`).then((d) => d.reports);
  },
  createReport(reporterId, title, detail, image) {
    return request("/reports", { method: "POST", body: JSON.stringify({ reporterId, title, detail, image }) })
      .then((d) => d.report);
  },
  updateReportStatus(id, status) {
    return request(`/reports/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
  },

  // ---------- Users (admin) ----------
  getUsers() {
    return request("/users").then((d) => d.users);
  },
  updateUserRole(id, role) {
    return request(`/users/${id}`, { method: "PATCH", body: JSON.stringify({ role }) }).then((d) => d.user);
  },
  removeUser(id) {
    return request(`/users/${id}`, { method: "DELETE" });
  },
};

window.Api = Api;
