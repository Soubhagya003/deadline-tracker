import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

// Check if Gemini API Key is configured
export function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 10);
}

function getGeminiClient() {
  if (!isGeminiConfigured()) return null;
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY.trim() });
}

/**
 * FEATURE 1, 2, 3, 4:
 * Analyze an email using Gemini LLM (with robust local heuristic fallback)
 * - Feature 1: Intelligent Classification & Noise Filtering (Actionable vs Marketing/Ignored)
 * - Feature 2: Natural Language Deadline & Entity Extraction (Relative dates -> ISO)
 * - Feature 3: Smart Priority Scoring & Urgency Matrix (1-100 score + URGENT/HIGH/MEDIUM/LOW)
 * - Feature 4: Action Item Summarization & Deep Linking (1-line action summary + Gmail link)
 */
export async function analyzeEmailWithGemini(email, referenceDate = new Date()) {
  const client = getGeminiClient();

  if (client) {
    try {
      return await callGeminiAnalysis(client, email, referenceDate);
    } catch (err) {
      console.warn("⚠️ Gemini API error, falling back to local NLP engine:", err.message);
    }
  }

  // Fallback to intelligent local NLP parser
  return localHeuristicAnalysis(email, referenceDate);
}

/**
 * Call Gemini LLM for structured email deadline extraction
 */
async function callGeminiAnalysis(client, email, referenceDate) {
  const modelName = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const refIso = referenceDate instanceof Date ? referenceDate.toISOString() : new Date().toISOString();

  const prompt = `You are an AI Deadline Tracker assistant. Analyze the following email and extract structured task/deadline intelligence.

REFERENCE TIME (NOW): ${refIso}

EMAIL DETAILS:
- Subject: ${email.subject || "No Subject"}
- From: ${email.sender || "Unknown Sender"}
- Received Date: ${email.date || refIso}
- Content / Snippet: ${email.snippet || email.body || "No body content"}

TASK:
1. CLASSIFY: Is this an ACTIONABLE deadline (assignment, bill payment, review, submission, appointment)?
   OR is it INFORMATIONAL, or MARKETING/PROMOTIONAL (discounts, sales countdowns, newsletters, marketing blasts)?
2. IF MARKETING OR IRRELEVANT: Mark isIgnored = true and give ignoreReason.
3. EXTRACT DEADLINE: If actionable, resolve relative date mentions ("tomorrow 5pm", "by Friday EOD", "in 3 days") into an absolute ISO-8601 timestamp using the REFERENCE TIME.
4. ACTION SUMMARY: Provide a clear, actionable 1-sentence summary of what the user needs to do.
5. PRIORITY SCORE: Assign an urgency score (1 to 100) and priority level (URGENT, HIGH, MEDIUM, LOW).

OUTPUT FORMAT: Return STRICT JSON ONLY (no markdown fences, no extra text):
{
  "isActionable": boolean,
  "isIgnored": boolean,
  "category": "ACTIONABLE" | "INFORMATIONAL" | "MARKETING_IGNORED",
  "ignoreReason": string | null,
  "title": string,
  "due": string | null (ISO-8601 string or null),
  "priority": "URGENT" | "HIGH" | "MEDIUM" | "LOW",
  "priorityScore": number (1-100),
  "actionSummary": string,
  "confidence": number (0.0 to 1.0)
}`;

  const response = await client.models.generateContent({
    model: modelName,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      temperature: 0.1,
    },
  });

  const text = response.text ? response.text.trim() : "";
  const parsed = JSON.parse(text);

  return {
    id: email.id,
    threadId: email.threadId,
    source: "Gmail",
    link: email.threadId
      ? `https://mail.google.com/mail/u/0/#inbox/${email.threadId}`
      : `https://mail.google.com/mail/u/0/#inbox`,
    sender: email.sender,
    originalSubject: email.subject,
    title: parsed.title || email.subject,
    due: parsed.due || null,
    isActionable: Boolean(parsed.isActionable),
    isIgnored: Boolean(parsed.isIgnored),
    category: parsed.category || "INFORMATIONAL",
    ignoreReason: parsed.ignoreReason || null,
    priority: parsed.priority || "MEDIUM",
    priorityScore: parsed.priorityScore || 50,
    actionSummary: parsed.actionSummary || email.subject,
    confidence: parsed.confidence || 0.9,
    aiPowered: true,
  };
}

