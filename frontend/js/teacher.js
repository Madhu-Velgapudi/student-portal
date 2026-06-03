function getTeacherToken() {
  return localStorage.getItem("sp_teacher_token");
}

function teacherLogout() {
  localStorage.removeItem("sp_teacher_token");
  localStorage.removeItem("sp_teacher");
  window.location.href = "teacher-login.html";
}

if (!getTeacherToken()) {
  window.location.href = "teacher-login.html";
}

const teacherData = JSON.parse(localStorage.getItem("sp_teacher") || "{}");
if (teacherData.name) {
  document.getElementById("tName").textContent   = teacherData.name.split(" ")[0];
  document.getElementById("tAvatar").textContent = teacherData.name[0].toUpperCase();
}

window.addEventListener("DOMContentLoaded", async () => {
  await loadTeacherCourses();
  await loadTeacherAnnouncements();
});

// ── TAB SWITCH ──
function switchTeacherTab(tab, clickedEl) {
  event.preventDefault();
  ["courses","attendance","marks","assignments","exams","announcements"].forEach(function(t) {
    var sec = document.getElementById("ttab-" + t);
    if (sec) sec.classList.remove("active");
  });
  var selected = document.getElementById("ttab-" + tab);
  if (selected) selected.classList.add("active");
  document.querySelectorAll(".teacher-nav-links a").forEach(function(a) {
    a.classList.remove("active");
  });
  if (clickedEl) clickedEl.classList.add("active");
  var titles = {
    courses:       ["My Courses",      "Manage content for your courses."],
    attendance:    ["Mark Attendance", "Mark attendance for your students."],
    marks:         ["Enter Marks",     "Enter marks for your students."],
    assignments:   ["Assignments",     "Post and manage assignments."],
    exams:         ["Exam Schedule",   "Schedule exams for your courses."],
    announcements: ["Announcements",   "Post global notices for all students."]
  };
  if (titles[tab]) {
    document.getElementById("tPageTitle").textContent = titles[tab][0];
    document.getElementById("tPageSub").textContent   = titles[tab][1];
  }
  if (tab === "attendance")  loadAttendanceCourses();
  if (tab === "marks")       loadMarksCourses();
  if (tab === "assignments") loadAssignmentsTab();
  if (tab === "exams")       loadExamsTab();
}

