let slotCount = 0;

// ── AUTH GUARD ──
function getAdminToken() {
  return localStorage.getItem("sp_admin_token");
}

function adminLogout() {
  localStorage.removeItem("sp_admin_token");
  localStorage.removeItem("sp_admin");
  window.location.href = "admin-login.html";
}

// Redirect if not admin
if (!getAdminToken()) {
  window.location.href = "admin-login.html";
}

// Set admin name in nav
const adminData = JSON.parse(localStorage.getItem("sp_admin") || "{}");
if (adminData.name) {
  document.getElementById("adminName").textContent  = adminData.name.split(" ")[0];
  document.getElementById("adminAvatar").textContent = adminData.name[0].toUpperCase();
}

// ── INIT ──
window.addEventListener("DOMContentLoaded", async () => {
  await loadStats();
  await loadStudents();
});

// ── TABS ──
function switchTab(tab, activeEl) {
  event.preventDefault();

  ["students", "courses", "teachers", "fees"].forEach(t => {
    const section = document.getElementById("tab-" + t);
    if (section) section.style.display = "none";
  });

  const selected = document.getElementById("tab-" + tab);
  if (selected) selected.style.display = "block";

  document.querySelectorAll(".admin-nav-links a").forEach(function(a) {
    a.classList.remove("active");
  });

  if (activeEl) activeEl.classList.add("active");

  const titles = {
    students: ["All Students",    "View and manage student accounts."],
    courses:  ["Manage Courses",  "Add and remove courses."],
    teachers: ["Manage Teachers", "Add teachers and assign courses."],
    fees:     ["Fee Management",  "Add and manage student fees."]
  };

  document.getElementById("pageTitle").textContent    = titles[tab][0];
  document.getElementById("pageSubtitle").textContent = titles[tab][1];

  if (tab === "courses")  loadCourses();
  if (tab === "teachers") loadTeachers();
  if (tab === "students") loadStudents();
  if (tab === "fees")     loadFees();
}

// ── STATS ──
async function loadStats() {
  const res  = await fetch(`${API}/admin/stats`, {
    headers: { "Authorization": "Bearer " + getAdminToken() }
  });
  if (!res.ok) { adminLogout(); return; }
  const data = await res.json();
  document.getElementById("statStudents").textContent    = data.total_students;
  document.getElementById("statVerified").textContent    = data.verified_students;
  document.getElementById("statCourses").textContent     = data.total_courses;
  document.getElementById("statEnrollments").textContent = data.total_enrollments;
}

// ── STUDENTS ──
async function loadStudents() {
  const res      = await fetch(`${API}/admin/students`, {
    headers: { "Authorization": "Bearer " + getAdminToken() }
  });
  const students = await res.json();
  const tbody    = document.getElementById("studentsBody");

  if (!students.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:2rem;">No students registered yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = students.map(s => {
    const attColor = s.attendance_pct >= 75 ? "var(--green)" : s.attendance_pct >= 50 ? "var(--gold)" : "var(--red)";
    return `
      <tr onclick="viewStudent('${s._id}')" title="Click to view details">
        <td style="font-weight:600;">${s.name}</td>
        <td style="color:var(--muted);font-size:0.82rem;">${s.email}</td>
        <td><span class="status-badge ${s.is_verified ? "status-verified" : ""}">${s.is_verified ? "Verified" : "Pending"}</span></td>
        <td>${s.enrolled_courses.length}</td>
        <td>${s.total_credits}</td>
        <td>
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-weight:600;color:${attColor};font-size:0.82rem;">${s.attendance_pct}%</span>
          </div>
        </td>
        <td style="color:var(--muted);font-size:0.8rem;">${s.created_at}</td>
        <td onclick="event.stopPropagation()" style="display:flex;gap:6px;">
          <button class="btn-sm btn-sm-toggle" onclick="toggleUser('${s._id}')">${s.is_active ? "Deactivate" : "Activate"}</button>
          <button class="btn-sm btn-sm-danger" onclick="deleteUser('${s._id}','${s.name}')">Delete</button>
        </td>
      </tr>`;
  }).join("");
}

