/* ============================================================
   SCMS — School Community & Grievance Management System
   เวอร์ชันเชื่อมต่อ backend จริง (Express + PostgreSQL) ผ่าน api.js
   อ้างอิงตาม database_schema_postgresql2.sql
   - บทบาท: admin | student | teacher | staff
   - สถานะโพสต์: open | in_progress | resolved | closed
     (resolved = เจ้าของโพสต์ปิดเอง "สำเร็จแล้ว", closed = แอดมิน/บุคลากรปิดให้ "ปิดงานแล้ว")
   ============================================================ */

const SESSION_KEY = "scms_v1_session";
const ROOM_COLORS = ["#2E6BB8", "#F4B93E", "#2E8B57", "#C9503F", "#7E57C2", "#1B4C8C", "#008B94"];

function fmtTime(iso) {
  if (!iso) return "";

  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  // ยังไม่ครบ 24 ชั่วโมง → แสดงเวลา
  if (diffHours < 24) {
    return d.toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }) + " น.";
  }

  // ครบ 24 ชั่วโมงแล้ว → แสดงวันที่
  return d.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}
function toast(msg, type) {
  const wrap = document.getElementById('toast-wrap');
  const t = document.createElement('div');
  t.className = 'toast' + (type ? ' ' + type : '');
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300); }, 2600);
}
function roleLabel(role) {
  return { student: "นักศึกษา", teacher: "อาจารย์", staff: "บุคลากร", admin: "ผู้ดูแลระบบ" }[role] || role;
}
function initials(name) {
  const parts = (name || "?").trim().split(" ");
  return (parts[0]?.[0] || "?").toUpperCase();
}
function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/* ---------------- Session ---------------- */
let SESSION = null;
try {
  SESSION = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
} catch (e) {
  SESSION = null;
}

function currentUser() {
  return SESSION;
}

function setSession(user) {
  SESSION = user;

  if (user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));

    // Login ใหม่ = เริ่มนับ Refresh ใหม่
    localStorage.removeItem("scms_refresh_tracker");
  } else {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem("scms_refresh_tracker");
  }
}

/* ---------------- Refresh Logout Test ---------------- */
const REFRESH_TRACKER_KEY = "scms_refresh_tracker";
const REFRESH_LIMIT = 3;
const REFRESH_WINDOW = 5 * 60 * 1000; // 5 นาที

function checkRefreshLimit() {
  // ยังไม่ได้ Login ไม่ต้องนับ
  if (!SESSION) return false;

  const now = Date.now();

  let tracker;

  try {
    tracker = JSON.parse(
      localStorage.getItem(REFRESH_TRACKER_KEY) || "null"
    );
  } catch (e) {
    tracker = null;
  }

  // ไม่มีข้อมูล หรือเกิน 5 นาทีแล้ว → เริ่มรอบใหม่
  if (
    !tracker ||
    !tracker.firstRefresh ||
    now - tracker.firstRefresh > REFRESH_WINDOW
  ) {
    tracker = {
      count: 1,
      firstRefresh: now
    };
  } else {
    tracker.count += 1;
  }

  localStorage.setItem(
    REFRESH_TRACKER_KEY,
    JSON.stringify(tracker)
  );

  // Refresh ครั้งที่ 3 → Logout
  if (tracker.count >= REFRESH_LIMIT) {
    SESSION = null;
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(REFRESH_TRACKER_KEY);

    return true;
  }

  return false;
}

/* ---------------- App state (client-side cache of backend data) ---------------- */
let state = {
  view: SESSION ? "feed" : "auth",
  activeRoom: "all",
  filterStatus: "all",
  search: "",
  openPostId: null,
  authTab: "login",
  adminTab: "reports",
  loading: false,
  authError: "",
  categories: [],
  posts: [],
  commentsByPost: {},
  reports: [],
  users: [],
  _openPostCache: null,
};

function roomById(id) { return state.categories.find(r => r.id === id); }
function roomColor(roomId) {
  const idx = state.categories.findIndex(r => r.id === roomId);
  return ROOM_COLORS[idx >= 0 ? idx % ROOM_COLORS.length : 0];
}

/* ---------------- Root render ---------------- */
function render() {
  const app = document.getElementById('app');
  const user = currentUser();
  if (!user) {
    app.innerHTML = renderAuth();
    bindAuthEvents();
    return;
  }
  app.innerHTML = renderShell(user);
  bindShellEvents(user);
}

let timeRefreshTimer = null;

function startTimeRefresh() {
  if (timeRefreshTimer) {
    clearInterval(timeRefreshTimer);
  }

  timeRefreshTimer = setInterval(() => {
    if (!currentUser()) return;
    render();
  }, 30000);
}

startTimeRefresh();

