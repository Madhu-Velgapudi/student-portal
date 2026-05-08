// ── STUDENT VIEW ONLY ──
async function loadStudentAttendance() {
  const user = await fetchUser();
  if (user) {
    const fn = user.name.split(" ")[0];
    document.getElementById("navName").textContent   = fn;
    document.getElementById("navAvatar").textContent = fn[0].toUpperCase();
  }

  const [coursesRes, attRes] = await Promise.all([
    fetch(`${API}/courses/enrolled`, { headers: { "Authorization": "Bearer " + getToken() } }),
    fetch(`${API}/attendance/my`,    { headers: { "Authorization": "Bearer " + getToken() } })
  ]);

  const courses = await coursesRes.json();
  const attData = await attRes.json();
  const attMap  = {};
  attData.forEach(a => { attMap[a.course_id] = a; });

  const grid = document.getElementById("attGrid");

  if (!courses.length) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><h3>No enrolled courses</h3><p>Enroll in courses to see attendance.</p></div>`;
    return;
  }

  grid.innerHTML = courses.map(c => {
    const att      = attMap[c._id] || { present: 0, absent: 0, percentage: 0, records: [] };
    const pct      = att.percentage || 0;
    const pctClass = pct >= 75 ? "good" : pct >= 50 ? "warn" : "bad";
    const total    = att.present + att.absent;

    const statusMsg = total === 0
      ? `<div class="info-banner" style="margin-top:0.5rem;font-size:0.78rem;">No attendance recorded yet</div>`
      : pct >= 75
      ? `<div class="att-good-msg">✅ Good standing — keep it up!</div>`
      : pct >= 50
      ? `<div class="att-warning">⚠️ Attendance below 75% — at risk!</div>`
      : `<div class="att-warning">❌ Critical! Attendance very low — contact your teacher.</div>`;

    const records = (att.records || []).slice(0, 5).map(r => `
      <div class="record-item">
        <span class="record-day">${r.slot_day}</span>
        <span class="record-date">${r.date}</span>
        <span class="${r.status === 'present' ? 'badge-present' : 'badge-absent'}">${r.status}</span>
      </div>`).join("");

    return `
      <div class="att-card">
        <div class="att-card-header">
          <div>
            <span class="att-code">${c.code}</span>
            <div class="att-name">${c.name}</div>
          </div>
          <div class="att-pct ${pctClass}">${pct}%</div>
        </div>
        <div class="progress-bar">
          <div class="progress-fill ${pctClass}" style="width:${pct}%"></div>
        </div>
        <div class="att-counts">
          <span>Present: <span class="p">${att.present}</span></span>
          <span>Absent: <span class="a">${att.absent}</span></span>
          <span>Total: ${total}</span>
        </div>
        ${statusMsg}
        ${records ? `<div class="records-list">${records}</div>` : ""}
      </div>`;
  }).join("");
}