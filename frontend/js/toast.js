// ══════════════════════════════════════
// TOAST NOTIFICATION SYSTEM
// Replace all alert() and confirm() calls
// ══════════════════════════════════════

function showToast(message, type = "success", duration = 3000) {
  // Create container if it doesn't exist
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.style.cssText = `
      position: fixed; bottom: 24px; right: 24px;
      display: flex; flex-direction: column; gap: 10px;
      z-index: 9999; pointer-events: none;
    `;
    document.body.appendChild(container);
  }

  const icons = {
    success: "✅",
    error:   "❌",
    warning: "⚠️",
    info:    "ℹ️",
    loading: "⏳"
  };

  const colors = {
    success: { bg: "#f0fdf4", border: "#86efac", text: "#15803d" },
    error:   { bg: "#fef2f2", border: "#fca5a5", text: "#dc2626" },
    warning: { bg: "#fffbeb", border: "#fcd34d", text: "#d97706" },
    info:    { bg: "#eff6ff", border: "#93c5fd", text: "#2563eb" },
    loading: { bg: "#f8fafc", border: "#cbd5e1", text: "#475569" }
  };

  const c = colors[type] || colors.info;

  const toast = document.createElement("div");
  toast.style.cssText = `
    display: flex; align-items: center; gap: 10px;
    padding: 12px 18px; border-radius: 10px;
    background: ${c.bg}; border: 1.5px solid ${c.border};
    color: ${c.text}; font-family: 'Instrument Sans', sans-serif;
    font-size: 0.88rem; font-weight: 500;
    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    pointer-events: all; cursor: pointer;
    max-width: 340px; min-width: 220px;
    transform: translateX(120%); opacity: 0;
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  `;

  toast.innerHTML = `
    <span style="font-size:1.1rem;flex-shrink:0;">${icons[type] || icons.info}</span>
    <span style="flex:1;line-height:1.4;">${message}</span>
    <span style="font-size:1rem;opacity:0.5;margin-left:4px;flex-shrink:0;">✕</span>
  `;

  container.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.style.transform = "translateX(0)";
      toast.style.opacity   = "1";
    });
  });

  // Click to dismiss
  toast.addEventListener("click", () => dismissToast(toast));

  // Auto dismiss
  if (duration > 0) {
    setTimeout(() => dismissToast(toast), duration);
  }

  return toast;
}

function dismissToast(toast) {
  toast.style.transform  = "translateX(120%)";
  toast.style.opacity    = "0";
  setTimeout(() => toast.remove(), 300);
}

// Convenience functions
function toastSuccess(msg, duration = 3000) { return showToast(msg, "success", duration); }
function toastError(msg,   duration = 4000) { return showToast(msg, "error",   duration); }
function toastWarning(msg, duration = 4000) { return showToast(msg, "warning", duration); }
function toastInfo(msg,    duration = 3000) { return showToast(msg, "info",    duration); }
function toastLoading(msg)                  { return showToast(msg, "loading", 0); }

// Custom confirm dialog (replaces browser confirm)
function showConfirm(message, onConfirm, onCancel) {
  const overlay = document.createElement("div");
  overlay.style.cssText = `
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.4); backdrop-filter: blur(4px);
    z-index: 10000; display: flex; align-items: center; justify-content: center;
    animation: fadeIn 0.2s ease;
  `;

  overlay.innerHTML = `
    <div style="
      background: white; border-radius: 16px; padding: 2rem;
      max-width: 380px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.2);
      animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    ">
      <div style="font-size:2rem;text-align:center;margin-bottom:1rem;">🤔</div>
      <div style="font-family:'Instrument Sans',sans-serif;font-weight:700;font-size:1rem;text-align:center;margin-bottom:0.5rem;color:#1a1a2e;">
        Are you sure?
      </div>
      <div style="font-family:'Instrument Sans',sans-serif;font-size:0.88rem;text-align:center;color:#6b7280;margin-bottom:1.5rem;line-height:1.5;">
        ${message}
      </div>
      <div style="display:flex;gap:10px;">
        <button id="confirmCancel" style="
          flex:1;padding:10px;border:1.5px solid #e5e7eb;border-radius:8px;
          background:white;font-family:'Instrument Sans',sans-serif;font-size:0.88rem;
          font-weight:600;cursor:pointer;color:#6b7280;transition:all 0.15s;
        ">Cancel</button>
        <button id="confirmOk" style="
          flex:1;padding:10px;border:none;border-radius:8px;
          background:#ef4444;font-family:'Instrument Sans',sans-serif;font-size:0.88rem;
          font-weight:700;cursor:pointer;color:white;transition:all 0.15s;
        ">Confirm</button>
      </div>
    </div>
    <style>
      @keyframes fadeIn  { from { opacity:0 } to { opacity:1 } }
      @keyframes slideUp { from { transform:translateY(20px);opacity:0 } to { transform:translateY(0);opacity:1 } }
    </style>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector("#confirmOk").addEventListener("click", () => {
    overlay.remove();
    if (onConfirm) onConfirm();
  });
  overlay.querySelector("#confirmCancel").addEventListener("click", () => {
    overlay.remove();
    if (onCancel) onCancel();
  });
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) { overlay.remove(); if (onCancel) onCancel(); }
  });
}