// ── MY COURSES TAB ──
async function loadTeacherCourses() {
  const res     = await fetch(`${API}/teacher/my-courses`, {
    headers: { "Authorization": "Bearer " + getTeacherToken() }
  });
  const courses = await res.json();

  document.getElementById("tStatCourses").textContent  = courses.length;
  document.getElementById("tStatStudents").textContent = courses.reduce((s, c) => s + (c.student_count || 0), 0);

  const el = document.getElementById("teacherCoursesList");
  if (!courses.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📚</div><h3>No courses assigned yet</h3></div>`;
    return;
  }
  el.innerHTML = courses.map(c => `
    <div class="course-manage-card">
      <span class="course-manage-code">${c.code}</span>
      <div class="course-manage-title" style="margin-top:4px;">${c.name}</div>
      <div style="font-size:0.78rem;color:var(--muted);margin-top:2px;">🏛 ${c.department} · 📘 ${c.credits} Credits · 👥 ${c.student_count||0} students</div>
      <div class="add-form" style="margin-top:1rem;">
        <h4>📢 Post Course Announcement</h4>
        <input type="text" id="ann-title-${c._id}" placeholder="Title"/>
        <textarea id="ann-msg-${c._id}" placeholder="Message..." rows="2"></textarea>
        <button class="btn-post" onclick="postCourseAnnouncement('${c._id}')">Post</button>
      </div>
      <div class="add-form" style="margin-top:8px;">
        <h4>📅 Add Syllabus Week</h4>
        <div style="display:grid;grid-template-columns:80px 1fr auto;gap:6px;align-items:center;">
          <input type="number" id="syl-week-${c._id}" placeholder="Week" min="1" max="16"/>
          <input type="text" id="syl-topic-${c._id}" placeholder="Topic"/>
          <button class="btn-post" onclick="postSyllabus('${c._id}')">Add</button>
        </div>
        <input type="text" id="syl-desc-${c._id}" placeholder="Description (optional)" style="margin-top:4px;"/>
      </div>
      <div class="add-form" style="margin-top:8px;">
        <h4>📚 Add Material</h4>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
          <input type="text" id="mat-title-${c._id}" placeholder="Title"/>
          <select id="mat-type-${c._id}" style="padding:8px 10px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-family:var(--font-body);font-size:0.85rem;background:var(--surface);color:var(--ink);outline:none;">
            <option value="link">🔗 Link</option>
            <option value="note">📝 Note</option>
            <option value="video">🎬 Video</option>
            <option value="pdf">📄 PDF</option>
          </select>
        </div>
        <input type="url" id="mat-url-${c._id}" placeholder="URL (optional)" style="margin-top:4px;"/>
        <div style="display:grid;grid-template-columns:1fr auto;gap:6px;margin-top:4px;">
          <input type="text" id="mat-desc-${c._id}" placeholder="Description (optional)"/>
          <button class="btn-post" onclick="postMaterial('${c._id}')">Add</button>
        </div>
      </div>
    </div>`).join("");
}

// ── ATTENDANCE ──
async function loadAttendanceCourses() {
  const res     = await fetch(`${API}/teacher/my-courses`, { headers: { "Authorization": "Bearer " + getTeacherToken() } });
  const courses = await res.json();
  const el      = document.getElementById("attCourseSelect");
  if (!courses.length) { el.innerHTML = `<option value="">No courses assigned</option>`; return; }
  el.innerHTML = courses.map(c => `<option value="${c._id}">${c.code} — ${c.name}</option>`).join("");
  loadDateOptions();
}

async function loadDateOptions() {
  const courseId   = document.getElementById("attCourseSelect").value;
  if (!courseId) return;
  const res        = await fetch(`${API}/attendance/teacher/dates/${courseId}`, { headers: { "Authorization": "Bearer " + getTeacherToken() } });
  const dates      = await res.json();
  const dateSelect = document.getElementById("attDateSelect");
  dateSelect.innerHTML = dates.map(d => `<option value="${d.date}" data-day="${d.day}" data-time="${d.slot_time}">${d.display} — ${d.slot_time}</option>`).join("");
  loadAttendanceSheet();
}

async function loadAttendanceSheet() {
  const courseId  = document.getElementById("attCourseSelect").value;
  const dateOpt   = document.getElementById("attDateSelect");
  if (!courseId || !dateOpt.value) return;
  const date      = dateOpt.value;
  const slotDay   = dateOpt.options[dateOpt.selectedIndex]?.dataset.day || "";
  const slotTime  = dateOpt.options[dateOpt.selectedIndex]?.dataset.time || "";
  const res       = await fetch(`${API}/attendance/teacher/course/${courseId}?date=${date}&slot_day=${slotDay}`, { headers: { "Authorization": "Bearer " + getTeacherToken() } });
  const students  = await res.json();
  const el        = document.getElementById("attSheet");
  if (!students.length) { el.innerHTML = `<div class="empty-state"><div class="empty-icon">👥</div><h3>No students enrolled</h3></div>`; return; }
  el.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow-sm);">
      <div style="padding:1rem 1.2rem;background:var(--bg2);border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
        <div style="font-family:var(--font-head);font-weight:700;font-size:0.9rem;">${slotDay} — ${date} · ${slotTime}</div>
        <div style="display:flex;gap:8px;">
          <button onclick="markAll('present','${courseId}','${slotDay}','${slotTime}','${date}')" style="padding:6px 14px;background:var(--green);color:white;border:none;border-radius:6px;font-family:var(--font-head);font-size:0.78rem;font-weight:700;cursor:pointer;">✓ All Present</button>
          <button onclick="markAll('absent','${courseId}','${slotDay}','${slotTime}','${date}')" style="padding:6px 14px;background:var(--red);color:white;border:none;border-radius:6px;font-family:var(--font-head);font-size:0.78rem;font-weight:700;cursor:pointer;">✗ All Absent</button>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr style="background:var(--bg2);">
          <th style="padding:10px 16px;text-align:left;font-size:0.75rem;text-transform:uppercase;color:var(--muted);font-family:var(--font-head);">Student</th>
          <th style="padding:10px 16px;text-align:left;font-size:0.75rem;text-transform:uppercase;color:var(--muted);font-family:var(--font-head);">Overall</th>
          <th style="padding:10px 16px;text-align:center;font-size:0.75rem;text-transform:uppercase;color:var(--muted);font-family:var(--font-head);">Mark</th>
        </tr></thead>
        <tbody>
          ${students.map(s => `
            <tr style="border-bottom:1px solid var(--border);">
              <td style="padding:12px 16px;"><div style="font-weight:600;font-size:0.88rem;">${s.name}</div><div style="font-size:0.75rem;color:var(--muted);">${s.email}</div></td>
              <td style="padding:12px 16px;"><span style="font-weight:700;color:${s.percentage>=75?'var(--green)':s.percentage>=50?'var(--gold)':'var(--red)'};">${s.percentage}%</span><div style="font-size:0.72rem;color:var(--muted);">${s.present}/${s.total}</div></td>
              <td style="padding:12px 16px;text-align:center;">
                <div style="display:inline-flex;gap:6px;" id="btns-${s.student_id}">
                  <button onclick="markOne('${s.student_id}','${courseId}','${slotDay}','${slotTime}','${date}','present',this)"
                    style="padding:6px 14px;border-radius:6px;font-family:var(--font-head);font-size:0.78rem;font-weight:700;cursor:pointer;border:1.5px solid;background:${s.today_status==='present'?'var(--green)':'var(--green-light)'};color:${s.today_status==='present'?'white':'var(--green)'};border-color:${s.today_status==='present'?'var(--green)':'#b8dfc9'};">✓ Present</button>
                  <button onclick="markOne('${s.student_id}','${courseId}','${slotDay}','${slotTime}','${date}','absent',this)"
                    style="padding:6px 14px;border-radius:6px;font-family:var(--font-head);font-size:0.78rem;font-weight:700;cursor:pointer;border:1.5px solid;background:${s.today_status==='absent'?'var(--red)':'var(--red-light)'};color:${s.today_status==='absent'?'white':'var(--red)'};border-color:${s.today_status==='absent'?'var(--red)':'#f5c6c2'};">✗ Absent</button>
                </div>
              </td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}

async function markOne(studentId, courseId, slotDay, slotTime, date, status, btn) {
  const row  = btn.parentElement;
  const btns = row.querySelectorAll("button");
  btns.forEach(b => { b.disabled = true; b.style.opacity = "0.6"; });
  const res = await fetch(`${API}/attendance/teacher/mark`, {
    method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + getTeacherToken() },
    body: JSON.stringify({ student_id: studentId, course_id: courseId, slot_day: slotDay, slot_time: slotTime, date, status })
  });
  if (res.ok) {
    btns.forEach(b => {
      b.disabled = false; b.style.opacity = "1";
      const isPresent = b.textContent.includes("Present");
      const isActive  = (status === "present" && isPresent) || (status === "absent" && !isPresent);
      b.style.background = isActive ? (isPresent ? "var(--green)" : "var(--red)") : (isPresent ? "var(--green-light)" : "var(--red-light)");
      b.style.color      = isActive ? "white" : (isPresent ? "var(--green)" : "var(--red)");
    });
  } else { btns.forEach(b => { b.disabled = false; b.style.opacity = "1"; }); }
}