/**
 * Intelligent Local Heuristic Analyzer (Used when Gemini API Key is pending or network fails)
 * Guarantees zero crashes and complete functionality
 */
export function localHeuristicAnalysis(email, referenceDate = new Date()) {
  const text = `${email.subject || ""} ${email.snippet || ""} ${email.body || ""}`.toLowerCase();
  const sender = (email.sender || "").toLowerCase();
  const now = referenceDate instanceof Date ? referenceDate : new Date();

  // Marketing & noise detection keywords
  const marketingKeywords = [
    "sale ends", "discount", "% off", "promo", "limited time offer", "shop now",
    "exclusive deal", "black friday", "cyber monday", "clearance", "coupon",
    "unmissable deal", "save up to", "newsletter", "unsubscribe", "deals of the day"
  ];

  const isMarketing = marketingKeywords.some(kw => text.includes(kw)) ||
    sender.includes("marketing") || sender.includes("promo") || sender.includes("newsletter") || sender.includes("deals");

  if (isMarketing) {
    return {
      id: email.id,
      threadId: email.threadId,
      source: "Gmail",
      link: email.threadId ? `https://mail.google.com/mail/u/0/#inbox/${email.threadId}` : "https://mail.google.com/mail/u/0/#inbox",
      sender: email.sender,
      originalSubject: email.subject,
      title: email.subject || "Promotional Mail",
      due: null,
      isActionable: false,
      isIgnored: true,
      category: "MARKETING_IGNORED",
      ignoreReason: "Detected promotional offer / marketing blast",
      priority: "LOW",
      priorityScore: 10,
      actionSummary: "Filtered promotional email with marketing countdown.",
      confidence: 0.95,
      aiPowered: false,
    };
  }

  // Deadline & action keywords
  const actionKeywords = [
    "due", "deadline", "submit", "submission", "assignment", "invoice", "payment",
    "cutoff", "cut-off", "review", "complete by", "by end of day", "eod", "action required"
  ];
  const isActionable = actionKeywords.some(kw => text.includes(kw));

  // Natural language relative date parsing
  let extractedDue = null;
  const dayMs = 24 * 60 * 60 * 1000;

  if (text.includes("today") || text.includes("tonight") || text.includes("eod today")) {
    const d = new Date(now);
    d.setHours(23, 59, 0, 0);
    extractedDue = d.toISOString();
  } else if (text.includes("tomorrow")) {
    const d = new Date(now.getTime() + dayMs);
    d.setHours(17, 0, 0, 0);
    extractedDue = d.toISOString();
  } else if (text.includes("in 2 days") || text.includes("within 48 hours")) {
    extractedDue = new Date(now.getTime() + 2 * dayMs).toISOString();
  } else if (text.includes("in 3 days") || text.includes("in a few days")) {
    extractedDue = new Date(now.getTime() + 3 * dayMs).toISOString();
  } else if (text.includes("next week") || text.includes("by next monday")) {
    extractedDue = new Date(now.getTime() + 6 * dayMs).toISOString();
  } else if (email.date) {
    const parsed = new Date(email.date);
    if (!isNaN(parsed.getTime())) {
      // Default fallback: 3 days after email sent date if mentioned deadline
      extractedDue = new Date(parsed.getTime() + 3 * dayMs).toISOString();
    }
  }

  // Priority scoring
  let priority = "MEDIUM";
  let priorityScore = 50;

  if (extractedDue) {
    const diffHours = (new Date(extractedDue).getTime() - now.getTime()) / (1000 * 60 * 60);
    if (diffHours < 24) {
      priority = "URGENT";
      priorityScore = 95;
    } else if (diffHours < 72) {
      priority = "HIGH";
      priorityScore = 80;
    } else {
      priority = "MEDIUM";
      priorityScore = 55;
    }
  }

  // Action summary
  let actionSummary = email.subject || "Actionable Task";
  if (text.includes("assignment") || text.includes("submit")) {
    actionSummary = `Submit required deliverable for "${email.subject}"`;
  } else if (text.includes("invoice") || text.includes("payment")) {
    actionSummary = `Review and process invoice payment for "${email.subject}"`;
  } else if (text.includes("review")) {
    actionSummary = `Review and provide feedback on "${email.subject}"`;
  }

  return {
    id: email.id,
    threadId: email.threadId,
    source: "Gmail",
    link: email.threadId ? `https://mail.google.com/mail/u/0/#inbox/${email.threadId}` : "https://mail.google.com/mail/u/0/#inbox",
    sender: email.sender,
    originalSubject: email.subject,
    title: email.subject || "Actionable Task",
    due: extractedDue,
    isActionable: isActionable,
    isIgnored: false,
    category: isActionable ? "ACTIONABLE" : "INFORMATIONAL",
    ignoreReason: null,
    priority,
    priorityScore,
    actionSummary,
    confidence: 0.85,
    aiPowered: false,
  };
}

