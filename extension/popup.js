const API_BASE = "http://127.0.0.1:8000/api/deadlines";
const WEB_URL = "http://127.0.0.1:8000";

// Fallback demo data if backend is not reachable
const FALLBACK_DEMO_DATA = [
  {
    id: "demo-ext-1",
    title: "AI Research Paper Draft Submission",
    due: new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString(),
    source: "Gmail",
    priority: "URGENT",
    priorityScore: 95,
    actionSummary: "Submit final drafted paper PDF to conference portal.",
  },
  {
    id: "demo-ext-2",
    title: "Quarterly Taxes & Invoice Approval",
    due: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    source: "Gmail",
    priority: "HIGH",
    priorityScore: 80,
    actionSummary: "Review accounts invoice and submit payment.",
  },
  {
    id: "demo-ext-3",
    title: "Team Sprint Demo Presentation",
    due: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
    source: "Google Calendar",
    priority: "MEDIUM",
    priorityScore: 55,
    actionSummary: "Prepare sprint demo slides.",
  },
  {
    id: "demo-ext-4",
    title: "Client Contract Confirmation Deadline",
    due: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    source: "Gmail",
    priority: "HIGH",
    priorityScore: 85,
    actionSummary: "Overdue client contract signature follow-up.",
  },
];

const FALLBACK_IGNORED_DATA = [
  {
    title: "⚡ 50% Off Flash Sale Ends Tonight!",
    ignoreReason: "Filtered promotional marketing offer",
  },
  {
    title: "Your Weekly Digest: Top Tech News",
    ignoreReason: "Informational newsletter without pending tasks",
  },
];