/* ================= AUTH ================= */
function renderAuth() {
  const isLogin = state.authTab === "login";
  return `
  <div class="auth-wrap">
    <div class="auth-card">
      <div class="auth-logo"><div class="brand-mark">SC</div><span>SCMS</span></div>
      <h1>คอมมูนิตี้ช่วยเหลือและจัดการเรื่องร้องเรียนภายในสถาบัน</h1>
      <div class="auth-tabs">
        <button data-authtab="login" class="${isLogin ? 'active' : ''}">เข้าสู่ระบบ</button>
        <button data-authtab="register" class="${!isLogin ? 'active' : ''}">สมัครสมาชิก</button>
      </div>
      ${state.authError ? `<div class="err-msg">${escapeHtml(state.authError)}</div>` : ''}
      ${isLogin ? renderLoginForm() : renderRegisterForm()}
      <div class="demo-box">
        <b>เชื่อมต่อกับ backend จริงแล้ว</b>
        ใช้บัญชีที่มีอยู่ในฐานข้อมูล PostgreSQL ของคุณ (ตาราง Users) เพื่อเข้าสู่ระบบ
        เช่น Phitchayathida@cdti.ac.th / Admin123 หรือสมัครสมาชิกใหม่ด้วยอีเมล @cdti.ac.th
      </div>
    </div>
  </div>`;
}
function renderLoginForm() {
  return `
  <form id="login-form">
    <div class="field"><label>อีเมลสถาบัน</label><input type="email" id="login-email" placeholder="name@cdti.ac.th" required></div>
    <div class="field"><label>รหัสผ่าน</label><input type="password" id="login-pass" placeholder="••••••••" required></div>
    <button type="submit" class="btn btn-primary btn-block" ${state.loading ? 'disabled' : ''}>${state.loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}</button>
  </form>`;
}
function renderRegisterForm() {
  return `
  <form id="register-form">
    <div class="field"><label>ชื่อ-นามสกุล</label><input type="text" id="reg-name" placeholder="เช่น สมหญิง ใจดี" required></div>
    <div class="field"><label>อีเมลสถาบัน <span class="hint">(ต้องลงท้ายด้วย @cdti.ac.th)</span></label><input type="email" id="reg-email" placeholder="name@cdti.ac.th" required></div>
    <div class="field"><label>รหัสผ่าน <span class="hint">(อย่างน้อย 4 ตัวอักษร)</span></label><input type="password" id="reg-pass" required></div>
    <div class="field">
      <label>บทบาท</label>
      <select id="reg-role">
        <option value="student">นักศึกษา</option>
        <option value="teacher">อาจารย์</option>
        <option value="staff">บุคลากร</option>
      </select>
    </div>
    <button type="submit" class="btn btn-primary btn-block" ${state.loading ? 'disabled' : ''}>${state.loading ? 'กำลังสมัคร...' : 'สมัครสมาชิก'}</button>
  </form>`;
}
function bindAuthEvents() {
  document.querySelectorAll('[data-authtab]').forEach(btn => {
    btn.onclick = () => { state.authTab = btn.dataset.authtab; state.authError = ""; render(); };
  });
  const loginForm = document.getElementById('login-form');
  if (loginForm) loginForm.onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-pass').value;
    state.loading = true; state.authError = ""; render();
    try {
      const user = await Api.login(email, pass);
      setSession(user);
      state.view = "feed";
      toast("เข้าสู่ระบบสำเร็จ ยินดีต้อนรับ " + user.name, "good");
      state.loading = false;
      await bootAfterLogin();
    } catch (err) {
      state.authError = err.message;
      state.loading = false; render();
    }
  };
  const regForm = document.getElementById('register-form');
  if (regForm) regForm.onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const pass = document.getElementById('reg-pass').value;
    const role = document.getElementById('reg-role').value;
    state.loading = true; state.authError = ""; render();
    try {
      const user = await Api.register(name, email, pass, role);
      setSession(user);
      state.view = "feed";
      toast("สมัครสมาชิกสำเร็จ! ยินดีต้อนรับสู่ SCMS", "good");
      state.loading = false;
      await bootAfterLogin();
    } catch (err) {
      state.authError = err.message;
      state.loading = false; render();
    }
  };

}

/* ---------------- Data loading ---------------- */
async function bootAfterLogin() {
  try {
    state.categories = await Api.getCategories();
    await enterView(currentUser());
  } catch (err) {
    toast(err.message, "bad");
    render();
  }
}
async function loadFeed() {
  const status = state.filterStatus === 'all' ? undefined : state.filterStatus;
  state.posts = await Api.getPosts({ status, roomId: state.activeRoom === 'all' ? undefined : state.activeRoom, search: state.search || undefined });
}
async function loadArchive() {
  state.posts = await Api.getPosts({ status: 'archive', roomId: state.activeRoom === 'all' ? undefined : state.activeRoom, search: state.search || undefined });
}
async function loadReports(user) {
  state.reports = await Api.getReports(user.role === 'admin' ? undefined : user.id);
}
async function loadUsers() {
  state.users = await Api.getUsers();
}
async function loadComments(postId) {
  state.commentsByPost[postId] = await Api.getComments(postId);
}
async function enterView(user) {
  try {
    if (state.view === 'feed') await loadFeed();
    if (state.view === 'archive') await loadArchive();
    if (state.view === 'report-issue') await loadReports(user);
    if (state.view === 'admin') { await Promise.all([loadReports(user), loadUsers()]); }
  } catch (err) { toast(err.message, "bad"); }
  render();
}