// ── STUDENT DETAIL MODAL ──
async function viewStudent(id) {
  document.getElementById("studentModal").classList.add("open");
  document.getElementById("modalContent").innerHTML = `<div class="spinner"></div>`;

  const res  = await fetch(`${API}/admin/students/${id}`, {
    headers: { "Authorization": "Bearer " + getAdminToken() }
  });
  const data = await res.json();

  document.getElementById("modalStudentName").textContent = data.name;

  if (!data.courses.length) {
    document.getElementById("modalContent").innerHTML = `
      <p style="color:var(--muted);text-align:center;padding:2rem;">No courses enrolled yet.</p>`;
    return;
  }

  document.getElementById("modalContent").innerHTML = `
    <p style="color:var(--muted);font-size:0.85rem;margin-bottom:1.2rem;">📧 ${data.email} &nbsp;·&nbsp; 📅 Joined ${data.joined}</p>
    <div style="font-family:var(--font-head);font-size:0.75rem;text-transform:uppercase;letter-spacing:0.6px;color:var(--muted);margin-bottom:0.8rem;">Enrolled Courses</div>
    ${data.courses.map(c => {
      const attColor = c.attendance >= 75 ? "var(--green)" : c.attendance >= 50 ? "var(--gold)" : "var(--red)";
      const slots    = c.slots.map(s => `${s.day.slice(0,3)} ${s.start}`).join(", ");
      return `
        <div class="student-course-row">
          <div>
            <div style="font-weight:600;font-size:0.9rem;">${c.name} <span style="background:var(--accent-light);color:var(--accent);padding:1px 7px;border-radius:4px;font-size:0.7rem;font-weight:700;margin-left:4px;">${c.code}</span></div>
            <div style="font-size:0.78rem;color:var(--muted);margin-top:2px;">${slots} &nbsp;·&nbsp; ${c.credits} credits</div>
          </div>
          <div style="text-align:right;">
            <div style="font-weight:700;color:${attColor};font-size:0.9rem;">${c.attendance}%</div>
            <div style="font-size:0.72rem;color:var(--muted);">attendance</div>
            <div class="att-bar"><div class="att-bar-fill" style="width:${c.attendance}%;background:${attColor};"></div></div>
          </div>
        </div>`;
    }).join("")}`;
}

function closeModal() {
  document.getElementById("studentModal").classList.remove("open");
}

// Close modal on overlay click
document.getElementById("studentModal").addEventListener("click", function(e) {
  if (e.target === this) closeModal();
});

// ── TOGGLE / DELETE USER ──
async function toggleUser(id) {
  const res = await fetch(`${API}/admin/users/${id}/toggle`, {
    method: "POST", headers: { "Authorization": "Bearer " + getAdminToken() }
  });
  if (res.ok) { loadStudents(); loadStats(); }
}

async function deleteUser(id, name) {
  if (!confirm(`Delete student "${name}"? This cannot be undone.`)) return;
  const res = await fetch(`${API}/admin/users/${id}`, {
    method: "DELETE", headers: { "Authorization": "Bearer " + getAdminToken() }
  });
  if (res.ok) { loadStudents(); loadStats(); }
}