async function markAll(status, courseId, slotDay, slotTime, date) {
  document.querySelectorAll("button[onclick*='markOne']").forEach(b => { b.disabled = true; b.style.opacity = "0.5"; });
  const res      = await fetch(`${API}/attendance/teacher/course/${courseId}?date=${date}&slot_day=${slotDay}`, { headers: { "Authorization": "Bearer " + getTeacherToken() } });
  const students = await res.json();
  for (const s of students) {
    await fetch(`${API}/attendance/teacher/mark`, {
      method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + getTeacherToken() },
      body: JSON.stringify({ student_id: s.student_id, course_id: courseId, slot_day: slotDay, slot_time: slotTime, date, status })
    });
  }
  loadAttendanceSheet();
}

// ── MARKS ──
async function loadMarksCourses() {
  const res     = await fetch(`${API}/teacher/my-courses`, { headers: { "Authorization": "Bearer " + getTeacherToken() } });
  const courses = await res.json();
  const select  = document.getElementById("marksCourseSelect");
  if (!select) return;
  if (!courses.length) { select.innerHTML = `<option value="">No courses assigned</option>`; return; }
  select.innerHTML = courses.map(c => `<option value="${c._id}">${c.code} — ${c.name}</option>`).join("");
  loadMarksSheet();
}