/* ================= SHELL ================= */
function renderShell(user) {
  return `
  <div class="topbar">
    <div class="topbar-inner">
      <div class="brand"><div class="brand-mark">SC</div><span class="brand-text">SCMS</span></div>
      <button class="hamburger" id="hamburger">☰</button>
      <nav class="topnav" id="topnav">
        <button data-nav="feed" class="${state.view === 'feed' ? 'active' : ''}">ฟีดชุมชน</button>
        <button data-nav="archive" class="${state.view === 'archive' ? 'active' : ''}">คลังประวัติ</button>
        <button data-nav="report-issue" class="${state.view === 'report-issue' ? 'active' : ''}">แจ้งปัญหาระบบ</button>
        ${user.role === 'admin' ? `<button data-nav="admin" class="${state.view === 'admin' ? 'active' : ''}">แผงควบคุมแอดมิน</button>` : ''}
      </nav>
      <div class="topbar-spacer"></div>
      <div class="topbar-user">
        <div class="userbtn">
          <div class="avatar">${initials(user.name)}</div>
          <div>${escapeHtml(user.name)}</div>
          <span class="role-chip">${roleLabel(user.role)}</span>
        </div>
        <button class="btn btn-ghost btn-sm" id="logout-btn" style="color:#fff;border-color:rgba(255,255,255,.35);">ออกจากระบบ</button>
      </div>
    </div>
  </div>
  <div class="layout">
    ${state.view !== 'admin' ? renderSidebar() : ''}
    <div class="main" id="main-view">${renderView(user)}</div>
  </div>
  <div class="foot-note">SCMS — เชื่อมต่อกับ backend PostgreSQL จริงผ่าน REST API (${window.SCMS_API_BASE || '/api'})</div>
  ${state.openPostId ? renderPostModal(user) : ''}
  `;
}
function renderSidebar() {
  return `
  <div class="sidebar">
    <div class="sidebar-card">
      <div class="sidebar-title">ห้อง / หมวดหมู่</div>
      <div class="room-item ${state.activeRoom === 'all' ? 'active' : ''}" data-room="all">
        <div class="room-dot" style="background:#1B4C8C;"></div>ทั้งหมด
      </div>
      ${state.categories.map(r => `
        <div class="room-item ${state.activeRoom === r.id ? 'active' : ''}" data-room="${r.id}">
          <div class="room-dot" style="background:${roomColor(r.id)};"></div>
          ${escapeHtml(r.name)}
        </div>
      `).join('')}
    </div>
    <div class="sidebar-card">
      <div class="sidebar-title">เกี่ยวกับห้องนี้</div>
      <div style="font-size:13px;color:var(--ink-soft);line-height:1.6;">
        ${state.activeRoom === 'all' ? 'พื้นที่รวมทุกโพสต์จากทุกฝ่ายและตึกในสถาบัน' : escapeHtml(roomById(state.activeRoom)?.description || '')}
      </div>
    </div>
  </div>`;
}
function renderView(user) {
  if (state.view === 'feed') return renderFeed();
  if (state.view === 'archive') return renderArchive();
  if (state.view === 'report-issue') return renderReportIssue();
  if (state.view === 'admin' && user.role === 'admin') return renderAdmin();
  return renderFeed();
}
function bindShellEvents(user) {
  const hb = document.getElementById('hamburger');
  if (hb) hb.onclick = () => document.getElementById('topnav').classList.toggle('open');
  document.querySelectorAll('[data-nav]').forEach(btn => {
    btn.onclick = async () => {
      state.view = btn.dataset.nav; state.openPostId = null;
      await enterView(user);
    };
  });
  document.getElementById('logout-btn').onclick = () => {
    setSession(null);
    state.view = 'auth';
    toast("ออกจากระบบแล้ว");
    render();
  };
  document.querySelectorAll('[data-room]').forEach(el => {
    el.onclick = async () => {
      state.activeRoom = el.dataset.room;
      if (state.view === 'archive') await loadArchive(); else await loadFeed();
      render();
    };
  });
  bindViewEvents(user);
}

/* ================= FEED / ARCHIVE ================= */
function renderFeed() {
  return `
  <div class="page-head">
    <div><h1>ฟีดชุมชน</h1><p>โพสต์ปัญหา สอบถาม หรือชวนติวหนังสือร่วมกันในสถาบัน</p></div>
    <button class="btn btn-accent" id="new-post-btn">+ สร้างโพสต์ใหม่</button>
  </div>
  <div class="feed-toolbar">
    <div class="search-box">🔎<input type="text" id="search-input" placeholder="ค้นหาโพสต์..." value="${escapeHtml(state.search)}"></div>
    <div class="filter-pills">
      <button class="pill ${state.filterStatus === 'all' ? 'active' : ''}" data-status="all">ทั้งหมด</button>
      <button class="pill ${state.filterStatus === 'open' ? 'active' : ''}" data-status="open">เปิดปัญหา</button>
      <button class="pill ${state.filterStatus === 'in_progress' ? 'active' : ''}" data-status="in_progress">กำลังดำเนินการ</button>
    </div>
  </div>
  <div id="post-list">${renderPostList(state.posts)}</div>`;
}
function renderArchive() {
  return `
  <div class="page-head"><div><h1>คลังประวัติ</h1><p>โพสต์ที่สำเร็จแล้ว/ปิดงานแล้ว จะถูกย้ายมาเก็บไว้ที่นี่โดยอัตโนมัติ</p></div></div>
  <div class="feed-toolbar"><div class="search-box">🔎<input type="text" id="search-input" placeholder="ค้นหาในคลังประวัติ..." value="${escapeHtml(state.search)}"></div></div>
  <div id="post-list">${renderPostList(state.posts)}</div>`;
}
function renderPostList(posts) {
  if (!posts.length) return `<div class="empty-state"><h3>ยังไม่มีโพสต์ในตอนนี้</h3><p>เป็นคนแรกที่แจ้งปัญหา สอบถาม หรือชวนติวหนังสือในห้องนี้เลย</p></div>`;
  return posts.map(renderPostCard).join('');
}
function statusBadge(status) {
  if (status === 'resolved') return `<span class="badge badge-closed">สำเร็จแล้ว</span>`;
  if (status === 'closed') return `<span class="badge badge-closed">ปิดงานแล้ว</span>`;
  if (status === 'in_progress') return `<span class="badge badge-progress">กำลังดำเนินการ</span>`;
  return `<span class="badge badge-open">เปิดปัญหา</span>`;
}
function renderPostCard(p) {
  return `
  <div class="post-card" data-open-post="${p.id}">
    <div class="post-top">
      <div class="avatar">${initials(p.authorName)}</div>
      <div>
        <div class="post-meta-name">${escapeHtml(p.authorName || 'ผู้ใช้')}</div>
        <div class="post-meta-sub">${fmtTime(p.createdAt)}</div>
      </div>
      <div style="margin-left:auto;display:flex;gap:6px;align-items:center;">
        <span class="post-room" style="background:${roomColor(p.roomId)}">${escapeHtml(p.roomName || '')}</span>
        ${statusBadge(p.status)}
      </div>
    </div>
    <div class="post-title">${escapeHtml(p.title)}</div>
    <p class="post-body">${escapeHtml(p.body)}</p>
    ${p.image ? `<div class="post-imgs"><img class="post-image-clickable" src="${p.image}" alt="รูปภาพโพสต์"></div>` : ''}
    <div class="post-foot">
      ${(p.status === 'resolved' || p.status === 'closed') ? `<span>✅ ปิดงานแล้ว</span>` : `<span>💬 ดูรายละเอียด/คอมเมนต์</span>`}
    </div>
  </div>`;
}

