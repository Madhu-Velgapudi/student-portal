const COLORS = ["#2d5be3","#e63946","#2a9d8f","#e76f51","#6a0572","#457b9d","#f4a261","#2d6a4f"];
let selectedColor = "#2d5be3";

async function initProfile() {
  const user = await fetchUser();
  if (user) {
    const fn = user.name.split(" ")[0];
    document.getElementById("navName").textContent    = fn;
    document.getElementById("navAvatar").textContent  = fn[0].toUpperCase();
  }

  const res  = await fetch(`${API}/profile/`, {
    headers: { "Authorization": "Bearer " + getToken() }
  });
  const data = await res.json();

  document.getElementById("profileName").textContent    = data.name;
  document.getElementById("profileEmail").textContent   = data.email;
  document.getElementById("profileCourses").textContent = data.enrolled_count;
  document.getElementById("profileSince").textContent   = data.created_at;
  document.getElementById("editName").value             = data.name;
  document.getElementById("editEmail").value            = data.email;

  selectedColor = data.avatar_color || "#2d5be3";
  const avatar  = document.getElementById("profileAvatar");
  avatar.textContent      = data.name[0].toUpperCase();
  avatar.style.background = selectedColor;

  // Render color picker
  const picker = document.getElementById("colorPicker");
  picker.innerHTML = COLORS.map(c => `
    <div class="color-dot ${c === selectedColor ? "selected" : ""}"
         style="background:${c}"
         onclick="selectColor('${c}')">
    </div>`).join("");
}

function selectColor(color) {
  selectedColor = color;
  document.getElementById("profileAvatar").style.background = color;
  document.querySelectorAll(".color-dot").forEach(d => {
    d.classList.toggle("selected", rgbToHex(d.style.background) === color);
  });
}

function rgbToHex(rgb) {
  const result = rgb.match(/\d+/g);
  if (!result) return rgb;
  return "#" + result.slice(0, 3).map(x => parseInt(x).toString(16).padStart(2, "0")).join("");
}

async function saveProfile() {
  const name = document.getElementById("editName").value.trim();
  clearAlerts("profile");
  if (!name) { showA("profileErr", "Name cannot be empty."); return; }

  const res  = await fetch(`${API}/profile/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + getToken() },
    body: JSON.stringify({ name, avatar_color: selectedColor })
  });
  const data = await res.json();
  if (res.ok) {
    showA("profileSuc", data.message);
    document.getElementById("profileName").textContent  = name;
    document.getElementById("navName").textContent      = name.split(" ")[0];
    document.getElementById("navAvatar").textContent    = name[0].toUpperCase();
    document.getElementById("profileAvatar").textContent = name[0].toUpperCase();
  } else {
    showA("profileErr", data.error);
  }
}

async function changePassword() {
  clearAlerts("pw");
  const current = document.getElementById("currentPw").value;
  const newPw   = document.getElementById("newPw").value;
  const confirm = document.getElementById("confirmPw").value;

  if (!current || !newPw || !confirm) { showA("pwErr", "All fields are required."); return; }
  if (newPw !== confirm) { showA("pwErr", "New passwords do not match."); return; }
  if (newPw.length < 6)  { showA("pwErr", "Password must be at least 6 characters."); return; }

  const res  = await fetch(`${API}/profile/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + getToken() },
    body: JSON.stringify({ current_password: current, new_password: newPw })
  });
  const data = await res.json();
  if (res.ok) {
    showA("pwSuc", data.message);
    document.getElementById("currentPw").value = "";
    document.getElementById("newPw").value     = "";
    document.getElementById("confirmPw").value = "";
  } else {
    showA("pwErr", data.error);
  }
}

function showA(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 4000);
}

function clearAlerts(prefix) {
  document.getElementById(prefix + "Err")?.classList.remove("show");
  document.getElementById(prefix + "Suc")?.classList.remove("show");
}