async function loadMarksSheet() {
  const courseId = document.getElementById("marksCourseSelect")?.value;
  if (!courseId) return;
  const el       = document.getElementById("marksSheet");
  el.innerHTML   = `<div class="loading"><div class="spinner"></div></div>`;
  const res      = await fetch(`${API}/marks/course/${courseId}`, { headers: { "Authorization": "Bearer " + getTeacherToken() } });
  const students = await res.json();
  if (!students.length) { el.innerHTML = `<div class="empty-state"><div class="empty-icon">👥</div><h3>No students enrolled</h3></div>`; return; }
  el.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow-sm);">
      <div style="padding:1rem 1.2rem;background:var(--bg2);border-bottom:1px solid var(--border);">
        <div style="font-family:var(--font-head);font-weight:700;">Enter marks out of 100</div>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr style="background:var(--bg2);">
          <th style="padding:10px 16px;text-align:left;font-size:0.75rem;text-transform:uppercase;color:var(--muted);font-family:var(--font-head);">Student</th>
          <th style="padding:10px 16px;text-align:left;font-size:0.75rem;text-transform:uppercase;color:var(--muted);font-family:var(--font-head);">Current</th>
          <th style="padding:10px 16px;text-align:left;font-size:0.75rem;text-transform:uppercase;color:var(--muted);font-family:var(--font-head);">Enter Marks</th>
          <th style="padding:10px 16px;font-family:var(--font-head);font-size:0.75rem;text-transform:uppercase;color:var(--muted);">Action</th>
        </tr></thead>
        <tbody>
          ${students.map(s => `
            <tr style="border-bottom:1px solid var(--border);">
              <td style="padding:12px 16px;"><div style="font-weight:600;font-size:0.88rem;">${s.name}</div><div style="font-size:0.75rem;color:var(--muted);">${s.email}</div></td>
              <td style="padding:12px 16px;">${s.marks !== null ? `<span style="font-weight:700;">${s.marks}</span><span style="font-size:0.75rem;color:var(--muted);">/100</span> <span style="background:var(--accent-light);color:var(--accent);padding:2px 8px;border-radius:10px;font-size:0.72rem;font-weight:700;">${s.grade}</span>` : `<span style="color:var(--muted);font-size:0.82rem;">Not entered</span>`}</td>
              <td style="padding:12px 16px;"><input type="number" id="marks-${s.student_id}" value="${s.marks !== null ? s.marks : ''}" placeholder="0–100" min="0" max="100" style="width:90px;padding:7px 10px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-family:var(--font-body);font-size:0.9rem;background:var(--surface);color:var(--ink);outline:none;"/></td>
              <td style="padding:12px 16px;"><button onclick="saveMarks('${s.student_id}','${courseId}')" id="save-btn-${s.student_id}" style="padding:7px 16px;background:var(--accent);color:white;border:none;border-radius:var(--radius-sm);font-family:var(--font-head);font-size:0.78rem;font-weight:700;cursor:pointer;">Save</button> <span id="save-msg-${s.student_id}" style="font-size:0.75rem;color:var(--green);display:none;">✓</span></td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}

async function saveMarks(studentId, courseId) {
  const input = document.getElementById(`marks-${studentId}`);
  const marks = parseFloat(input?.value);
  const btn   = document.getElementById(`save-btn-${studentId}`);
  const msg   = document.getElementById(`save-msg-${studentId}`);
  if (isNaN(marks) || marks < 0 || marks > 100) { input.style.borderColor = "var(--red)"; toastError("Enter valid marks between 0 and 100."); return; }
  btn.disabled = true; btn.textContent = "Saving...";
  const res = await fetch(`${API}/marks/enter`, {
    method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + getTeacherToken() },
    body: JSON.stringify({ student_id: studentId, course_id: courseId, marks })
  });
  if (res.ok) {
    btn.textContent = "Save"; btn.disabled = false;
    input.style.borderColor = "var(--green)";
    msg.style.display = "inline";
    setTimeout(() => { msg.style.display = "none"; input.style.borderColor = "var(--border)"; }, 2000);
    setTimeout(() => loadMarksSheet(), 2100);
  } else { btn.textContent = "Save"; btn.disabled = false; toastError("Failed to save marks."); }
}

// ── ASSIGNMENTS ──
async function loadAssignmentsTab() {
  const res     = await fetch(`${API}/teacher/my-courses`, { headers: { "Authorization": "Bearer " + getTeacherToken() } });
  const courses = await res.json();
  const select  = document.getElementById("asgCourse");
  if (!select) return;
  select.innerHTML = courses.map(c => `<option value="${c._id}">${c.code} — ${c.name}</option>`).join("");
  if (courses.length) loadAssignmentsList(courses[0]._id);
}

async function loadAssignmentsList(courseId) {
  if (!courseId) courseId = document.getElementById("asgCourse")?.value;
  if (!courseId) return;
  const res         = await fetch(`${API}/assignments/course/${courseId}`, { headers: { "Authorization": "Bearer " + getTeacherToken() } });
  const assignments = await res.json();
  const el          = document.getElementById("assignmentsList");
  if (!assignments.length) { el.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><h3>No assignments posted yet</h3></div>`; return; }
  el.innerHTML = `<div style="display:flex;flex-direction:column;gap:0.75rem;">
    ${assignments.map(a => `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:1.2rem 1.5rem;box-shadow:var(--shadow-sm);display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-weight:700;font-size:0.9rem;">${a.title}</div>
          <div style="font-size:0.78rem;color:var(--muted);margin-top:2px;">Due: ${a.due_date} · ${a.total_marks} marks</div>
          ${a.description ? `<div style="font-size:0.8rem;color:var(--ink2);margin-top:4px;">${a.description}</div>` : ""}
        </div>
        <button class="btn-sm btn-sm-danger" onclick="deleteAssignment('${a._id}')">Delete</button>
      </div>`).join("")}
  </div>`;
}

