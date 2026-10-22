import { google } from "googleapis";
import dotenv from "dotenv";
import {
  analyzeEmailWithGemini,
  formatCalendarEventFromDeadline,
  isGeminiConfigured,
} from "./geminiService.js";

dotenv.config();

// Scopes required for Calendar and Gmail read/write access
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/gmail.readonly",
];

// Check if credentials are properly configured
export function isGoogleConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN &&
    !process.env.GOOGLE_CLIENT_ID.includes("your_google_client_id")
  );
}

export function getAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || "http://127.0.0.1:8000/api/deadlines/auth/callback";

  if (!clientId || !clientSecret) {
    return null;
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getAuthorizedClient() {
  const auth = getAuthClient();
  if (!auth) return null;

  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!refreshToken) return null;

  auth.setCredentials({ refresh_token: refreshToken });
  return auth;
}

// Generate Google OAuth URL for user authentication
export function getAuthUrl() {
  const auth = getAuthClient();
  if (!auth) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required to generate auth URL.");
  }

  return auth.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });
}

// Exchange authorization code for tokens
export async function getTokensFromCode(code) {
  const auth = getAuthClient();
  if (!auth) throw new Error("OAuth client not configured.");
  const { tokens } = await auth.getToken(code);
  return tokens;
}

// Fallback sample deadlines demonstrating all AI features
export function getSampleDeadlines() {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  return [
    {
      id: "demo-ai-1",
      title: "Machine Learning Final Project & Model Checkpoint Submission",
      due: new Date(now + 0.4 * day).toISOString(), // ~10 hours from now (urgent)
      source: "Gmail",
      priority: "URGENT",
      priorityScore: 95,
      isActionable: true,
      isIgnored: false,
      category: "ACTIONABLE",
      actionSummary: "Submit final trained weights and PDF report to the submission portal before 11:59 PM.",
      link: "https://mail.google.com",
      isDemo: true,
      aiPowered: isGeminiConfigured(),
    },
    {
      id: "demo-ai-2",
      title: "Quarterly Cloud Infrastructure Review Meeting",
      due: new Date(now + 1.8 * day).toISOString(), // ~1.8 days from now (soon)
      source: "Google Calendar",
      priority: "HIGH",
      priorityScore: 78,
      isActionable: true,
      isIgnored: false,
      category: "ACTIONABLE",
      actionSummary: "Prepare slide deck outlining AWS spending and cost reduction recommendations.",
      link: "https://calendar.google.com",
      isDemo: true,
      aiPowered: isGeminiConfigured(),
    },
    {
      id: "demo-ai-3",
      title: "Q3 Vendor Invoice #4892 Approval",
      due: new Date(now + 4.5 * day).toISOString(), // ~4.5 days from now (safe)
      source: "Gmail",
      priority: "MEDIUM",
      priorityScore: 55,
      isActionable: true,
      isIgnored: false,
      category: "ACTIONABLE",
      actionSummary: "Review accounts payable invoice and authorize payment release.",
      link: "https://mail.google.com",
      isDemo: true,
      aiPowered: isGeminiConfigured(),
    },
    {
      id: "demo-ai-4",
      title: "Sprint Retrospective & Team Sync",
      due: new Date(now - 1.2 * day).toISOString(), // 1.2 days ago (missed)
      source: "Google Calendar",
      priority: "MEDIUM",
      priorityScore: 60,
      isActionable: true,
      isIgnored: false,
      category: "ACTIONABLE",
      actionSummary: "Overdue team retrospective notes and action item sign-off.",
      link: "https://calendar.google.com",
      isDemo: true,
      aiPowered: isGeminiConfigured(),
    },
  ];
}

// Fallback sample marketing emails that AI successfully ignored
export function getSampleIgnoredEmails() {
  return [
    {
      id: "demo-ign-1",
      title: "⚡ Flash Sale Ends in 3 Hours! 70% Off All Tech Accessories",
      source: "Gmail",
      sender: "marketing@electronics-deal.com",
      category: "MARKETING_IGNORED",
      isIgnored: true,
      isActionable: false,
      ignoreReason: "Detected promotional offer / marketing blast with fake countdown",
      actionSummary: "Promotional marketing email automatically filtered out.",
    },
    {
      id: "demo-ign-2",
      title: "Your Weekly Digest: Top 10 Software Architecture Trends for 2026",
      source: "Gmail",
      sender: "newsletter@techdigest.io",
      category: "MARKETING_IGNORED",
      isIgnored: true,
      isActionable: false,
      ignoreReason: "Informational newsletter without pending action items",
      actionSummary: "Weekly reading newsletter filtered out from deadlines.",
    },
  ];
}