/* ================= REPORT ISSUE ================= */
function renderReportIssue() {
  const myReports = state.reports;
  return `
  <div class="page-head"><div><h1>แจ้งปัญหาตัวระบบ</h1><p>พบบั๊กหรือปัญหาการใช้งานเว็บไซต์? แจ้งให้แอดมินทราบได้ที่นี่</p></div></div>
  <div class="sidebar-card" style="max-width:640px;">
    <form id="issue-form">
      <div class="field"><label>หัวข้อปัญหา</label><input type="text" id="issue-title" placeholder="เช่น ปุ่มแนบรูปกดไม่ติด" required></div>
      <div class="field"><label>รายละเอียดข้อผิดพลาด/บั๊ก</label><textarea id="issue-detail" required></textarea></div>
      <div class="field">
        <label>แนบภาพหน้าจอ <span class="hint">(ถ้ามี)</span></label>
        <input type="file" id="issue-img" accept="image/*">
        <div class="attach-preview" id="issue-img-preview"></div>
      </div>
      <button type="submit" class="btn btn-primary">ส่งเรื่องแจ้งปัญหา</button>
    </form>
  </div>
  <h3 style="margin:26px 0 10px;color:var(--blue-deep);">รายการที่คุณเคยแจ้ง</h3>
  <div class="table-wrap"><table>
    <thead><tr><th>รหัสรายงาน</th><th>หัวข้อ</th><th>วันที่แจ้ง</th><th>สถานะ</th></tr></thead>
    <tbody>
      ${myReports.length ? myReports.map(r => `
        <tr><td>${r.id}</td><td>${escapeHtml(r.title)}</td><td>${fmtTime(r.createdAt)}</td>
        <td>${reportBadge(r.status)}</td></tr>
      `).join('') : `<tr><td colspan="4" style="text-align:center;color:var(--ink-soft);padding:20px;">ยังไม่มีรายการที่คุณแจ้ง</td></tr>`}
    </tbody>
  </table></div>`;
}
function reportBadge(status) {
  if (status === 'resolved') return '<span class="badge badge-closed">แก้ไขแล้ว</span>';
  if (status === 'in_progress') return '<span class="badge badge-progress">กำลังแก้ไข</span>';
  return '<span class="badge badge-open">รอตรวจสอบ</span>';
}

