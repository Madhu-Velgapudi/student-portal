function getToken() {
  return localStorage.getItem("sp_token");
}

function requireAuth() {
  if (!getToken()) {
    window.location.href = "login.html";
  }
}

function logout() {
  localStorage.removeItem("sp_token");
  localStorage.removeItem("sp_user");
  window.location.href = "login.html";
}

async function fetchUser() {
  const res = await fetch(`${API}/auth/me`, {
    headers: { "Authorization": "Bearer " + getToken() }
  });

  if (res.status === 401) {
    // Token expired — show message then redirect
    alert("Your session has expired. Please log in again.");
    logout();
    return null;
  }

  if (res.status === 403) {
    // Account deactivated
    alert("Your account has been deactivated. Please contact the administrator.");
    logout();
    return null;
  }

  if (!res.ok) {
    logout();
    return null;
  }

  const user = await res.json();
  localStorage.setItem("sp_user", JSON.stringify(user));
  return user;
}

// ── REGISTER ──
async function register() {
  const btn      = document.getElementById("registerBtn");
  const name     = document.getElementById("name").value.trim();
  const email    = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  clearAlerts();
  if (!name || !email || !password) { showErr("All fields are required."); return; }
  if (password.length < 6) { showErr("Password must be at least 6 characters."); return; }

  btn.disabled    = true;
  btn.textContent = "Creating account...";

  try {
    const res  = await fetch(`${API}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();
    if (res.ok) {
      showSuccess(data.message + " Check your inbox.");
      btn.textContent = "Done! Check your email ✓";
    } else {
      showErr(data.error || "Registration failed.");
      btn.disabled    = false;
      btn.textContent = "Create Account";
    }
  } catch {
    showErr("Cannot connect to server. Is the backend running?");
    btn.disabled    = false;
    btn.textContent = "Create Account";
  }
}

// ── LOGIN ──
async function login() {
  const btn      = document.getElementById("loginBtn");
  const email    = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  clearAlerts();
  if (!email || !password) { showErr("Email and password are required."); return; }

  btn.disabled    = true;
  btn.textContent = "Logging in...";

  try {
    const res  = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem("sp_token", data.token);
      localStorage.setItem("sp_user",  JSON.stringify(data.user));
      window.location.href = "dashboard.html";
    } else {
      showErr(data.error || "Login failed.");
      btn.disabled    = false;
      btn.textContent = "Log In →";
    }
  } catch {
    showErr("Cannot connect to server. Is the backend running?");
    btn.disabled    = false;
    btn.textContent = "Log In →";
  }
}

// ── ALERT HELPERS ──
function showErr(msg) {
  const el = document.getElementById("errMsg");
  if (el) { el.textContent = msg; el.classList.add("show"); }
}
function showSuccess(msg) {
  const el = document.getElementById("successMsg");
  if (el) { el.textContent = msg; el.classList.add("show"); }
}
function clearAlerts() {
  document.querySelectorAll(".alert").forEach(el => el.classList.remove("show"));
}

// Allow Enter key on login/register pages
document.addEventListener("keydown", e => {
  if (e.key !== "Enter") return;
  if (document.getElementById("name")) register();
  else if (document.getElementById("loginBtn")) login();
});