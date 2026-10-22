// AI Deadline Tracker - Background Service Worker

chrome.runtime.onInstalled.addListener(() => {
  console.log("📅 AI Deadline Tracker Extension Installed Successfully.");
  // Setup periodic alarm to refresh every 30 minutes
  chrome.alarms.create("refreshDeadlines", { periodInMinutes: 30 });
});

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === "refreshDeadlines") {
    checkUrgentDeadlines();
  }
});

async function checkUrgentDeadlines() {
  try {
    const res = await fetch("http://127.0.0.1:8000/api/deadlines/google/all");
    if (!res.ok) return;
    const data = await res.json();
    const list = Array.isArray(data) ? data : (data.deadlines || []);

    const now = Date.now();
    const urgentCount = list.filter(d => {
      if (!d.due) return false;
      const diffHours = (new Date(d.due).getTime() - now) / (1000 * 60 * 60);
      return diffHours > 0 && diffHours <= 24; // due within 24h
    }).length;

    if (urgentCount > 0) {
      chrome.action.setBadgeText({ text: String(urgentCount) });
      chrome.action.setBadgeBackgroundColor({ color: "#ea580c" }); // Orange badge
    } else {
      chrome.action.setBadgeText({ text: "" });
    }
  } catch {
    // Backend offline or unreachable
  }
}