/* ================= ADMIN ================= */
function renderAdmin() {
  return `
  <div class="page-head"><div><h1>แผงควบคุมแอดมิน</h1><p>จัดการผู้ใช้ ห้อง/หมวดหมู่ และรายงานปัญหาระบบ</p></div></div>
  <div class="stat-row">
    <div class="stat-card"><div class="stat-num">${state.users.length}</div><div class="stat-label">ผู้ใช้งานทั้งหมด</div></div>
    <div class="stat-card"><div class="stat-num">${state.categories.length}</div><div class="stat-label">ห้อง/หมวดหมู่</div></div>
    <div class="stat-card"><div class="stat-num">${state.reports.filter(r => r.status !== 'resolved').length}</div><div class="stat-label">รายงานบั๊กที่รอดำเนินการ</div></div>
  </div>
  <div class="admintabs">
    <button data-admintab="reports" class="${state.adminTab === 'reports' ? 'active' : ''}">รายงานปัญหาระบบ</button>
    <button data-admintab="users" class="${state.adminTab === 'users' ? 'active' : ''}">ผู้ใช้งาน</button>
    <button data-admintab="rooms" class="${state.adminTab === 'rooms' ? 'active' : ''}">ห้อง/หมวดหมู่</button>
  </div>
  <div id="admin-panel">${renderAdminPanel()}</div>`;
}
function renderAdminPanel() {
  if (state.adminTab === 'reports') return renderAdminReports();
  if (state.adminTab === 'users') return renderAdminUsers();
  if (state.adminTab === 'rooms') return renderAdminRooms();
}
function renderAdminReports() {
  const reports = state.reports;
  return `
  <div class="table-wrap"><table>
    <thead><tr><th>รหัส</th><th>ผู้แจ้ง</th><th>หัวข้อ</th><th>รายละเอียด</th><th>วันที่</th><th>สถานะ</th><th>อัปเดตสถานะ</th></tr></thead>
    <tbody>
      ${reports.length ? reports.map(r => `
        <tr>
          <td>${r.id}</td><td>${escapeHtml(r.reporterName || '-')}</td><td>${escapeHtml(r.title)}</td>
          <td style="max-width:220px;">${escapeHtml((r.detail || '').slice(0, 80))}${(r.detail || '').length > 80 ? '…' : ''}</td>
          <td>${fmtTime(r.createdAt)}</td>
          <td>${reportBadge(r.status)}</td>
          <td>
            <select data-report-status="${r.id}">
              <option value="open" ${r.status === 'open' ? 'selected' : ''}>รอตรวจสอบ</option>
              <option value="in_progress" ${r.status === 'in_progress' ? 'selected' : ''}>กำลังแก้ไข</option>
              <option value="resolved" ${r.status === 'resolved' ? 'selected' : ''}>แก้ไขแล้ว</option>
            </select>
          </td>
        </tr>`).join('') : `<tr><td colspan="7" style="text-align:center;color:var(--ink-soft);padding:20px;">ไม่มีรายงานปัญหา</td></tr>`}
    </tbody>
  </table></div>`;
}
function renderAdminUsers() {
  const users = [...state.users].sort((a, b) => a.name.localeCompare(b.name, 'th'));
  return `
  <div class="table-wrap"><table>
    <thead><tr><th>ชื่อ-นามสกุล</th><th>อีเมล</th><th>บทบาท</th><th></th></tr></thead>
    <tbody>
      ${users.map(u => `
        <tr>
          <td>${escapeHtml(u.name)}</td><td>${escapeHtml(u.email)}</td>
          <td>
            <select data-role-select="${u.id}" ${u.id === currentUser().id ? 'disabled title="ไม่สามารถแก้ไขบทบาทตัวเองได้"' : ''}>
              <option value="student" ${u.role === 'student' ? 'selected' : ''}>นักศึกษา</option>
              <option value="teacher" ${u.role === 'teacher' ? 'selected' : ''}>อาจารย์</option>
              <option value="staff" ${u.role === 'staff' ? 'selected' : ''}>บุคลากร</option>
              <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>แอดมิน</option>
            </select>
          </td>
          <td>${u.id !== currentUser().id ? `<button class="btn btn-sm btn-danger" data-remove-user="${u.id}">ลบผู้ใช้</button>` : `<span class="hint">คุณ</span>`}</td>
        </tr>`).join('')}
    </tbody>
  </table></div>`;
}
function renderAdminRooms() {
  return `
  <div class="sidebar-card" style="max-width:520px;">
    <div class="sidebar-title">เพิ่มห้อง/หมวดหมู่ใหม่</div>
    <form id="room-form">
      <div class="field"><label>ชื่อห้อง</label><input type="text" id="room-name" required></div>
      <div class="field"><label>คำอธิบาย</label><input type="text" id="room-desc"></div>
      <button type="submit" class="btn btn-primary">เพิ่มห้อง</button>
    </form>
  </div>
  <div class="table-wrap" style="margin-top:16px;"><table>
    <thead><tr><th>ห้อง</th><th>คำอธิบาย</th><th></th></tr></thead>
    <tbody>
      ${state.categories.map(r => `
        <tr>
          <td><span class="post-room" style="background:${roomColor(r.id)}">${escapeHtml(r.name)}</span></td>
          <td>${escapeHtml(r.description || '-')}</td>
          <td><button class="btn btn-sm btn-danger" data-remove-room="${r.id}">ลบห้อง</button></td>
        </tr>`).join('')}
    </tbody>
  </table></div>`;
}

