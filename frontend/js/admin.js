let slotCount = 0;

async function initAdmin() {
  await loadStats();
  await loadCourses();
}

async function loadStats() {
  const res = await fetch(`${API}/admin/stats`, {
    headers: { "Authorization": "Bearer " + getToken() }
  });
  if (!res.ok) {
    alert("Admin access required. Make sure your account has admin privileges.");
    return;
  }
  const data = await res.json();
  document.getElementById("statStudents").textContent    = data.total_students;
  document.getElementById("statCourses").textContent     = data.total_courses;
  document.getElementById("statEnrollments").textContent = data.total_enrollments;
}

async function loadCourses() {
  const res     = await fetch(`${API}/admin/courses`, {
    headers: { "Authorization": "Bearer " + getToken() }
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
      <td style="color:var(--muted);font-size:0.8rem;">${c.slots.map(s => s.day.slice(0,3)).join(", ")}</td>
      <td><button class="btn-sm btn-sm-danger" onclick="deleteCourse('${c._id}','${c.name}')">Delete</button></td>
    </tr>`).join("");
}

async function loadStudents() {
  const res      = await fetch(`${API}/admin/users`, {
    headers: { "Authorization": "Bearer " + getToken() }
  });
  const students = await res.json();
  const tbody    = document.getElementById("studentsBody");

  if (!students.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:2rem;">No students yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = students.map(s => `
    <tr>
      <td style="font-weight:600;">${s.name}</td>
      <td style="color:var(--muted);font-size:0.82rem;">${s.email}</td>
      <td><span class="status-badge ${s.is_verified ? "status-verified" : ""}">${s.is_verified ? "Verified" : "Pending"}</span></td>
      <td>${s.enrolled_courses}</td>
      <td style="color:var(--muted);font-size:0.8rem;">${s.created_at}</td>
      <td><span class="status-badge ${s.is_active ? "status-active" : "status-inactive"}">${s.is_active ? "Active" : "Inactive"}</span></td>
      <td style="display:flex;gap:6px;">
        <button class="btn-sm btn-sm-toggle" onclick="toggleUser('${s._id}')">${s.is_active ? "Deactivate" : "Activate"}</button>
        <button class="btn-sm btn-sm-danger" onclick="deleteUser('${s._id}','${s.name}')">Delete</button>
      </td>
    </tr>`).join("");
}

function switchAdminTab(tab, btn) {
  document.querySelectorAll(".admin-tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".admin-section").forEach(s => s.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById(`tab-${tab}`).classList.add("active");
  if (tab === "students") loadStudents();
}

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

  clearAdminAlerts();
  if (!name || !code || !dept) {
    showAdminAlert("courseErr", "Name, code and department are required.");
    return;
  }

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
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + getToken() },
    body: JSON.stringify({ name, code, credits, department: dept, slots })
  });
  const data = await res.json();

  if (res.ok) {
    showAdminAlert("courseSuc", data.message);
    document.getElementById("cName").value = "";
    document.getElementById("cCode").value = "";
    document.getElementById("cDept").value = "";
    document.getElementById("slotsContainer").innerHTML = "";
    slotCount = 0;
    loadCourses();
    loadStats();
  } else {
    showAdminAlert("courseErr", data.error);
  }
}

async function deleteCourse(id, name) {
  if (!confirm(`Delete "${name}"? This will remove it from all students.`)) return;
  const res = await fetch(`${API}/admin/courses/${id}`, {
    method: "DELETE",
    headers: { "Authorization": "Bearer " + getToken() }
  });
  if (res.ok) { loadCourses(); loadStats(); }
}

async function toggleUser(id) {
  const res = await fetch(`${API}/admin/users/${id}/toggle`, {
    method: "POST",
    headers: { "Authorization": "Bearer " + getToken() }
  });
  if (res.ok) loadStudents();
}

async function deleteUser(id, name) {
  if (!confirm(`Delete student "${name}"? This cannot be undone.`)) return;
  const res = await fetch(`${API}/admin/users/${id}`, {
    method: "DELETE",
    headers: { "Authorization": "Bearer " + getToken() }
  });
  if (res.ok) { loadStudents(); loadStats(); }
}

function showAdminAlert(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 4000);
}

function clearAdminAlerts() {
  ["courseErr", "courseSuc"].forEach(id => document.getElementById(id)?.classList.remove("show"));
}