/**
 * FEATURE 5: Direct Calendar Sync Event Formatter
 * Generates an event object ready for Google Calendar insertion
 */
export function formatCalendarEventFromDeadline(deadline) {
  const startTime = deadline.due || new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const endTime = new Date(new Date(startTime).getTime() + 60 * 60 * 1000).toISOString();

  return {
    summary: `[Deadline] ${deadline.title}`,
    description: `${deadline.actionSummary || deadline.title}\n\nPriority: ${deadline.priority || "MEDIUM"}\nSource Link: ${deadline.link || "N/A"}\nCreated by AI Deadline Tracker`,
    startTime,
    endTime,
    reminderMinutes: deadline.priority === "URGENT" ? 30 : 60,
  };
}

/**
 * FEATURE 6: Daily AI Digest / Executive Briefing Generator
 * Summarizes inbox status, urgent deliverables, and ignored promotions
 */
export async function generateDailyDigest(activeDeadlines, missedDeadlines, ignoredItems) {
  const urgentItems = activeDeadlines.filter(d => d.priority === "URGENT" || (d.due && (new Date(d.due) - Date.now()) < 24 * 60 * 60 * 1000));
  const soonItems = activeDeadlines.filter(d => d.priority === "HIGH" || (d.due && (new Date(d.due) - Date.now()) < 72 * 60 * 60 * 1000 && !urgentItems.includes(d)));

  const greeting = getDayGreeting();
  let summaryText = "";

  if (urgentItems.length > 0) {
    summaryText = `You have ${urgentItems.length} urgent deadline${urgentItems.length > 1 ? "s" : ""} requiring attention today.`;
  } else if (activeDeadlines.length > 0) {
    summaryText = `All caught up for today! You have ${activeDeadlines.length} upcoming task${activeDeadlines.length > 1 ? "s" : ""} later this week.`;
  } else {
    summaryText = "Your schedule is clear! No active deadlines pending.";
  }

  let recommendation = "Review upcoming deliverables to stay ahead of schedule.";
  if (urgentItems.length > 0) {
    recommendation = `Top priority: Focus on "${urgentItems[0].title}" first.`;
  } else if (missedDeadlines.length > 0) {
    recommendation = `You have ${missedDeadlines.length} overdue task${missedDeadlines.length > 1 ? "s" : ""}. Consider rescheduling or closing them.`;
  }

  const client = getGeminiClient();
  let aiNarrative = null;

  if (client && activeDeadlines.length > 0) {
    try {
      const prompt = `Write a crisp, motivating 2-sentence morning briefing for a professional based on these deadlines:
- Urgent today (${urgentItems.length}): ${urgentItems.map(i => i.title).join(", ") || "None"}
- Approaching (${soonItems.length}): ${soonItems.map(i => i.title).join(", ") || "None"}
- Overdue (${missedDeadlines.length}): ${missedDeadlines.map(i => i.title).join(", ") || "None"}
- Marketing emails ignored: ${ignoredItems.length}

Keep it punchy, professional, and helpful.`;

      const response = await client.models.generateContent({
        model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
        contents: prompt,
      });
      aiNarrative = response.text ? response.text.trim() : null;
    } catch {
      // Fallback to template narrative
    }
  }

  return {
    greeting,
    summary: summaryText,
    narrative: aiNarrative || `${summaryText} ${recommendation} Automatically filtered ${ignoredItems.length} marketing emails.`,
    recommendation,
    stats: {
      urgentCount: urgentItems.length,
      upcomingCount: activeDeadlines.length,
      missedCount: missedDeadlines.length,
      ignoredCount: ignoredItems.length,
    },
    topUrgent: urgentItems.slice(0, 3).map(u => ({
      title: u.title,
      due: u.due,
      actionSummary: u.actionSummary,
      priority: u.priority,
    })),
  };
}

function getDayGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning ☀️";
  if (hour < 18) return "Good afternoon 🌤️";
  return "Good evening 🌙";
}
