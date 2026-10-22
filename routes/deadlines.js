import express from "express";
import fs from "fs";
import path from "path";
import {
  isGoogleConfigured,
  getGoogleCalendarDeadlines,
  getGmailDeadlines,
  getSampleDeadlines,
  getSampleIgnoredEmails,
  createGoogleCalendarEvent,
  getAuthUrl,
  getTokensFromCode,
} from "../services/googleService.js";
import {
  isGeminiConfigured,
  analyzeEmailWithGemini,
  generateDailyDigest,
} from "../services/geminiService.js";

const router = express.Router();

// Track runtime auth and API state
let lastAuthWarning = null;
let lastApiDisabledWarning = null;

// System Status Endpoint
router.get("/status", (req, res) => {
  res.json({
    configured: isGoogleConfigured() && !lastAuthWarning && !lastApiDisabledWarning,
    hasClientId: Boolean(process.env.GOOGLE_CLIENT_ID),
    hasClientSecret: Boolean(process.env.GOOGLE_CLIENT_SECRET),
    hasRefreshToken: Boolean(process.env.GOOGLE_REFRESH_TOKEN && process.env.GOOGLE_REFRESH_TOKEN.trim().length > 5),
    hasAuthWarning: Boolean(lastAuthWarning),
    authWarning: lastAuthWarning,
    hasApiDisabledWarning: Boolean(lastApiDisabledWarning),
    apiDisabledWarning: lastApiDisabledWarning,
    isGeminiConfigured: isGeminiConfigured(),
    model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
  });
});

// Direct OAuth Login Redirect
router.get("/auth/login", (req, res) => {
  try {
    const url = getAuthUrl();
    res.redirect(url);
  } catch (err) {
    res.status(400).send(`Cannot initiate Google OAuth: ${err.message}. Please check GOOGLE_CLIENT_ID in .env.`);
  }
});