// ── COURSES ──
async function loadCourses() {
  const res     = await fetch(`${API}/admin/courses`, {
    headers: { "Authorization": "Bearer " + getAdminToken() }
  });
  const courses = await res.json();
  const tbody   = document.getElementById("coursesBody");

  if (!courses.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:2rem;">No courses yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = courses.map(c => `
    <tr>
      <td><span style="background:var(--accent-light);color:var(--accent);padding:2px 8px;border-radius:4px;font-size:0.75rem;font-weight:700;">${c.code}</span></td>
      <td style="font-weight:600;">${c.name}</td>
      <td style="color:var(--muted);">${c.department}</td>
      <td>${c.credits}</td>
      <td style="color:var(--muted);font-size:0.8rem;">${c.slots.map(s => s.day.slice(0,3) + " " + s.start).join(", ")}</td>
      <td style="display:flex;gap:6px;">
        <button class="btn-sm btn-sm-toggle" onclick="openContentModal('${c._id}','${c.name}')">Content</button>
        <button class="btn-sm btn-sm-danger" onclick="deleteCourse('${c._id}','${c.name}')">Delete</button>
      </td>
    </tr>`).join("");
}

async function deleteCourse(id, name) {
  if (!confirm(`Delete "${name}"? This removes it from all students.`)) return;
  const res = await fetch(`${API}/admin/courses/${id}`, {
    method: "DELETE", headers: { "Authorization": "Bearer " + getAdminToken() }
  });
  if (res.ok) { loadCourses(); loadStats(); }
}

// ── ADD COURSE ──
function addSlot() {
  slotCount++;
  const div = document.createElement("div");
  div.className = "slot-entry";
  div.id = `slot-${slotCount}`;
  div.innerHTML = `
    <button class="remove-slot" onclick="removeSlot(${slotCount})">✕</button>
    <div class="form-row">
      <div class="form-group">
        <label>Day</label>
        <select id="sDay-${slotCount}" style="width:100%;padding:10px 13px;background:var(--surface);border:1.5px solid var(--border);border-radius:var(--radius-sm);color:var(--ink);font-family:var(--font-body);font-size:0.9rem;">
          <option>Monday</option><option>Tuesday</option><option>Wednesday</option>
          <option>Thursday</option><option>Friday</option><option>Saturday</option>
        </select>
      </div>
      <div class="form-group"><label>Room</label><input type="text" id="sRoom-${slotCount}" placeholder="e.g. A101"/></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Start Time</label><input type="time" id="sStart-${slotCount}" value="09:00"/></div>
      <div class="form-group"><label>End Time</label><input type="time" id="sEnd-${slotCount}" value="10:00"/></div>
    </div>`;
  document.getElementById("slotsContainer").appendChild(div);
}

function removeSlot(id) {
  document.getElementById(`slot-${id}`)?.remove();
}

async function submitCourse() {
  const name    = document.getElementById("cName").value.trim();
  const code    = document.getElementById("cCode").value.trim();
  const dept    = document.getElementById("cDept").value.trim();
  const credits = parseInt(document.getElementById("cCredits").value);

  ["courseErr","courseSuc"].forEach(id => document.getElementById(id)?.classList.remove("show"));
  if (!name || !code || !dept) { showAlert("courseErr", "Name, code and department are required."); return; }

  const slots = [];
  document.querySelectorAll(".slot-entry").forEach(entry => {
    const id    = entry.id.split("-")[1];
    const day   = document.getElementById(`sDay-${id}`)?.value;
    const start = document.getElementById(`sStart-${id}`)?.value;
    const end   = document.getElementById(`sEnd-${id}`)?.value;
    const room  = document.getElementById(`sRoom-${id}`)?.value || "TBD";
    if (day && start && end) slots.push({ day, start, end, room });
  });

  const res  = await fetch(`${API}/admin/courses`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + getAdminToken() },
    body: JSON.stringify({ name, code, credits, department: dept, slots })
  });
  const data = await res.json();
  if (res.ok) {
    showAlert("courseSuc", data.message);
    document.getElementById("cName").value = "";
    document.getElementById("cCode").value = "";
    document.getElementById("cDept").value = "";
    document.getElementById("slotsContainer").innerHTML = "";
    slotCount = 0;
    loadCourses(); loadStats();
  } else {
    showAlert("courseErr", data.error);
  }
}

function showAlert(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg; el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 4000);
}

// ══════════════════════════════════════
// COURSE CONTENT MANAGEMENT
// ══════════════════════════════════════

let currentCourseId   = null;
let currentCourseName = null;

function openContentModal(courseId, courseName) {
  currentCourseId   = courseId;
  currentCourseName = courseName;
  document.getElementById("contentModalTitle").textContent = `Manage Content — ${courseName}`;
  document.getElementById("contentModal").classList.add("open");
  loadContentForAdmin(courseId);
}

function closeContentModal() {
  document.getElementById("contentModal").classList.remove("open");
  currentCourseId = null;
}

async function loadContentForAdmin(courseId) {
  const res  = await fetch(`${API}/content/${courseId}/all`, {
    headers: { "Authorization": "Bearer " + getAdminToken() }
  });
  const data = await res.json();
  renderAdminAnnouncements(data.announcements, courseId);
  renderAdminSyllabus(data.syllabus, courseId);
  renderAdminMaterials(data.materials, courseId);
}

function renderAdminAnnouncements(items, courseId) {
  const el = document.getElementById("adminAnnList");
  el.innerHTML = items.length
    ? items.map(a => `
        <div style="background:var(--bg2);border-radius:8px;padding:10px 12px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <div style="font-weight:700;font-size:0.88rem;">${a.title}</div>
            <div style="font-size:0.8rem;color:var(--muted);margin-top:2px;">${a.message}</div>
          </div>
          <button class="btn-sm btn-sm-danger" onclick="deleteContent('${a._id}','${courseId}','announcements')" style="flex-shrink:0;margin-left:8px;">✕</button>
        </div>`).join("")
    : `<p style="color:var(--muted);font-size:0.85rem;">No announcements yet.</p>`;
}

function renderAdminSyllabus(items, courseId) {
  const el = document.getElementById("adminSylList");
  el.innerHTML = items.length
    ? items.map(s => `
        <div style="background:var(--bg2);border-radius:8px;padding:10px 12px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <span style="font-weight:700;color:var(--accent);font-size:0.82rem;">Week ${s.week}</span>
            <span style="margin-left:8px;font-size:0.88rem;font-weight:600;">${s.topic}</span>
            ${s.description ? `<div style="font-size:0.78rem;color:var(--muted);margin-top:2px;">${s.description}</div>` : ""}
          </div>
          <button class="btn-sm btn-sm-danger" onclick="deleteContent('${s._id}','${courseId}','syllabus')" style="flex-shrink:0;margin-left:8px;">✕</button>
        </div>`).join("")
    : `<p style="color:var(--muted);font-size:0.85rem;">No syllabus added yet.</p>`;
}

function renderAdminMaterials(items, courseId) {
  const el = document.getElementById("adminMatList");
  el.innerHTML = items.length
    ? items.map(m => `
        <div style="background:var(--bg2);border-radius:8px;padding:10px 12px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-weight:700;font-size:0.88rem;">${m.title} <span style="font-size:0.72rem;color:var(--muted);">(${m.material_type})</span></div>
            ${m.url ? `<a href="${m.url}" target="_blank" style="font-size:0.78rem;color:var(--accent);">Open link →</a>` : ""}
          </div>
          <button class="btn-sm btn-sm-danger" onclick="deleteContent('${m._id}','${courseId}','materials')" style="flex-shrink:0;margin-left:8px;">✕</button>
        </div>`).join("")
    : `<p style="color:var(--muted);font-size:0.85rem;">No materials yet.</p>`;
}

async function deleteContent(itemId, courseId, type) {
  const endpoint = type === "announcements" ? "announcements" : type === "syllabus" ? "syllabus" : "materials";
  const res = await fetch(`${API}/content/${courseId}/${endpoint}/${itemId}`, {
    method: "DELETE", headers: { "Authorization": "Bearer " + getAdminToken() }
  });
  if (res.ok) loadContentForAdmin(courseId);
}

async function addAnnouncement() {
  const title   = document.getElementById("annTitle").value.trim();
  const message = document.getElementById("annMessage").value.trim();
  if (!title || !message) { toastError("Title and message required."); return; }

  const res = await fetch(`${API}/content/${currentCourseId}/announcements`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + getAdminToken() },
    body: JSON.stringify({ title, message })
  });
  if (res.ok) {
    document.getElementById("annTitle").value   = "";
    document.getElementById("annMessage").value = "";
    loadContentForAdmin(currentCourseId);
  }
}

async function addSyllabusWeek() {
  const week  = document.getElementById("sylWeek").value;
  const topic = document.getElementById("sylTopic").value.trim();
  const desc  = document.getElementById("sylDesc").value.trim();
  if (!week || !topic) { toastError("Week and topic required."); return; }

  const res = await fetch(`${API}/content/${currentCourseId}/syllabus`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + getAdminToken() },
    body: JSON.stringify({ week: parseInt(week), topic, description: desc })
  });
  if (res.ok) {
    document.getElementById("sylWeek").value  = "";
    document.getElementById("sylTopic").value = "";
    document.getElementById("sylDesc").value  = "";
    loadContentForAdmin(currentCourseId);
  }
}

async function addMaterial() {
  const title = document.getElementById("matTitle").value.trim();
  const type  = document.getElementById("matType").value;
  const url   = document.getElementById("matUrl").value.trim();
  const desc  = document.getElementById("matDesc").value.trim();
  if (!title) { toastError("Title required."); return; }

  const res = await fetch(`${API}/content/${currentCourseId}/materials`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + getAdminToken() },
    body: JSON.stringify({ title, material_type: type, url, description: desc })
  });
  if (res.ok) {
    document.getElementById("matTitle").value = "";
    document.getElementById("matUrl").value   = "";
    document.getElementById("matDesc").value  = "";
    loadContentForAdmin(currentCourseId);
  }
}


// ══════════════════════════════════════
// TEACHER MANAGEMENT
// ══════════════════════════════════════

async function loadTeachers() {
  const res      = await fetch(`${API}/teacher/`, {
    headers: { "Authorization": "Bearer " + getAdminToken() }
  });
  const teachers = await res.json();
  const tbody    = document.getElementById("teachersBody");
  if (!teachers.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:2rem;">No teachers yet. Add one below.</td></tr>`;
    return;
  }
  tbody.innerHTML = teachers.map(t => `
    <tr>
      <td style="font-weight:600;">${t.name}</td>
      <td style="color:var(--muted);font-size:0.82rem;">${t.email}</td>
      <td style="font-size:0.82rem;">${t.assigned_courses.map(c => `<span style="background:var(--accent-light);color:var(--accent);padding:1px 7px;border-radius:4px;font-size:0.72rem;font-weight:700;margin-right:3px;">${c.code}</span>`).join("") || "<span style='color:var(--muted)'>None</span>"}</td>
      <td style="color:var(--muted);font-size:0.8rem;">${t.created_at}</td>
      <td style="display:flex;gap:6px;">
        <button class="btn-sm btn-sm-toggle" onclick="openAssignModal('${t._id}','${t.name}')">Assign Course</button>
        <button class="btn-sm btn-sm-danger" onclick="deleteTeacher('${t._id}','${t.name}')">Delete</button>
      </td>
    </tr>`).join("");
}

