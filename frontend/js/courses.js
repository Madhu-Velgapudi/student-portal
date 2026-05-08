async function fetchAllCourses() {
  try {
    const res = await fetch(`${API}/courses/`, {
      headers: { "Authorization": "Bearer " + getToken() }
    });
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

async function fetchEnrolledCourses() {
  try {
    const res = await fetch(`${API}/courses/enrolled`, {
      headers: { "Authorization": "Bearer " + getToken() }
    });
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

function courseCardHTML(course, isEnrolled) {
  const slots = course.slots.map(s => `
    <div class="slot-item">
      <span class="slot-day">${s.day}</span>
      <span class="slot-time">${s.start} – ${s.end}</span>
      <span class="slot-room">${s.room}</span>
    </div>`).join("");

  const actionBtn = isEnrolled
    ? `<button class="btn-drop" id="btn-${course._id}" onclick="toggleEnroll('${course._id}', true, this)">Drop Course</button>
       <span class="badge-enrolled">✓ Enrolled</span>`
    : `<button class="btn-enroll" id="btn-${course._id}" onclick="toggleEnroll('${course._id}', false, this)">+ Enroll</button>
       <span class="credits-badge">${course.credits} cr</span>`;

  return `
    <div class="course-card">
      <div>
        <span class="code">${course.code}</span>
        <h3>${course.name}</h3>
        <div class="meta">
          <span>🏛 ${course.department}</span>
          <span>📘 ${course.credits} Credits</span>
        </div>
        <div class="slots-list">${slots}</div>
      </div>
      <div class="course-card-footer">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          ${actionBtn}
        </div>
        <a href="course-content.html?id=${course._id}"
           style="font-size:0.78rem;color:var(--accent);text-decoration:none;font-weight:600;white-space:nowrap;">
          View Content →
        </a>
      </div>
    </div>`;
}