/* ================= POST DETAIL MODAL ================= */
function renderPostModal(user) {
  const p = state._openPostCache || state.posts.find(x => String(x.id) === String(state.openPostId)); if (!p) return '';
  state._openPostCache = p;
  const comments = state.commentsByPost[p.id] || [];
  const isOpenIssue = p.status === 'open' || p.status === 'in_progress';
  const isAuthor = p.authorId === user.id;
  const isStaffLike = user.role === 'admin' || user.role === 'staff' || user.role === 'teacher';
  return `
  <div class="overlay" id="post-overlay">
    <div class="modal">
      <div class="modal-head"><h2>รายละเอียดโพสต์</h2><button class="close-x" id="close-modal">✕</button></div>
      <div class="post-top">
        <div class="avatar">${initials(p.authorName)}</div>
        <div><div class="post-meta-name">${escapeHtml(p.authorName || 'ผู้ใช้')}</div><div class="post-meta-sub">${fmtTime(p.createdAt)}</div></div>
        <div style="margin-left:auto;display:flex;gap:6px;">
          <span class="post-room" style="background:${roomColor(p.roomId)}">${escapeHtml(p.roomName || '')}</span>
          ${statusBadge(p.status)}
        </div>
      </div>
      <h3 style="margin:14px 0 6px;">${escapeHtml(p.title)}</h3>
      <p style="font-size:14.5px;line-height:1.7;white-space:pre-wrap;">${escapeHtml(p.body)}</p>
      ${p.image ? `<div class="detail-imgs"><img class="post-image-clickable" src="${p.image}" alt="รูปภาพโพสต์"></div>` : ''}
      <div style="display:flex;gap:8px;margin:16px 0;flex-wrap:wrap;">
        ${isOpenIssue && isAuthor ? `<button class="btn btn-primary btn-sm" id="resolve-btn">📌 ปักหมุดปิดปัญหา (สำเร็จแล้ว)</button>` : ''}
        ${isOpenIssue && isStaffLike ? `<button class="btn btn-accent btn-sm" id="admin-close-btn">🔒 ปิดงานแล้ว (โดย${roleLabel(user.role)})</button>` : ''}
        ${p.status === 'open' && isStaffLike ? `<button class="btn btn-ghost btn-sm" id="mark-progress-btn">ทำเครื่องหมายว่ากำลังดำเนินการ</button>` : ''}
        ${(user.role === 'admin' || isAuthor) && isOpenIssue ? `<button class="btn btn-danger btn-sm" id="delete-post-btn">ลบโพสต์</button>` : ''}
      </div>
      <h4 style="margin:18px 0 10px;color:var(--blue-deep);">คอมเมนต์ (${comments.length})</h4>
      <div class="comments" style="max-height:360px;overflow-y:auto;padding-right:6px;">
  ${comments.length ? comments.map(c => {
    const canDeleteComment =
      String(c.authorId) === String(user.id) ||
      String(p.authorId) === String(user.id) ||
      user.role === "admin";

    return `
    <div class="comment">
      <div class="avatar" style="width:30px;height:30px;font-size:11px;">
        ${initials(c.authorName)}
      </div>

      <div class="comment-bubble">
        <div>
          <span class="comment-name">
            ${escapeHtml(c.authorName || 'ผู้ใช้')}
          </span>

          ${c.authorRole === 'staff' || c.authorRole === 'บุคลากร'
        ? '<span class="comment-role">บุคลากร</span>' : ''}

          ${c.authorRole === 'teacher' || c.authorRole === 'อาจารย์'
        ? '<span class="comment-role">อาจารย์</span>' : ''}

          ${c.authorRole === 'admin' || c.authorRole === 'Admin'
        ? '<span class="comment-role">แอดมิน</span>' : ''}

          <span class="comment-time">
            ${fmtTime(c.createdAt)}
          </span>

          ${canDeleteComment ? `
            <button
              class="comment-delete-btn"
              data-delete-comment="${c.id}"
              style="
                margin-left:8px;
                border:0;
                background:none;
                color:#c9503f;
                cursor:pointer;
                font-size:12px;
              "
            >
              ลบ
            </button>
          ` : ''}
        </div>

        <div class="comment-text">${escapeHtml(c.text || '')}</div>
        ${c.image ? `
          <div style="margin-top:8px;">
            <img
              class="comment-image"
              src="${c.image}"
              alt="รูปภาพในความคิดเห็น"
              style="
                max-width:220px;
                max-height:220px;
                width:auto;
                height:auto;
                object-fit:contain;
                border-radius:8px;
                border:1px solid var(--line);
                cursor:pointer;
                display:block;
              "
            >
          </div>
        ` : ''}
      </div>
    </div>`;
  }).join('') : `<p style="color:var(--ink-soft);font-size:13.5px;">ยังไม่มีคอมเมนต์</p>`}
</div>

${isOpenIssue ? `
<form id="comment-form" style="display:flex;gap:8px;margin-top:14px;align-items:center;">
  <input type="text" id="comment-input" placeholder="เขียนคอมเมนต์เพื่อช่วยเหลือ..." style="flex:1;border:1.5px solid var(--line);border-radius:8px;padding:10px 12px;font-size:14px;">

  <label for="comment-image" title="แนบรูปภาพ" style="cursor:pointer;font-size:20px;padding:6px;">
    🖼️
  </label>

  <input type="file" id="comment-image" accept="image/*" style="display:none;">

  <button class="btn btn-primary" type="submit">ส่ง</button>
</form>

<div id="comment-img-preview" style="margin-top:8px;"></div>
` : `<p style="margin-top:12px;color:var(--good);font-size:13.5px;">✅ โพสต์นี้จบงานแล้ว และถูกย้ายไปเก็บในคลังประวัติ</p>`}
    </div>
  </div>`;
}

/* ================= NEW POST MODAL ================= */
function renderNewPostModal() {
  return `
  <div class="overlay" id="newpost-overlay">
    <div class="modal">
      <div class="modal-head"><h2>สร้างโพสต์ใหม่</h2><button class="close-x" id="close-newpost">✕</button></div>
      <form id="newpost-form">
        <div class="field">
          <label>ห้อง/หมวดหมู่</label>
          <select id="np-room" required>
            ${state.categories.map(r => `<option value="${r.id}" ${state.activeRoom === r.id ? 'selected' : ''}>${escapeHtml(r.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>หัวข้อ</label><input type="text" id="np-title" required></div>
        <div class="field"><label>รายละเอียด</label><textarea id="np-body" required></textarea></div>
        <div class="field">
          <label>แนบรูปภาพ <span class="hint">(1 รูป — ตาราง Post เก็บได้ 1 รูปต่อโพสต์)</span></label>
          <input type="file" id="np-image" accept="image/*">
          <div class="attach-preview" id="np-img-preview"></div>
        </div>
        <button type="submit" class="btn btn-primary btn-block">โพสต์</button>
      </form>
    </div>
  </div>`;
}

/* ================= IMAGE VIEW ================= */
function bindPostImageEvents() {
  document.querySelectorAll('.post-imgs img, .detail-imgs img, .post-image-clickable').forEach(img => {
    if (img.dataset.imageBound === 'true') return;
    img.dataset.imageBound = 'true';
    img.style.cursor = 'zoom-in';

    img.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position:fixed;
        inset:0;
        background:rgba(0,0,0,.85);
        display:flex;
        align-items:center;
        justify-content:center;
        z-index:99999;
        cursor:pointer;
        padding:20px;
      `;

      const largeImg = document.createElement('img');
      largeImg.src = img.src;
      largeImg.alt = img.alt || 'รูปภาพ';
      largeImg.style.cssText = `
        max-width:95vw;
        max-height:90vh;
        object-fit:contain;
        border-radius:10px;
        cursor:default;
      `;
      largeImg.onclick = event => event.stopPropagation();

      overlay.appendChild(largeImg);
      overlay.onclick = () => overlay.remove();
      document.body.appendChild(overlay);
    };
  });
}

