// Detect API base URL dynamically
const API_BASE = window.location.port === "8000"
  ? `${window.location.origin}/api/deadlines`
  : "http://127.0.0.1:8000/api/deadlines";

function formatDate(dateStr) {
  if (!dateStr) return "No Due Date";
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? "No Due Date" : date.toLocaleString(undefined, {
    weekday: "short",
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
    const dayStr = `${days} day${days > 1 ? "s" : ""}`;
    return isPast ? `Overdue by ${dayStr}` : `Due in ${dayStr}`;
  }

  const hourStr = `${hours} hour${hours > 1 ? "s" : ""}`;
  return isPast ? `Overdue by ${hourStr}` : `Due in ${hourStr}`;
}

// Create rich deadline card
function createDeadlineCard(deadline, isMissed = false) {
  const card = document.createElement("div");

  let priorityClass = (deadline.priority || "safe").toLowerCase();
  if (isMissed) {
    priorityClass = "missed";
  } else if (!deadline.priority && deadline.due) {
    const diffDays = (new Date(deadline.due).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    if (diffDays < 1) priorityClass = "urgent";
    else if (diffDays < 3) priorityClass = "soon";
    else priorityClass = "safe";
  }

  card.className = `deadline-card ${priorityClass}`;

  // Card Top Header
  const headerDiv = document.createElement("div");
  headerDiv.className = "card-header";

  const titleGroup = document.createElement("div");
  titleGroup.className = "card-title-group";

  const title = document.createElement("h3");
  title.textContent = deadline.title || "Untitled Task";
  titleGroup.appendChild(title);

  if (deadline.priorityScore) {
    const scoreBadge = document.createElement("span");
    scoreBadge.className = `score-badge ${priorityClass}`;
    scoreBadge.textContent = `Score: ${deadline.priorityScore}/100`;
    titleGroup.appendChild(scoreBadge);
  }

  headerDiv.appendChild(titleGroup);

  const sourceBadge = document.createElement("span");
  sourceBadge.className = `badge source-${(deadline.source || "general").toLowerCase().replace(/\s+/g, "-")}`;
  sourceBadge.textContent = deadline.source || "General";
  headerDiv.appendChild(sourceBadge);

  card.appendChild(headerDiv);

  // Action Item Summary
  if (deadline.actionSummary) {
    const actionBox = document.createElement("div");
    actionBox.className = "action-summary-box";
    actionBox.innerHTML = `<strong>💡 Action Item:</strong> ${escapeHtml(deadline.actionSummary)}`;
    card.appendChild(actionBox);
  }

  // Card Details (Date + Countdown)
  const detailsDiv = document.createElement("div");
  detailsDiv.className = "card-details";

  const duePara = document.createElement("p");
  duePara.className = "due-date";
  duePara.innerHTML = `<strong>${isMissed ? "Was due:" : "Due:"}</strong> ${formatDate(deadline.due)}`;
  detailsDiv.appendChild(duePara);

  const countdown = getTimeRemainingText(deadline.due);
  if (countdown) {
    const countdownPara = document.createElement("span");
    countdownPara.className = `time-remaining ${isMissed ? "overdue" : priorityClass}`;
    countdownPara.textContent = countdown;
    detailsDiv.appendChild(countdownPara);
  }

  card.appendChild(detailsDiv);

  // Card Action Buttons
  const actionsBar = document.createElement("div");
  actionsBar.className = "card-actions-bar";

  const btnSyncCal = document.createElement("button");
  btnSyncCal.className = "card-action-btn sync-cal";
  btnSyncCal.innerHTML = "📅 Add to Calendar";
  btnSyncCal.addEventListener("click", async (e) => {
    e.stopPropagation();
    btnSyncCal.disabled = true;
    btnSyncCal.textContent = "⏳ Adding...";
    try {
      const res = await fetch(`${API_BASE}/calendar/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: deadline.title,
          due: deadline.due,
          actionSummary: deadline.actionSummary,
          link: deadline.link,
        }),
      });
      const data = await res.json();
      if (data.success) {
        btnSyncCal.textContent = data.simulated ? "✅ Simulated Event" : "✅ Added to Calendar!";
        btnSyncCal.classList.add("added");
      } else {
        btnSyncCal.textContent = "⚠️ Failed to add";
      }
    } catch {
      btnSyncCal.textContent = "⚠️ Server error";
    }
  });
  actionsBar.appendChild(btnSyncCal);

  if (deadline.link) {
    const btnOpen = document.createElement("a");
    btnOpen.className = "card-action-btn open-link";
    btnOpen.href = deadline.link;
    btnOpen.target = "_blank";
    btnOpen.textContent = deadline.source === "Gmail" ? "✉️ View Email" : "↗ Open Event";
    actionsBar.appendChild(btnOpen);
  }

  card.appendChild(actionsBar);
  return card;
}

// Render Filtered Clutter
function renderIgnoredList(ignored) {
  const container = document.getElementById("ignored-list");
  const countEl = document.getElementById("ignored-count");
  if (!container) return;

  container.innerHTML = "";
  if (countEl) countEl.textContent = ignored.length;

  if (ignored.length === 0) {
    container.innerHTML = `<p class="placeholder-text">No marketing clutter detected.</p>`;
    return;
  }

  ignored.forEach(item => {
    const row = document.createElement("div");
    row.className = "ignored-item";
    row.innerHTML = `
      <div class="ignored-header">
        <span class="ignored-title">${escapeHtml(item.title || "Promotional Email")}</span>
        <span class="ignored-tag">Filtered</span>
      </div>
      <p class="ignored-reason">🛡️ ${escapeHtml(item.ignoreReason || "Marketing content")}</p>
    `;
    container.appendChild(row);
  });
}

function renderDeadlines(active, missed) {
  const activeList = document.getElementById("deadline-list");
  const missedList = document.getElementById("missed-deadline-list");
  const activeCount = document.getElementById("active-count");
  const missedCount = document.getElementById("missed-count");

  activeList.innerHTML = "";
  missedList.innerHTML = "";

  if (activeCount) activeCount.textContent = active.length;
  if (missedCount) missedCount.textContent = missed.length;

  if (active.length === 0) {
    activeList.innerHTML = `
      <div class="empty-state">
        <p>🎉 No upcoming deadlines right now!</p>
      </div>`;
  } else {
    active.forEach(item => {
      activeList.appendChild(createDeadlineCard(item, false));
    });
  }

  if (missed.length === 0) {
    missedList.innerHTML = `
      <div class="empty-state">
        <p>✅ All caught up! No missed deadlines.</p>
      </div>`;
  } else {
    missed.forEach(item => {
      missedList.appendChild(createDeadlineCard(item, true));
    });
  }
}

// Fetch Daily AI Briefing
async function fetchDailyDigest() {
  const greetingEl = document.getElementById("digest-greeting");
  const narrativeEl = document.getElementById("digest-narrative");
  const statUrgent = document.getElementById("stat-urgent");
  const statUpcoming = document.getElementById("stat-upcoming");
  const statIgnored = document.getElementById("stat-ignored");

  try {
    const res = await fetch(`${API_BASE}/ai/digest`);
    if (!res.ok) return;
    const data = await res.json();
    if (!data.digest) return;

    const d = data.digest;
    if (greetingEl) greetingEl.textContent = d.greeting || "Good morning!";
    if (narrativeEl) narrativeEl.textContent = d.narrative || d.summary;
    if (statUrgent) statUrgent.textContent = d.stats?.urgentCount ?? 0;
    if (statUpcoming) statUpcoming.textContent = d.stats?.upcomingCount ?? 0;
    if (statIgnored) statIgnored.textContent = d.stats?.ignoredCount ?? 0;
  } catch (err) {
    console.warn("Could not load AI digest:", err.message);
  }
}

async function checkStatus() {
  const statusBadge = document.getElementById("connection-status");
  const aiBadge = document.getElementById("ai-status");
  const demoNotice = document.getElementById("demo-notice");
  const btnGoogle = document.getElementById("btn-connect-google");
  const btnGmail = document.getElementById("btn-connect-gmail");
  const btnLogout = document.getElementById("btn-logout");

  try {
    const res = await fetch(`${API_BASE}/status`);
    if (!res.ok) throw new Error("Status check failed");
    const data = await res.json();

    if (data.hasApiDisabledWarning) {
      statusBadge.textContent = "⚠️ APIs Need Enabling";
      statusBadge.className = "status-badge demo";
      if (demoNotice) {
        demoNotice.innerHTML = `
          ⚠️ <strong>Action Required: Enable Google APIs in Google Cloud Console:</strong><br/>
          Your account is authorized, but the Gmail API and Google Calendar API need to be turned on in your Google Cloud Project.<br/><br/>
          👉 <a href="https://console.developers.google.com/apis/api/gmail.googleapis.com/overview" target="_blank" style="color: #2563eb; font-weight: bold; text-decoration: underline;">1. Click Here to Enable Gmail API</a><br/>
          👉 <a href="https://console.developers.google.com/apis/api/calendar-json.googleapis.com/overview" target="_blank" style="color: #2563eb; font-weight: bold; text-decoration: underline;">2. Click Here to Enable Google Calendar API</a><br/><br/>
          <em>Click both links, press the blue "ENABLE" button on each page, wait 1 minute, and click Refresh!</em>
        `;
        demoNotice.style.display = "block";
      }
      if (btnLogout) btnLogout.style.display = "inline-block";
    } else if (data.hasAuthWarning) {
      statusBadge.textContent = "🟡 Session Expired (Re-connect)";
      statusBadge.className = "status-badge demo";
      if (demoNotice) {
        demoNotice.innerHTML = `⚠️ <strong>Google Token Expired (<code>${escapeHtml(data.authWarning)}</code>):</strong> Your Google OAuth session has expired. Click <strong>"Connect Gmail"</strong> to re-authenticate.`;
        demoNotice.style.display = "block";
      }
      if (btnGoogle) { btnGoogle.style.display = "inline-block"; btnGoogle.textContent = "Connect Google Calendar"; btnGoogle.style.opacity = "1"; }
      if (btnGmail) { btnGmail.style.display = "inline-block"; btnGmail.textContent = "Connect Gmail"; btnGmail.style.opacity = "1"; }
      if (btnLogout) btnLogout.style.display = "none";
    } else if (data.configured) {
      statusBadge.textContent = "🟢 Google Live Connected";
      statusBadge.className = "status-badge connected";
      if (demoNotice) demoNotice.style.display = "none";

      // Hide individual connect buttons and show Disconnect
      if (btnGoogle) btnGoogle.style.display = "none";
      if (btnGmail) btnGmail.style.display = "none";
      if (btnLogout) btnLogout.style.display = "inline-block";
    } else {
      statusBadge.textContent = "🟡 Demo Mode (Unconnected)";
      statusBadge.className = "status-badge demo";
      if (demoNotice) {
        demoNotice.innerHTML = `ℹ️ <strong>Demo & AI Mode Active:</strong> Displaying sample deadlines with AI triage. Click <strong>"Connect Gmail"</strong> or check your <code>.env</code> file to link live data.`;
        demoNotice.style.display = "block";
      }
      if (btnGoogle) { btnGoogle.style.display = "inline-block"; btnGoogle.textContent = "Connect Google Calendar"; btnGoogle.style.opacity = "1"; }
      if (btnGmail) { btnGmail.style.display = "inline-block"; btnGmail.textContent = "Connect Gmail"; btnGmail.style.opacity = "1"; }
      if (btnLogout) btnLogout.style.display = "none";
    }

    if (data.isGeminiConfigured) {
      aiBadge.textContent = "✨ Gemini AI Active";
      aiBadge.className = "status-badge ai-active";
    } else {
      aiBadge.textContent = "🤖 Local NLP Active";
      aiBadge.className = "status-badge ai-local";
    }

    return data;
  } catch (err) {
    statusBadge.textContent = "🔴 Server Offline";
    statusBadge.className = "status-badge offline";
    aiBadge.textContent = "⚠️ AI Offline";
    return { configured: false, offline: true };
  }
}

async function fetchDeadlines() {
  const activeList = document.getElementById("deadline-list");
  const missedList = document.getElementById("missed-deadline-list");

  try {
    await checkStatus();
    fetchDailyDigest();

    const res = await fetch(`${API_BASE}/google/all`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);

    const payload = await res.json();
    const rawData = Array.isArray(payload) ? payload : (payload.deadlines || []);
    const ignoredData = payload.ignored || [];

    renderIgnoredList(ignoredData);

    const now = Date.now();

    const active = rawData
      .filter(d => !d.due || new Date(d.due).getTime() >= now)
      .sort((a, b) => {
        if (b.priorityScore && a.priorityScore && b.priorityScore !== a.priorityScore) {
          return b.priorityScore - a.priorityScore;
        }
        if (!a.due) return 1;
        if (!b.due) return -1;
        return new Date(a.due).getTime() - new Date(b.due).getTime();
      });

    const missed = rawData
      .filter(d => d.due && new Date(d.due).getTime() < now)
      .sort((a, b) => new Date(b.due).getTime() - new Date(a.due).getTime());

    renderDeadlines(active, missed);
  } catch (err) {
    console.error("❌ Error fetching deadlines:", err);
    activeList.innerHTML = `
      <div class="empty-state error">
        <p>⚠️ Could not connect to backend server at <code>${API_BASE}</code>.</p>
        <p><small>Make sure the backend is running with <code>npm start</code>.</small></p>
      </div>`;
    missedList.innerHTML = `<p class="placeholder-text">Unable to load.</p>`;
  }
}

function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Trigger Google OAuth connection
async function initiateGoogleConnect() {
  try {
    const res = await fetch(`${API_BASE}/auth/url`);
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      window.location.href = `${API_BASE}/auth/login`;
    }
  } catch {
    window.location.href = `${API_BASE}/auth/login`;
  }
}

// Logout handler
async function handleLogout() {
  if (!confirm("Are you sure you want to disconnect your Google account and log out?")) {
    return;
  }

  const btnLogout = document.getElementById("btn-logout");
  if (btnLogout) {
    btnLogout.disabled = true;
    btnLogout.textContent = "⏳ Disconnecting...";
  }

  try {
    const res = await fetch(`${API_BASE}/auth/logout`, { method: "POST" });
    const data = await res.json();
    alert("✅ Logged out successfully. Your Google account has been disconnected.");
    fetchDeadlines();
  } catch (err) {
    alert("Error logging out: " + err.message);
  } finally {
    if (btnLogout) {
      btnLogout.disabled = false;
      btnLogout.textContent = "🚪 Disconnect Google Account";
    }
  }
}

// AI Sandbox
function setupAiSandbox() {
  const modal = document.getElementById("ai-modal");
  const btnOpen = document.getElementById("btn-test-ai");
  const btnClose = document.getElementById("modal-close");
  const btnRun = document.getElementById("btn-run-ai");
  const inputSubject = document.getElementById("ai-input-subject");
  const inputSnippet = document.getElementById("ai-input-snippet");
  const resultBox = document.getElementById("ai-result-box");

  if (!modal || !btnOpen) return;

  btnOpen.addEventListener("click", () => { modal.style.display = "flex"; });
  btnClose.addEventListener("click", () => { modal.style.display = "none"; });
  window.addEventListener("click", (e) => { if (e.target === modal) modal.style.display = "none"; });

  document.querySelectorAll(".preset-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.preset;
      if (type === "urgent") {
        inputSubject.value = "URGENT: Machine Learning Assignment 4 Submission";
        inputSnippet.value = "Final submission due tomorrow by 5:00 PM on Canvas. No late submissions permitted.";
      } else if (type === "promo") {
        inputSubject.value = "⚡ Flash Sale Ends in 2 Hours! 60% OFF everything";
        inputSnippet.value = "Don't miss the biggest sale of the season! Use promo code SAVE60 before midnight.";
      } else if (type === "invoice") {
        inputSubject.value = "Invoice #9823 Payment Due within 48 Hours";
        inputSnippet.value = "Please process the attached invoice payment before Friday to avoid service suspension.";
      }
    });
  });

  btnRun.addEventListener("click", async () => {
    const subject = inputSubject.value.trim();
    if (!subject) {
      alert("Please enter an email subject line.");
      return;
    }

    btnRun.disabled = true;
    btnRun.textContent = "🧠 Gemini Analyzing...";
    resultBox.style.display = "block";
    resultBox.innerHTML = "<p>Running AI extraction & classification...</p>";

    try {
      const res = await fetch(`${API_BASE}/ai/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          snippet: inputSnippet.value.trim(),
        }),
      });

      const data = await res.json();
      const a = data.analysis;

      resultBox.innerHTML = `
        <h4>AI Analysis Result:</h4>
        <div class="result-grid">
          <div><strong>Category:</strong> <span class="badge ${a.isIgnored ? "source-gmail" : "source-google-calendar"}">${a.category}</span></div>
          <div><strong>Actionable:</strong> ${a.isActionable ? "✅ Yes" : "❌ No"}</div>
          <div><strong>Priority:</strong> <span class="time-remaining ${a.priority.toLowerCase()}">${a.priority} (${a.priorityScore}/100)</span></div>
          <div><strong>Extracted Due:</strong> ${formatDate(a.due)}</div>
          <div><strong>AI Action Summary:</strong> ${escapeHtml(a.actionSummary)}</div>
          ${a.ignoreReason ? `<div style="color: #dc2626;"><strong>Filter Reason:</strong> ${escapeHtml(a.ignoreReason)}</div>` : ""}
          <div style="font-size: 0.78rem; color: #64748b;"><strong>Engine:</strong> ${a.aiPowered ? "Google Gemini LLM" : "Local Heuristic NLP Engine"} (Confidence: ${Math.round(a.confidence * 100)}%)</div>
        </div>
      `;
    } catch (err) {
      resultBox.innerHTML = `<p style="color: #dc2626;">Error running analysis: ${err.message}</p>`;
    } finally {
      btnRun.disabled = false;
      btnRun.textContent = "⚡ Analyze with AI";
    }
  });
}

// DOM Init
document.addEventListener("DOMContentLoaded", () => {
  setupAiSandbox();

  const btnGoogle = document.getElementById("btn-connect-google");
  const btnGmail = document.getElementById("btn-connect-gmail");
  const btnRefresh = document.getElementById("btn-refresh");
  const btnLogout = document.getElementById("btn-logout");

  if (btnGoogle) btnGoogle.addEventListener("click", initiateGoogleConnect);
  if (btnGmail) btnGmail.addEventListener("click", initiateGoogleConnect);
  if (btnLogout) btnLogout.addEventListener("click", handleLogout);

  if (btnRefresh) {
    btnRefresh.addEventListener("click", () => {
      btnRefresh.disabled = true;
      btnRefresh.textContent = "⏳ Refreshing...";
      fetchDeadlines().finally(() => {
        setTimeout(() => {
          btnRefresh.disabled = false;
          btnRefresh.textContent = "🔄 Refresh";
        }, 500);
      });
    });
  }

  fetchDeadlines();
});
