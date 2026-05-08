const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

async function loadTimetable() {
  const container = document.getElementById("timetableContainer");

  try {
    const res = await fetch(`${API}/timetable/`, {
      headers: { "Authorization": "Bearer " + getToken() }
    });

    if (!res.ok) { container.innerHTML = `<div class="empty-state"><h3>Error loading timetable</h3></div>`; return; }

    const timetable = await res.json();
    const hasAny = DAYS.some(d => timetable[d] && timetable[d].length > 0);

    if (!hasAny) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No timetable yet</h3>
          <p>Enroll in courses first to generate your timetable.</p>
          <a href="courses.html" style="color:var(--accent); text-decoration:none; margin-top:1rem; display:inline-block;">Browse Courses →</a>
        </div>`;
      return;
    }

    let html = `
      <div class="timetable-wrapper">
        <table class="timetable">
          <thead>
            <tr>
              <th>Day</th>
              <th>Course</th>
              <th>Time</th>
              <th>Room</th>
              <th>Credits</th>
            </tr>
          </thead>
          <tbody>`;

    for (const day of DAYS) {
      const slots = timetable[day] || [];
      if (!slots.length) continue;

      slots.forEach((slot, i) => {
        html += `
          <tr>
            ${i === 0 ? `<td rowspan="${slots.length}" class="day-cell">${day}</td>` : ""}
            <td>
              <div class="course-name-cell">${slot.course_name}</div>
              <div class="course-code-tag">${slot.course_code}</div>
            </td>
            <td><span class="time-badge">${slot.start} – ${slot.end}</span></td>
            <td><span class="room-badge">${slot.room}</span></td>
            <td style="text-align:center;font-weight:700;">${slot.credits}</td>
          </tr>`;
      });
    }

    html += `</tbody></table></div>`;
    container.innerHTML = html;

  } catch {
    container.innerHTML = `<div class="empty-state"><h3>Could not connect to server</h3><p>Make sure the backend is running on port 5000.</p></div>`;
  }
}