// OAuth Initiate (Returns JSON URL or redirects if requested)
router.get("/auth/url", (req, res) => {
  try {
    const url = getAuthUrl();
    if (req.query.redirect === "true") {
      return res.redirect(url);
    }
    res.json({ url });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// OAuth Callback
router.get("/auth/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).send("No authorization code provided by Google.");
  }

  try {
    const tokens = await getTokensFromCode(code);
    if (tokens.refresh_token) {
      process.env.GOOGLE_REFRESH_TOKEN = tokens.refresh_token;
      lastAuthWarning = null;
      lastApiDisabledWarning = null;

      const envPath = path.resolve(process.cwd(), ".env");
      let envContent = "";
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, "utf-8");
        if (envContent.includes("GOOGLE_REFRESH_TOKEN=")) {
          envContent = envContent.replace(
            /GOOGLE_REFRESH_TOKEN=.*/g,
            `GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`
          );
        } else {
          envContent += `\nGOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`;
        }
      } else {
        envContent = `GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`;
      }
      fs.writeFileSync(envPath, envContent, "utf-8");
    }

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Google Connected</title>
          <meta http-equiv="refresh" content="2;url=/" />
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; text-align: center; padding: 60px 20px; background: #f0fdf4; color: #166534; }
            .card { background: white; max-width: 480px; margin: 0 auto; padding: 30px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid #bbf7d0; }
            h2 { margin-top: 0; color: #15803d; }
            a { display: inline-block; margin-top: 20px; padding: 10px 22px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>✅ Google Account Connected!</h2>
            <p>Your fresh authorization tokens have been saved to <code>.env</code>.</p>
            <p><small>Redirecting you back to your Deadline Tracker dashboard in 2 seconds...</small></p>
            <a href="/">Return to Dashboard Now</a>
          </div>
        </body>
      </html>
    `);
  } catch (err) {
    console.error("OAuth callback error:", err);
    res.status(500).send(`Authentication failed: ${err.message}`);
  }
});

// LOGOUT / DISCONNECT ENDPOINT
router.post("/auth/logout", async (req, res) => {
  try {
    const currentToken = process.env.GOOGLE_REFRESH_TOKEN;
    if (currentToken) {
      try {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(currentToken)}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });
      } catch (revokeErr) {
        console.warn("Notice: Google revoke endpoint skipped:", revokeErr.message);
      }
    }

    process.env.GOOGLE_REFRESH_TOKEN = "";
    lastAuthWarning = null;
    lastApiDisabledWarning = null;

    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, "utf-8");
      envContent = envContent.replace(/GOOGLE_REFRESH_TOKEN=.*/g, "GOOGLE_REFRESH_TOKEN=");
      fs.writeFileSync(envPath, envContent, "utf-8");
    }

    res.json({ success: true, message: "Logged out successfully from Google account." });
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Combined Deadlines with AI Triage & Noise Filtering (Features 1, 2, 3, 4)
router.get("/google/all", async (req, res) => {
  try {
    if (!isGoogleConfigured()) {
      return res.json({
        configured: false,
        aiPowered: isGeminiConfigured(),
        message: "Displaying demo deadlines with AI triage active.",
        deadlines: getSampleDeadlines(),
        ignored: getSampleIgnoredEmails(),
      });
    }

    let authError = null;
    let apiDisabledError = null;

    const [calendarDeadlines, gmailResult] = await Promise.all([
      getGoogleCalendarDeadlines().catch(e => {
        if (e.message.includes("has not been used in project") || e.message.includes("is disabled")) {
          apiDisabledError = e.message;
        } else {
          authError = e.message;
        }
        console.warn("Calendar fetch note:", e.message);
        return [];
      }),
      getGmailDeadlines().catch(e => {
        if (e.message.includes("has not been used in project") || e.message.includes("is disabled")) {
          apiDisabledError = e.message;
        } else {
          authError = e.message;
        }
        console.warn("Gmail fetch note:", e.message);
        return { actionable: [], ignored: [] };
      }),
    ]);

    if (apiDisabledError) {
      lastApiDisabledWarning = apiDisabledError;
    } else {
      lastApiDisabledWarning = null;
    }

    if (authError && (authError.includes("invalid_grant") || authError.includes("deleted_client"))) {
      lastAuthWarning = authError;
    } else if (calendarDeadlines.length > 0 || gmailResult.actionable.length > 0) {
      lastAuthWarning = null;
    }

    const liveDeadlines = [...calendarDeadlines, ...gmailResult.actionable];

    // If live fetch returned nothing due to api disabled or auth error, provide demo deadlines gracefully
    if (liveDeadlines.length === 0 && (apiDisabledError || authError)) {
      return res.json({
        configured: false,
        hasAuthWarning: Boolean(authError),
        authWarning: authError,
        hasApiDisabledWarning: Boolean(apiDisabledError),
        apiDisabledWarning: apiDisabledError,
        aiPowered: isGeminiConfigured(),
        message: apiDisabledError || authError,
        deadlines: getSampleDeadlines(),
        ignored: getSampleIgnoredEmails(),
      });
    }

    res.json({
      configured: true,
      hasAuthWarning: false,
      hasApiDisabledWarning: false,
      aiPowered: isGeminiConfigured(),
      deadlines: liveDeadlines.length > 0 ? liveDeadlines : getSampleDeadlines(),
      ignored: gmailResult.ignored.length > 0 ? gmailResult.ignored : getSampleIgnoredEmails(),
    });
  } catch (err) {
    console.error("All deadlines error:", err);
    res.status(500).json({ error: err.message });
  }
});

// FEATURE 5: Direct Google Calendar Sync Endpoint
router.post("/calendar/add", async (req, res) => {
  try {
    const { title, due, actionSummary, link } = req.body;
    if (!title || !due) {
      return res.status(400).json({ error: "title and due date are required" });
    }

    const result = await createGoogleCalendarEvent({
      title,
      due,
      actionSummary,
      link,
    });

    res.json(result);
  } catch (err) {
    console.error("Calendar add error:", err);
    res.status(500).json({ error: err.message });
  }
});

// FEATURE 6: Daily AI Digest & Executive Briefing Endpoint
router.get("/ai/digest", async (req, res) => {
  try {
    let deadlines = [];
    let ignored = [];

    if (!isGoogleConfigured() || lastAuthWarning || lastApiDisabledWarning) {
      deadlines = getSampleDeadlines();
      ignored = getSampleIgnoredEmails();
    } else {
      const [calendarDeadlines, gmailResult] = await Promise.all([
        getGoogleCalendarDeadlines().catch(() => []),
        getGmailDeadlines().catch(() => ({ actionable: [], ignored: [] })),
      ]);
      deadlines = [...calendarDeadlines, ...(gmailResult.actionable || [])];
      ignored = gmailResult.ignored || [];

      if (deadlines.length === 0) {
        deadlines = getSampleDeadlines();
        ignored = getSampleIgnoredEmails();
      }
    }

    const now = Date.now();
    const active = deadlines.filter(d => !d.due || new Date(d.due).getTime() >= now);
    const missed = deadlines.filter(d => d.due && new Date(d.due).getTime() < now);

    const digest = await generateDailyDigest(active, missed, ignored);
    res.json({ success: true, digest, aiPowered: isGeminiConfigured() });
  } catch (err) {
    console.error("Digest error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Direct On-Demand AI Email Analyzer (for testing custom text/snippets)
router.post("/ai/analyze", async (req, res) => {
  try {
    const { subject, snippet, body, sender, date } = req.body;
    const analysis = await analyzeEmailWithGemini({
      id: "manual-" + Date.now(),
      subject: subject || "Test Deadline",
      snippet: snippet || body || "",
      sender: sender || "colleague@company.com",
      date: date || new Date().toISOString(),
    });

    res.json({ success: true, analysis });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