async function createTeacher() {
  const name     = document.getElementById("tName").value.trim();
  const email    = document.getElementById("tEmail").value.trim();
  const password = document.getElementById("tPassword").value;
  if (!name || !email || !password) { showAlert("teacherErr", "All fields required."); return; }

  const res  = await fetch(`${API}/teacher/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + getAdminToken() },
    body: JSON.stringify({ name, email, password })
  });
  const data = await res.json();
  if (res.ok) {
    showAlert("teacherSuc", data.message);
    document.getElementById("tName").value     = "";
    document.getElementById("tEmail").value    = "";
    document.getElementById("tPassword").value = "";
    loadTeachers();
    loadStats();
  } else {
    showAlert("teacherErr", data.error);
  }
}

async function deleteTeacher(id, name) {
  if (!confirm(`Delete teacher "${name}"?`)) return;
  const res = await fetch(`${API}/teacher/${id}`, {
    method: "DELETE", headers: { "Authorization": "Bearer " + getAdminToken() }
  });
  if (res.ok) { loadTeachers(); loadStats(); }
}

let assigningTeacherId = null;

async function openAssignModal(teacherId, teacherName) {
  assigningTeacherId = teacherId;
  document.getElementById("assignModalTitle").textContent = `Assign Course — ${teacherName}`;
  document.getElementById("assignModal").classList.add("open");

  // Load courses into select
  const res     = await fetch(`${API}/admin/courses`, { headers: { "Authorization": "Bearer " + getAdminToken() } });
  const courses = await res.json();
  const select  = document.getElementById("assignCourseSelect");
  select.innerHTML = courses.map(c => `<option value="${c._id}">${c.code} — ${c.name}</option>`).join("");
}

function closeAssignModal() {
  document.getElementById("assignModal").classList.remove("open");
  assigningTeacherId = null;
}

async function assignCourse() {
  const courseId = document.getElementById("assignCourseSelect").value;
  if (!courseId || !assigningTeacherId) return;

  const res  = await fetch(`${API}/teacher/${assigningTeacherId}/assign`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + getAdminToken() },
    body: JSON.stringify({ course_id: courseId })
  });
  const data = await res.json();
  if (res.ok) { closeAssignModal(); loadTeachers(); }
  else alert(data.error);
}


// ══════════════════════════════════════
// FEES
// ══════════════════════════════════════
async function loadFees() {
  // Load students into select
  const studRes  = await fetch(`${API}/admin/students`, { headers: { "Authorization": "Bearer " + getAdminToken() } });
  const students = await studRes.json();
  const select   = document.getElementById("feeStudentSelect");
  if (select) {
    select.innerHTML = students.map(s => `<option value="${s._id}">${s.name} (${s.email})</option>`).join("");
  }

  // Load all fees
  const feeRes = await fetch(`${API}/fees/all`, { headers: { "Authorization": "Bearer " + getAdminToken() } });
  const fees   = await feeRes.json();
  const el     = document.getElementById("feesList");
  if (!el) return;

  if (!fees.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">💳</div><h3>No fees added yet</h3><p>Add fees for students using the form above.</p></div>`;
    return;
  }

  el.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow-sm);">
      <table class="data-table" style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th>Student</th>
            <th>Type</th>
            <th>Amount</th>
            <th>Semester</th>
            <th>Due Date</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${fees.map(f => `
            <tr>
              <td><div style="font-weight:600;">${f.student_name}</div></td>
              <td style="text-transform:capitalize;">${f.fee_type}</td>
              <td style="font-weight:700;">₹${f.amount.toLocaleString()}</td>
              <td>Sem ${f.semester}</td>
              <td>${f.due_date}</td>
              <td>
                <span style="padding:3px 10px;border-radius:20px;font-size:0.75rem;font-weight:700;
                  background:${f.status==='paid'?'var(--green-light)':f.status==='overdue'?'var(--red-light)':'#fdf6e3'};
                  color:${f.status==='paid'?'var(--green)':f.status==='overdue'?'var(--red)':'#b5861a'};">
                  ${f.status.charAt(0).toUpperCase()+f.status.slice(1)}
                </span>
              </td>
              <td>
                <div style="display:flex;gap:6px;">
                  ${f.status !== 'paid' ? `<button onclick="markFeePaid('${f._id}')" style="padding:5px 12px;background:var(--green);color:white;border:none;border-radius:5px;font-size:0.75rem;font-weight:700;cursor:pointer;">Mark Paid</button>` : ''}
                  <button onclick="deleteFee('${f._id}')" style="padding:5px 12px;background:var(--red-light);color:var(--red);border:1px solid #f5c6c2;border-radius:5px;font-size:0.75rem;font-weight:700;cursor:pointer;">Delete</button>
                </div>
              </td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}

async function addFee() {
  const studentId = document.getElementById("feeStudentSelect")?.value;
  const feeType   = document.getElementById("feeType")?.value;
  const amount    = document.getElementById("feeAmount")?.value;
  const dueDate   = document.getElementById("feeDueDate")?.value;
  const semester  = document.getElementById("feeSemester")?.value;
  const year      = document.getElementById("feeYear")?.value;

  if (!studentId || !amount || !dueDate) { toastError("Student, amount and due date are required."); return; }

  const res  = await fetch(`${API}/fees/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + getAdminToken() },
    body: JSON.stringify({ student_id: studentId, fee_type: feeType, amount: parseFloat(amount), due_date: dueDate, semester, academic_year: year })
  });
  const data = await res.json();
  if (res.ok) { toastSuccess(data.message); loadFees(); }
  else { toastError(data.error || "Failed to add fee."); }
}