// Google Calendar Deadlines
export async function getGoogleCalendarDeadlines() {
  const auth = getAuthorizedClient();
  if (!auth) {
    return [];
  }

  const calendar = google.calendar({ version: "v3", auth });

  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    maxResults: 20,
    singleEvents: true,
    orderBy: "startTime",
  });

  if (!res.data.items) return [];

  const now = Date.now();
  return res.data.items.map(event => {
    let dueIso = null;
    const rawDate = event.start?.dateTime || event.start?.date;
    if (rawDate) {
      const parsed = new Date(rawDate);
      if (!isNaN(parsed.getTime())) {
        dueIso = parsed.toISOString();
      }
    }

    let priority = "MEDIUM";
    let priorityScore = 50;
    if (dueIso) {
      const diffHours = (new Date(dueIso).getTime() - now) / (1000 * 60 * 60);
      if (diffHours < 24 && diffHours > 0) {
        priority = "URGENT";
        priorityScore = 90;
      } else if (diffHours < 72 && diffHours > 0) {
        priority = "HIGH";
        priorityScore = 75;
      }
    }

    return {
      id: event.id,
      title: event.summary || "Untitled Event",
      due: dueIso,
      source: "Google Calendar",
      priority,
      priorityScore,
      isActionable: true,
      isIgnored: false,
      category: "ACTIONABLE",
      actionSummary: event.description || `Calendar Event: ${event.summary || "Scheduled Task"}`,
      link: event.htmlLink || null,
      aiPowered: false,
    };
  });
}

// FEATURE 5: Direct Google Calendar Event Creation (Safe & Handled)
export async function createGoogleCalendarEvent(deadlineData) {
  const auth = getAuthorizedClient();
  if (!auth) {
    return {
      success: true,
      simulated: true,
      message: "Event simulated successfully (Configure Google account in .env for live sync).",
      event: {
        summary: deadlineData.title,
        startTime: deadlineData.due,
      },
    };
  }

  try {
    const calendar = google.calendar({ version: "v3", auth });
    const eventPayload = formatCalendarEventFromDeadline(deadlineData);

    const res = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: eventPayload.summary,
        description: eventPayload.description,
        start: {
          dateTime: eventPayload.startTime,
        },
        end: {
          dateTime: eventPayload.endTime,
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "popup", minutes: eventPayload.reminderMinutes },
            { method: "email", minutes: 120 },
          ],
        },
      },
    });

    return {
      success: true,
      simulated: false,
      event: res.data,
      htmlLink: res.data.htmlLink,
    };
  } catch (err) {
    console.warn("⚠️ Google Calendar live sync failed, falling back to simulated sync:", err.message);
    return {
      success: true,
      simulated: true,
      warning: `Google Calendar API returned: ${err.message}. Event simulated locally.`,
      event: {
        summary: deadlineData.title,
        startTime: deadlineData.due,
      },
    };
  }
}

// Gmail Deadlines with Gemini AI Triage
export async function getGmailDeadlines() {
  const auth = getAuthorizedClient();
  if (!auth) {
    return { actionable: [], ignored: [] };
  }

  const gmail = google.gmail({ version: "v1", auth });

  const res = await gmail.users.messages.list({
    userId: "me",
    q: "subject:(due OR deadline OR submission OR invoice OR assignment OR urgent OR review OR cutoff OR 'ends soon')",
    maxResults: 15,
  });

  if (!res.data.messages || res.data.messages.length === 0) {
    return { actionable: [], ignored: [] };
  }

  const processedEmails = await Promise.all(
    res.data.messages.map(async msg => {
      try {
        const detail = await gmail.users.messages.get({
          userId: "me",
          id: msg.id,
        });

        const headers = detail.data.payload?.headers || [];
        const subject = headers.find(h => h.name === "Subject")?.value || "No subject";
        const sender = headers.find(h => h.name === "From")?.value || "Unknown";
        const dateHeader = headers.find(h => h.name === "Date")?.value || "";
        const snippet = detail.data.snippet || "";

        const analysis = await analyzeEmailWithGemini({
          id: msg.id,
          threadId: detail.data.threadId,
          subject,
          sender,
          date: dateHeader,
          snippet,
        });

        return analysis;
      } catch (err) {
        console.error(`Failed to process message ${msg.id}:`, err.message);
        return null;
      }
    })
  );

  const valid = processedEmails.filter(Boolean);
  const actionable = valid.filter(e => !e.isIgnored && e.isActionable);
  const ignored = valid.filter(e => e.isIgnored);

  return { actionable, ignored };
}
