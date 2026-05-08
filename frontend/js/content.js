const MATERIAL_ICONS = {
  link:  { icon: "🔗", cls: "type-link"  },
  note:  { icon: "📝", cls: "type-note"  },
  video: { icon: "🎬", cls: "type-video" },
  pdf:   { icon: "📄", cls: "type-pdf"   }
};

async function loadContent(courseId) {
  try {
    const res  = await fetch(`${API}/content/${courseId}/all`, {
      headers: { "Authorization": "Bearer " + getToken() }
    });
    const data = await res.json();

    renderHero(data.course);
    renderAnnouncements(data.announcements);
    renderSyllabus(data.syllabus);
    renderMaterials(data.materials);

    // Update tab badges
    document.getElementById("annCount").textContent = data.announcements.length;
    document.getElementById("sylCount").textContent = data.syllabus.length;
    document.getElementById("matCount").textContent = data.materials.length;

  } catch (e) {
    document.getElementById("courseHero").innerHTML = `<p style="color:var(--red)">Failed to load course content.</p>`;
  }
}

function renderHero(course) {
  if (!course || !course.name) {
    document.getElementById("courseHero").innerHTML = `<h1 style="font-family:var(--font-head)">Course Content</h1>`;
    return;
  }
  document.title = `${course.name} — Student Portal`;
  document.getElementById("courseHero").innerHTML = `
    <div class="course-hero-left">
      <h1>${course.name}</h1>
      <p>${course.department}</p>
      <div class="course-hero-badges">
        <span class="hero-badge badge-code">${course.code}</span>
        <span class="hero-badge badge-dept">🏛 ${course.department}</span>
        <span class="hero-badge badge-credits">⭐ ${course.credits} Credits</span>
      </div>
    </div>`;
}

function renderAnnouncements(announcements) {
  const el = document.getElementById("announcementsList");
  if (!announcements.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📢</div><h3>No announcements yet</h3><p>Check back later for updates from your instructor.</p></div>`;
    return;
  }
  el.innerHTML = announcements.map(a => `
    <div class="announcement-card">
      <div class="ann-header">
        <div class="ann-title">${a.title}</div>
        <div class="ann-date">${a.created_at}</div>
      </div>
      <div class="ann-msg">${a.message}</div>
      <div class="ann-by">— ${a.posted_by}</div>
    </div>`).join("");
}

function renderSyllabus(syllabus) {
  const el = document.getElementById("syllabusList");
  if (!syllabus.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📅</div><h3>Syllabus not added yet</h3><p>Your instructor hasn't added the syllabus yet.</p></div>`;
    return;
  }
  el.innerHTML = syllabus.map(s => `
    <div class="syllabus-item">
      <div class="week-badge">
        <span class="week-label">Week</span>
        <span class="week-num">${s.week}</span>
      </div>
      <div>
        <div class="syllabus-topic">${s.topic}</div>
        ${s.description ? `<div class="syllabus-desc">${s.description}</div>` : ""}
      </div>
    </div>`).join("");
}

function renderMaterials(materials) {
  const el = document.getElementById("materialsList");
  if (!materials.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📚</div><h3>No materials yet</h3><p>Your instructor hasn't uploaded any materials yet.</p></div>`;
    return;
  }
  el.innerHTML = materials.map(m => {
    const { icon, cls } = MATERIAL_ICONS[m.material_type] || MATERIAL_ICONS.link;
    return `
      <div class="material-card">
        <div class="material-type-icon ${cls}">${icon}</div>
        <div class="material-title">${m.title}</div>
        ${m.description ? `<div class="material-desc">${m.description}</div>` : ""}
        <div class="material-footer">
          <div class="material-meta">By ${m.posted_by} · ${m.created_at}</div>
          ${m.url ? `<a href="${m.url}" target="_blank" class="btn-open-material">Open →</a>` : ""}
        </div>
      </div>`;
  }).join("");
}