function formatDate(dateStr) {
  if (!dateStr) return "No Due Date";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "No Due Date";

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getTimeRemainingText(dateStr) {
  if (!dateStr) return "";
  const due = new Date(dateStr);
  if (isNaN(due.getTime())) return "";

  const diffMs = due.getTime() - Date.now();
  const isPast = diffMs < 0;
  const absDiff = Math.abs(diffMs);

  const hours = Math.round(absDiff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days >= 1) {
    const dayStr = `${days}d`;
    return isPast ? `${dayStr} ago` : `in ${dayStr}`;
  }

  const hourStr = `${hours}h`;
  return isPast ? `${hourStr} ago` : `in ${hourStr}`;
}

function createCard(item, isMissed = false) {
  const card = document.createElement("div");

  let priorityClass = (item.priority || "safe").toLowerCase();
  if (isMissed) {
    priorityClass = "missed";
  } else if (!item.priority && item.due) {
    const diffDays = (new Date(item.due).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    if (diffDays < 1) priorityClass = "urgent";
    else if (diffDays < 3) priorityClass = "soon";
    else priorityClass = "safe";
  }

  card.className = `deadline-card ${priorityClass}`;

  // Header
  const header = document.createElement("div");
  header.className = "card-header";

  const titleGroup = document.createElement("div");
  titleGroup.className = "card-title-group";

  const title = document.createElement("h3");
  title.textContent = item.title || "Untitled Deadline";
  titleGroup.appendChild(title);

  if (item.priorityScore) {
    const score = document.createElement("span");
    score.className = `score-badge ${priorityClass}`;
    score.textContent = `${item.priorityScore}/100`;
    titleGroup.appendChild(score);
  }

  header.appendChild(titleGroup);

  const badge = document.createElement("span");
  badge.className = `badge source-${(item.source || "general").toLowerCase().replace(/\s+/g, "-")}`;
  badge.textContent = item.source || "General";
  header.appendChild(badge);

  card.appendChild(header);

  // Action Summary
  if (item.actionSummary) {
    const actionBox = document.createElement("div");
    actionBox.className = "action-box";
    actionBox.textContent = `💡 ${item.actionSummary}`;
    card.appendChild(actionBox);
  }

  // Details
  const details = document.createElement("div");
  details.className = "card-details";

  const dateSpan = document.createElement("span");
  dateSpan.textContent = formatDate(item.due);
  details.appendChild(dateSpan);

  const countdown = getTimeRemainingText(item.due);
  if (countdown) {
    const remainingSpan = document.createElement("span");
    remainingSpan.className = `time-remaining ${isMissed ? "overdue" : priorityClass}`;
    remainingSpan.textContent = countdown;
    details.appendChild(remainingSpan);
  }

  card.appendChild(details);

  // Action Buttons
  const actionsBar = document.createElement("div");
  actionsBar.className = "card-actions-bar";

  const btnSync = document.createElement("button");
  btnSync.className = "popup-btn sync";
  btnSync.textContent = "📅 Add to Cal";
  btnSync.addEventListener("click", async (e) => {
    e.stopPropagation();
    btnSync.disabled = true;
    btnSync.textContent = "⏳ Adding...";
    try {
      const res = await fetch(`${API_BASE}/calendar/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: item.title,
          due: item.due,
          actionSummary: item.actionSummary,
        }),
      });
      const data = await res.json();
      btnSync.textContent = data.success ? "✅ Added" : "⚠️ Error";
    } catch {
      btnSync.textContent = "⚠️ Offline";
    }
  });
  actionsBar.appendChild(btnSync);

  if (item.link) {
    const btnLink = document.createElement("button");
    btnLink.className = "popup-btn open";
    btnLink.textContent = item.source === "Gmail" ? "✉️ Email" : "↗ Event";
    btnLink.addEventListener("click", () => {
      if (typeof chrome !== "undefined" && chrome.tabs) {
        chrome.tabs.create({ url: item.link });
      } else {
        window.open(item.link, "_blank");
      }
    });
    actionsBar.appendChild(btnLink);
  }

  card.appendChild(actionsBar);
  return card;
}

function render(deadlines, ignored = []) {
  const upcomingList = document.getElementById("upcoming-list");
  const missedList = document.getElementById("missed-list");
  const ignoredList = document.getElementById("ignored-list");

  const activeBadge = document.getElementById("tab-active-count");
  const missedBadge = document.getElementById("tab-missed-count");
  const ignoredBadge = document.getElementById("tab-ignored-count");

  upcomingList.innerHTML = "";
  missedList.innerHTML = "";
  ignoredList.innerHTML = "";

  const now = Date.now();
  const upcoming = deadlines
    .filter(d => !d.due || new Date(d.due).getTime() >= now)
    .sort((a, b) => {
      if (b.priorityScore && a.priorityScore && b.priorityScore !== a.priorityScore) {
        return b.priorityScore - a.priorityScore;
      }
      if (!a.due) return 1;
      if (!b.due) return -1;
      return new Date(a.due).getTime() - new Date(b.due).getTime();
    });

  const missed = deadlines
    .filter(d => d.due && new Date(d.due).getTime() < now)
    .sort((a, b) => new Date(b.due).getTime() - new Date(a.due).getTime());

  activeBadge.textContent = upcoming.length;
  missedBadge.textContent = missed.length;
  ignoredBadge.textContent = ignored.length;

  if (upcoming.length === 0) {
    upcomingList.innerHTML = `<div class="empty-state">🎉 No upcoming deadlines!</div>`;
  } else {
    upcoming.forEach(d => upcomingList.appendChild(createCard(d, false)));
  }

  if (missed.length === 0) {
    missedList.innerHTML = `<div class="empty-state">✅ All caught up! No missed deadlines.</div>`;
  } else {
    missed.forEach(d => missedList.appendChild(createCard(d, true)));
  }

  if (ignored.length === 0) {
    ignoredList.innerHTML = `<div class="empty-state">🛡️ No promotional clutter detected.</div>`;
  } else {
    ignored.forEach(item => {
      const row = document.createElement("div");
      row.className = "ignored-card";
      row.innerHTML = `
        <div class="ignored-header">
          <strong>${escapeHtml(item.title || "Promotional Mail")}</strong>
          <span class="badge source-gmail">Filtered</span>
        </div>
        <div class="ignored-reason">🛡️ ${escapeHtml(item.ignoreReason || "Marketing content")}</div>
      `;
      ignoredList.appendChild(row);
    });
  }
}

function escapeHtml(str) {
  if (!str) return "";
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

async function loadDeadlines() {
  const statusPill = document.getElementById("status-pill");
  const banner = document.getElementById("notice-banner");
  const btnConnect = document.getElementById("btn-connect");
  const btnLogoutExt = document.getElementById("btn-logout-ext");

  statusPill.textContent = "Checking...";
  statusPill.className = "status-pill checking";

  try {
    const statusRes = await fetch(`${API_BASE}/status`, { cache: "no-store" });
    const statusData = await statusRes.json();

    if (statusData.hasApiDisabledWarning) {
      statusPill.textContent = "⚠️ APIs Need Enabling";
      statusPill.className = "status-pill demo";
      banner.textContent = "⚠️ Gmail or Calendar API disabled in Google Cloud Console. Enable them and refresh.";
      banner.style.display = "block";
      if (btnConnect) btnConnect.style.display = "none";
      if (btnLogoutExt) btnLogoutExt.style.display = "block";
    } else if (statusData.hasAuthWarning) {
      statusPill.textContent = "🟡 Session Expired";
      statusPill.className = "status-pill demo";
      banner.textContent = "⚠️ Google OAuth session expired. Click 'Connect Google Account' below to sign in.";
      banner.style.display = "block";
      if (btnConnect) btnConnect.style.display = "block";
      if (btnLogoutExt) btnLogoutExt.style.display = "none";
    } else if (statusData.configured) {
      statusPill.textContent = statusData.isGeminiConfigured ? "🟢 Gemini Live" : "🟢 Google Live";
      statusPill.className = "status-pill connected";
      banner.style.display = "none";
      if (btnConnect) btnConnect.style.display = "none";
      if (btnLogoutExt) btnLogoutExt.style.display = "block";
    } else {
      statusPill.textContent = "🟡 AI Demo Mode";
      statusPill.className = "status-pill demo";
      banner.textContent = "ℹ️ Running in AI Demo mode. Click 'Connect Google Account' below to link live Gmail.";
      banner.style.display = "block";
      if (btnConnect) btnConnect.style.display = "block";
      if (btnLogoutExt) btnLogoutExt.style.display = "none";
    }

    const res = await fetch(`${API_BASE}/google/all`, { cache: "no-store" });
    const data = await res.json();
    const items = Array.isArray(data) ? data : (data.deadlines || []);
    const ignored = data.ignored || [];
    render(items, ignored);
  } catch (err) {
    statusPill.textContent = "⚪ Offline Preview";
    statusPill.className = "status-pill offline";
    banner.textContent = "⚠️ Backend offline. Showing preview data. Run `npm start` in your project folder.";
    banner.style.display = "block";
    if (btnConnect) btnConnect.style.display = "block";
    if (btnLogoutExt) btnLogoutExt.style.display = "none";
    render(FALLBACK_DEMO_DATA, FALLBACK_IGNORED_DATA);
  }
}

// Tab Switching
function setupTabs() {
  const buttons = document.querySelectorAll(".tab-btn");
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      buttons.forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(tc => tc.classList.remove("active"));

      btn.classList.add("active");
      const targetId = `tab-${btn.dataset.tab}`;
      const targetEl = document.getElementById(targetId);
      if (targetEl) targetEl.classList.add("active");
    });
  });
}

// Event Listeners
document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  loadDeadlines();

  document.getElementById("btn-refresh").addEventListener("click", () => {
    loadDeadlines();
  });

  document.getElementById("btn-open-web").addEventListener("click", () => {
    if (typeof chrome !== "undefined" && chrome.tabs) {
      chrome.tabs.create({ url: WEB_URL });
    } else {
      window.open(WEB_URL, "_blank");
    }
  });

  const btnConnect = document.getElementById("btn-connect");
  if (btnConnect) {
    btnConnect.addEventListener("click", async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/url`);
        const data = await res.json();
        const loginUrl = data.url || `${API_BASE}/auth/login`;

        if (typeof chrome !== "undefined" && chrome.tabs) {
          chrome.tabs.create({ url: loginUrl });
        } else {
          window.open(loginUrl, "_blank");
        }
      } catch {
        alert("Backend server is not running. Please run `npm start` in your terminal.");
      }
    });
  }

  const btnLogoutExt = document.getElementById("btn-logout-ext");
  if (btnLogoutExt) {
    btnLogoutExt.addEventListener("click", async () => {
      if (!confirm("Are you sure you want to disconnect your Google account?")) return;
      try {
        await fetch(`${API_BASE}/auth/logout`, { method: "POST" });
        alert("✅ Disconnected Google account.");
        loadDeadlines();
      } catch (err) {
        alert("Error disconnecting: " + err.message);
      }
    });
  }
});