async function postAssignment() {
  const courseId = document.getElementById("asgCourse")?.value;
  const title    = document.getElementById("asgTitle")?.value.trim();
  const desc     = document.getElementById("asgDesc")?.value.trim();
  const dueDate  = document.getElementById("asgDue")?.value;
  const marks    = document.getElementById("asgMarks")?.value;
  if (!courseId || !title || !dueDate) { toastError("Course, title and due date are required."); return; }
  const res = await fetch(`${API}/assignments/`, {
    method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + getTeacherToken() },
    body: JSON.stringify({ course_id: courseId, title, description: desc, due_date: dueDate, total_marks: parseInt(marks) || 100 })
  });
  const data = await res.json();
  if (res.ok) {
    toastSuccess(data.message);
    document.getElementById("asgTitle").value = "";
    document.getElementById("asgDesc").value  = "";
    document.getElementById("asgDue").value   = "";
    loadAssignmentsList(courseId);
  } else { toastError(data.error || "Failed to post assignment."); }
}

async function deleteAssignment(id) {
  showConfirm("This will permanently delete the assignment and all submissions.", async () => {
  const res = await fetch(`${API}/assignments/${id}`, {
    method: "DELETE", headers: { "Authorization": "Bearer " + getTeacherToken() }
  });
  if (res.ok) { toastSuccess("Assignment deleted."); loadAssignmentsTab(); }
  });
}