async function addFeeBulk() {
  const feeType  = document.getElementById("feeType")?.value;
  const amount   = document.getElementById("feeAmount")?.value;
  const dueDate  = document.getElementById("feeDueDate")?.value;
  const semester = document.getElementById("feeSemester")?.value;
  const year     = document.getElementById("feeYear")?.value;

  if (!amount || !dueDate) { toastError("Amount and due date are required."); return; }
  

  const res  = await fetch(`${API}/fees/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + getAdminToken() },
    body: JSON.stringify({ fee_type: feeType, amount: parseFloat(amount), due_date: dueDate, semester, academic_year: year })
  });
  const data = await res.json();
  if (res.ok) { toastSuccess(data.message); loadFees(); }
  else { toastError(data.error || "Failed."); }
}

async function markFeePaid(feeId) {
  const res = await fetch(`${API}/fees/${feeId}/pay`, {
    method: "POST", headers: { "Authorization": "Bearer " + getAdminToken() }
  });
  if (res.ok) loadFees();
}

async function deleteFee(feeId) {
  // confirm replaced by showConfirm
  const res = await fetch(`${API}/fees/${feeId}`, {
    method: "DELETE", headers: { "Authorization": "Bearer " + getAdminToken() }
  });
  if (res.ok) loadFees();
}