/* ================= EVENT BINDING ================= */
function bindViewEvents(user) {
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    let t;
    searchInput.oninput = () => {
      state.search = searchInput.value;
      clearTimeout(t);
      t = setTimeout(async () => {
        try {
          if (state.view === 'archive') await loadArchive();
          else await loadFeed();
          renderSoftFeed();
        } catch (err) {
          toast(err.message, 'bad');
        }
      }, 300);
    };
  }

  document.querySelectorAll('[data-status]').forEach(el => {
    el.onclick = async () => {
      state.filterStatus = el.dataset.status;
      await loadFeed();
      render();
    };
  });

  document.querySelectorAll('[data-open-post]').forEach(el => {
    el.onclick = async () => {
      try {
        const postId = el.dataset.openPost;
        state.openPostId = postId;
        state._openPostCache = await Api.getPost(postId);
        await loadComments(postId);
        render();
      } catch (err) {
        toast(err.message || 'ไม่สามารถโหลดรายละเอียดโพสต์ได้', 'bad');
      }
    };
  });

  const newPostBtn = document.getElementById('new-post-btn');
  if (newPostBtn) newPostBtn.onclick = () => openNewPostModal(user);

  document.querySelectorAll('[data-admintab]').forEach(el => {
    el.onclick = () => {
      state.adminTab = el.dataset.admintab;
      render();
    };
  });

  bindAdminEvents(user);
  bindIssueFormEvents(user);
  bindPostImageEvents();

  if (state.openPostId) bindModalEvents(user);
}

function renderSoftFeed() {
  const listEl = document.getElementById('post-list');
  if (!listEl) return;
  listEl.innerHTML = renderPostList(state.posts);
  bindPostImageEvents();
  bindViewEvents(currentUser());
}

function openNewPostModal(user) {
    const app = document.getElementById('app');
    const wrap = document.createElement('div');
    wrap.innerHTML = renderNewPostModal();
    app.appendChild(wrap.firstElementChild);
    let pendingImage = null;
    document.getElementById('close-newpost').onclick = () => document.getElementById('newpost-overlay').remove();
    document.getElementById('newpost-overlay').onclick = (e) => { if (e.target.id === 'newpost-overlay') e.target.remove(); };
    document.getElementById('np-image').onchange = async (e) => {
      if (e.target.files[0]) {
        pendingImage = await fileToDataURL(e.target.files[0]);
        document.getElementById('np-img-preview').innerHTML = `<div class="ap-item"><img src="${pendingImage}"></div>`;
      }
    };
    document.getElementById('newpost-form').onsubmit = async (e) => {
      e.preventDefault();
      const roomId = document.getElementById('np-room').value;
      const title = document.getElementById('np-title').value.trim();
      const body = document.getElementById('np-body').value.trim();
      if (!title || !body) return;
      try {
        await Api.createPost({ userId: user.id, roomId, title, body, image: pendingImage });
        document.getElementById('newpost-overlay').remove();
        state.activeRoom = roomId;
        toast("โพสต์สำเร็จแล้ว", "good");
        await loadFeed();
        render();
      } catch (err) { toast(err.message, "bad"); }
    };
  }

