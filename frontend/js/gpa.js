async function loadMyGPA() {
  const container = document.getElementById("gpaContainer");

  try {
    const res  = await fetch(`${API}/marks/my`, {
      headers: { "Authorization": "Bearer " + getToken() }
    });
    const data = await res.json();

    if (!data.marks || !data.marks.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📊</div>
          <h3>No marks yet</h3>
          <p>Your teacher hasn't entered any marks yet. Check back later.</p>
        </div>`;
      return;
    }

    const cgpa     = data.cgpa;
    const cgpaColor = cgpa >= 8.5 ? "cgpa-color-excellent"
                    : cgpa >= 7.0 ? "cgpa-color-good"
                    : cgpa >= 5.5 ? "cgpa-color-average"
                    : "cgpa-color-low";

    const cgpaLabel = cgpa >= 9.5 ? "Outstanding 🏆"
                    : cgpa >= 8.5 ? "Excellent ⭐"
                    : cgpa >= 7.5 ? "Very Good 👍"
                    : cgpa >= 6.5 ? "Good ✓"
                    : cgpa >= 5.5 ? "Average"
                    : "Needs Improvement";

    container.innerHTML = `
      <!-- STATS ROW -->
      <div class="gpa-hero">
        <div class="gpa-stat">
          <div class="val ${cgpaColor}">${cgpa.toFixed(2)}</div>
          <div class="lbl">CGPA (10 Scale)</div>
          <div style="font-size:0.82rem;color:var(--muted);margin-top:4px;">${cgpaLabel}</div>
        </div>
        <div class="gpa-stat">
          <div class="val" style="color:var(--accent);">${data.total_credits}</div>
          <div class="lbl">Total Credits</div>
        </div>
        <div class="gpa-stat">
          <div class="val" style="color:var(--green);">${data.marks.length}</div>
          <div class="lbl">Subjects</div>
        </div>
        <div class="gpa-stat">
          <div class="val" style="color:var(--gold);">${((cgpa / 10) * 100).toFixed(1)}%</div>
          <div class="lbl">Approx %</div>
        </div>
      </div>

      <!-- MARKS TABLE -->
      <table class="marks-table">
        <thead>
          <tr>
            <th>Subject</th>
            <th>Credits</th>
            <th>Marks</th>
            <th>Grade</th>
            <th>Grade Points</th>
            <th>Entered By</th>
          </tr>
        </thead>
        <tbody>
          ${data.marks.map(m => {
            const barColor = m.marks >= 75 ? "#1a7a4a" : m.marks >= 50 ? "#b5861a" : "#c0392b";
            return `
              <tr>
                <td>
                  <div style="font-weight:600;">${m.course_name}</div>
                  <div style="font-size:0.75rem;color:var(--muted);">${m.course_code}</div>
                </td>
                <td style="font-weight:600;">${m.credits}</td>
                <td>
                  <div style="font-weight:700;font-size:1rem;">${m.marks}<span style="font-size:0.75rem;color:var(--muted);font-weight:400;">/100</span></div>
                  <div class="marks-bar"><div class="marks-bar-fill" style="width:${m.marks}%;background:${barColor};"></div></div>
                </td>
                <td><span class="grade-badge grade-${m.grade}">${m.grade}</span></td>
                <td style="font-weight:700;font-family:var(--font-head);">${m.grade_points.toFixed(1)}</td>
                <td style="color:var(--muted);font-size:0.82rem;">${m.posted_by}</td>
              </tr>`;
          }).join("")}
        </tbody>
      </table>`;

  } catch {
    document.getElementById("gpaContainer").innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <h3>Could not load marks</h3>
        <p>Make sure the backend is running.</p>
      </div>`;
  }
}