// ── EXAMS ──
async function loadExamsTab() {
  const res     = await fetch(`${API}/teacher/my-courses`, { headers: { "Authorization": "Bearer " + getTeacherToken() } });
  const courses = await res.json();
  const select  = document.getElementById("examCourse");
  if (!select) return;
  select.innerHTML = courses.map(c => `<option value="${c._id}">${c.code} — ${c.name}</option>`).join("");
  loadExamsList();
}

async function loadExamsList() {
  const res   = await fetch(`${API}/exams/`, { headers: { "Authorization": "Bearer " + getTeacherToken() } });
  const exams = await res.json();
  const el    = document.getElementById("examsList");
  if (!exams.length) { el.innerHTML = `<div class="empty-state"><div class="empty-icon">📅</div><h3>No exams scheduled yet</h3></div>`; return; }
  el.innerHTML = `<div style="display:flex;flex-direction:column;gap:0.75rem;">
    ${exams.map(e => `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:1.2rem 1.5rem;box-shadow:var(--shadow-sm);display:flex;justify-content:space-between;align-items:center;">
        <div>
          <span style="font-size:0.72rem;color:var(--accent);font-weight:700;background:var(--accent-light);padding:2px 8px;border-radius:4px;">${e.course_code}</span>
          <div style="font-weight:700;font-size:0.9rem;margin-top:4px;">${e.course_name} — <span style="text-transform:capitalize;">${e.exam_type}</span></div>
          <div style="font-size:0.78rem;color:var(--muted);margin-top:2px;">📅 ${e.date} · ⏰ ${e.start_time}${e.end_time?" – "+e.end_time:""} · 🏛 ${e.room} · ${e.total_marks} marks</div>
        </div>
        <button class="btn-sm btn-sm-danger" onclick="deleteExam('${e._id}')">Delete</button>
      </div>`).join("")}
  </div>`;
}

async function scheduleExam() {
  const courseId = document.getElementById("examCourse")?.value;
  const examType = document.getElementById("examType")?.value;
  const date     = document.getElementById("examDate")?.value;
  const start    = document.getElementById("examStart")?.value;
  const end      = document.getElementById("examEnd")?.value;
  const room     = document.getElementById("examRoom")?.value.trim();
  const marks    = document.getElementById("examMarks")?.value;
  if (!courseId || !date || !start) { toastError("Course, date and start time are required."); return; }
  const res = await fetch(`${API}/exams/`, {
    method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + getTeacherToken() },
    body: JSON.stringify({ course_id: courseId, exam_type: examType, date, start_time: start, end_time: end, room: room || "TBD", total_marks: parseInt(marks) || 100 })
  });
  const data = await res.json();
  if (res.ok) {
    toastSuccess(data.message);
    document.getElementById("examDate").value  = "";
    document.getElementById("examStart").value = "";
    document.getElementById("examEnd").value   = "";
    document.getElementById("examRoom").value  = "";
    loadExamsList();
  } else { toastError(data.error || "Failed to schedule exam."); }
}

async function deleteExam(id) {
  showConfirm("This will permanently delete the exam.", async () => {
  const res = await fetch(`${API}/exams/${id}`, {
    method: "DELETE", headers: { "Authorization": "Bearer " + getTeacherToken() }
  });
  if (res.ok) { toastSuccess("Exam deleted."); loadExamsList(); }
  });
}

// ── COURSE CONTENT ──
async function postCourseAnnouncement(courseId) {
  const title   = document.getElementById(`ann-title-${courseId}`).value.trim();
  const message = document.getElementById(`ann-msg-${courseId}`).value.trim();
  if (!title || !message) { toastError("Title and message required."); return; }
  const res = await fetch(`${API}/content/${courseId}/announcements`, {
    method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + getTeacherToken() },
    body: JSON.stringify({ title, message })
  });
  if (res.ok) { document.getElementById(`ann-title-${courseId}`).value = ""; document.getElementById(`ann-msg-${courseId}`).value = ""; toastSuccess("Posted!"); }
}