function bindModalEvents(user) {
    const overlay = document.getElementById('post-overlay');
    if (!overlay) return;
    overlay.onclick = (e) => { if (e.target.id === 'post-overlay') { state.openPostId = null; render(); } };
    document.getElementById('close-modal').onclick = () => { state.openPostId = null; render(); };
    const p = state._openPostCache;

    const resolveBtn = document.getElementById('resolve-btn');
    if (resolveBtn) resolveBtn.onclick = async () => {
      try {
        await Api.setPostStatus(p.id, 'resolved');
        toast("ปักหมุดปิดปัญหาแล้ว (สำเร็จแล้ว) ย้ายไปคลังประวัติ", "good");
        state.openPostId = null;
        await loadFeed(); render();
      } catch (err) { toast(err.message, "bad"); }
    };
    const adminCloseBtn = document.getElementById('admin-close-btn');
    if (adminCloseBtn) adminCloseBtn.onclick = async () => {
      try {
        await Api.setPostStatus(p.id, 'closed');
        toast("ปิดงานแล้ว ย้ายไปคลังประวัติ", "good");
        state.openPostId = null;
        await loadFeed(); render();
      } catch (err) { toast(err.message, "bad"); }
    };
    const progBtn = document.getElementById('mark-progress-btn');
    if (progBtn) progBtn.onclick = async () => {
      try {
        const updated = await Api.setPostStatus(p.id, 'in_progress');
        state._openPostCache = { ...p, status: updated.status };
        toast("ทำเครื่องหมายว่ากำลังดำเนินการแล้ว", "good");
        await loadFeed(); render();
      } catch (err) { toast(err.message, "bad"); }
    };
    const delBtn = document.getElementById('delete-post-btn');
    if (delBtn) delBtn.onclick = async () => {
      if (!confirm('ยืนยันการลบโพสต์นี้?')) return;
      try {
        await Api.deletePost(p.id);
        state.openPostId = null;
        toast("ลบโพสต์แล้ว", "good");
        await loadFeed(); render();
      } catch (err) { toast(err.message, "bad"); }
    };
    const cForm = document.getElementById('comment-form');
    if (cForm) {
      let pendingCommentImage = null;

      const imageInput = document.getElementById('comment-image');
      const imagePreview = document.getElementById('comment-img-preview');

      if (imageInput) {
        imageInput.onchange = async (e) => {
          const file = e.target.files[0];

          if (!file) {
            pendingCommentImage = null;
            if (imagePreview) imagePreview.innerHTML = '';
            return;
          }

          pendingCommentImage = await fileToDataURL(file);

          if (imagePreview) {
            imagePreview.innerHTML = `
          <div style="position:relative;display:inline-block;">
            <img
              src="${pendingCommentImage}"
              style="
                width:100px;
                height:100px;
                object-fit:cover;
                border-radius:8px;
                border:1px solid var(--line);
              "
            >
          </div>
        `;
          }
        };
      }

      cForm.onsubmit = async (e) => {
        e.preventDefault();

        const input = document.getElementById('comment-input');
        const text = input.value.trim();

        if (!text && !pendingCommentImage) return;

        try {
          await Api.addComment(p.id, user.id, text, pendingCommentImage);
          await loadComments(p.id);
          render();
        } catch (err) {
          toast(err.message, "bad");
        }
      };
    }
    document.querySelectorAll('[data-delete-comment]').forEach(btn => {
      btn.onclick = async () => {
        const commentId = btn.dataset.deleteComment;

        if (!confirm('ยืนยันการลบความคิดเห็นนี้?')) return;

        try {
          await Api.deleteComment(commentId, user.id);

          toast("ลบความคิดเห็นแล้ว", "good");

          await loadComments(p.id);

          render();

        } catch (err) {
          toast(err.message, "bad");
        }
      };
    });
  }

  function bindIssueFormEvents(user) {
    const form = document.getElementById('issue-form');
    if (!form) return;
    let pendingImg = null;
    document.getElementById('issue-img').onchange = async (e) => {
      if (e.target.files[0]) {
        pendingImg = await fileToDataURL(e.target.files[0]);
        document.getElementById('issue-img-preview').innerHTML = `<div class="ap-item"><img src="${pendingImg}"></div>`;
      }
    };
    form.onsubmit = async (e) => {
      e.preventDefault();
      const title = document.getElementById('issue-title').value.trim();
      const detail = document.getElementById('issue-detail').value.trim();
      if (!title || !detail) return;
      try {
        await Api.createReport(user.id, title, detail, pendingImg);
        toast("ส่งเรื่องแจ้งปัญหาเรียบร้อยแล้ว ขอบคุณที่ช่วยแจ้ง", "good");
        await loadReports(user);
        render();
      } catch (err) { toast(err.message, "bad"); }
    };
  }
  function bindAdminEvents(user) {
    document.querySelectorAll('[data-report-status]').forEach(sel => {
      sel.onchange = async () => {
        try { await Api.updateReportStatus(sel.dataset.reportStatus, sel.value); toast('อัปเดตสถานะรายงานแล้ว', 'good'); await loadReports(user); render(); }
        catch (err) { toast(err.message, 'bad'); }
      };
    });
    document.querySelectorAll('[data-role-select]').forEach(sel => {
      sel.onchange = async () => {
        try { await Api.updateUserRole(sel.dataset.roleSelect, sel.value); toast('อัปเดตบทบาทผู้ใช้แล้ว', 'good'); await loadUsers(); render(); }
        catch (err) { toast(err.message, 'bad'); }
      };
    });
    document.querySelectorAll('[data-remove-user]').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('ยืนยันการลบผู้ใช้นี้?')) return;
        try { await Api.removeUser(btn.dataset.removeUser); toast('ลบผู้ใช้แล้ว', 'good'); await loadUsers(); render(); }
        catch (err) { toast(err.message, 'bad'); }
      };
    });
    const roomForm = document.getElementById('room-form');
    if (roomForm) roomForm.onsubmit = async (e) => {
      e.preventDefault();
      const name = document.getElementById('room-name').value.trim();
      const desc = document.getElementById('room-desc').value.trim();
      if (!name) return;
      try {
        await Api.addCategory(name, desc);
        state.categories = await Api.getCategories();
        toast('เพิ่มห้องใหม่แล้ว', 'good');
        render();
      } catch (err) { toast(err.message, 'bad'); }
    };
    document.querySelectorAll('[data-remove-room]').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('ยืนยันการลบห้องนี้? ลบไม่ได้ถ้ายังมีโพสต์อยู่ในห้องนี้')) return;
        try {
          await Api.deleteCategory(btn.dataset.removeRoom);
          state.categories = await Api.getCategories();
          toast('ลบห้องแล้ว', 'good');
          render();
        } catch (err) { toast(err.message, 'bad'); }
      };
    });
    document.querySelectorAll('.comment-image').forEach(img => {
      img.onclick = (e) => {
        e.stopPropagation();

        const overlay = document.createElement('div');

        overlay.style.cssText = `
      position:fixed;
      inset:0;
      background:rgba(0,0,0,.85);
      display:flex;
      align-items:center;
      justify-content:center;
      z-index:9999;
      cursor:pointer;
      padding:20px;
    `;
        overlay.innerHTML = `
      <img
        src="${img.src}"
        style="
          max-width:95vw;
          max-height:90vh;
          object-fit:contain;
          border-radius:10px;
        ">`;
        overlay.onclick = () => overlay.remove();
        document.body.appendChild(overlay);
      };
    });
  }



  /* ---------------- Init ---------------- */
  (async function init() {

    // ตรวจ Refresh หลังจากโหลด SESSION แล้ว
    const forcedLogout = checkRefreshLimit();

    if (forcedLogout) {
      state.view = "auth";
      state.authTab = "login";
      state.authError = "";
    }

    render();

    if (currentUser()) {
      try {
        state.categories = await Api.getCategories();
        await enterView(currentUser());
      } catch (err) {
        toast(err.message, "bad");
      }
    }
  })();