async function postSyllabus(courseId) {
  const week  = document.getElementById(`syl-week-${courseId}`).value;
  const topic = document.getElementById(`syl-topic-${courseId}`).value.trim();
  const desc  = document.getElementById(`syl-desc-${courseId}`).value.trim();
  if (!week || !topic) { toastError("Week and topic required."); return; }
  const res = await fetch(`${API}/content/${courseId}/syllabus`, {
    method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + getTeacherToken() },
    body: JSON.stringify({ week: parseInt(week), topic, description: desc })
  });
  if (res.ok) { document.getElementById(`syl-week-${courseId}`).value = ""; document.getElementById(`syl-topic-${courseId}`).value = ""; document.getElementById(`syl-desc-${courseId}`).value = ""; toastSuccess("Added!"); }
}

async function postMaterial(courseId) {
  const title = document.getElementById(`mat-title-${courseId}`).value.trim();
  const type  = document.getElementById(`mat-type-${courseId}`).value;
  const url   = document.getElementById(`mat-url-${courseId}`).value.trim();
  const desc  = document.getElementById(`mat-desc-${courseId}`).value.trim();
  if (!title) { toastError("Title required."); return; }
  const res = await fetch(`${API}/content/${courseId}/materials`, {
    method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + getTeacherToken() },
    body: JSON.stringify({ title, material_type: type, url, description: desc })
  });
  if (res.ok) { document.getElementById(`mat-title-${courseId}`).value = ""; document.getElementById(`mat-url-${courseId}`).value = ""; document.getElementById(`mat-desc-${courseId}`).value = ""; toastSuccess("Added!"); }
}

// ── ANNOUNCEMENTS ──
async function loadTeacherAnnouncements() {
  const res   = await fetch(`${API}/announcements/`, { headers: { "Authorization": "Bearer " + getTeacherToken() } });
  const items = await res.json();
  const el    = document.getElementById("tAnnList");
  if (!el) return;
  if (!items.length) { el.innerHTML = `<p style="color:var(--muted);">No announcements yet.</p>`; return; }
  el.innerHTML = items.map(a => `
    <div style="background:var(--surface);border:1px solid var(--border);border-left:3px solid var(--accent);border-radius:var(--radius);padding:1rem 1.2rem;margin-bottom:8px;display:flex;justify-content:space-between;align-items:flex-start;">
      <div>
        <div style="font-weight:700;font-size:0.88rem;">${a.title}</div>
        <div style="font-size:0.8rem;color:var(--muted);margin-top:2px;">${a.message}</div>
        <div style="font-size:0.72rem;color:var(--muted);margin-top:4px;">By ${a.posted_by} · ${a.created_at}</div>
      </div>
      <button class="btn-sm btn-sm-danger" onclick="deleteAnnouncement('${a._id}')">✕</button>
    </div>`).join("");
}

async function postAnnouncement() {
  const title    = document.getElementById("tAnnTitle").value.trim();
  const message  = document.getElementById("tAnnMessage").value.trim();
  const priority = document.getElementById("tAnnPriority").value;
  if (!title || !message) { toastError("Title and message required."); return; }
  const res = await fetch(`${API}/announcements/`, {
    method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + getTeacherToken() },
    body: JSON.stringify({ title, message, priority })
  });
  if (res.ok) { document.getElementById("tAnnTitle").value = ""; document.getElementById("tAnnMessage").value = ""; await loadTeacherAnnouncements(); }
}

async function deleteAnnouncement(id) {
  if (!confirm("Delete this announcement?")) return;
  const res = await fetch(`${API}/announcements/${id}`, { method: "DELETE", headers: { "Authorization": "Bearer " + getTeacherToken() } });
  if (res.ok) await loadTeacherAnnouncements();
}