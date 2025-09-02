import { google } from "googleapis";
import dotenv from "dotenv";
dotenv.config();

function getAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

function getAuthorizedClient() {
  const auth = getAuthClient();
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return auth;
}

// Google Calendar
export async function getGoogleCalendarDeadlines() {
  const auth = getAuthorizedClient();
  const calendar = google.calendar({ version: "v3", auth });

  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: new Date().toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: "startTime",
  });

  return res.data.items.map(event => ({
    title: event.summary,
    due: event.start.dateTime || event.start.date,
  }));
}

// Gmail //due or deadline
export async function getGmailDeadlines() {
  const auth = getAuthorizedClient();
  const gmail = google.gmail({ version: "v1", auth });

  const res = await gmail.users.messages.list({
    userId: "me",
    q: "subject:(due OR deadline)", // last 7 days
    maxResults: 5,
  });

  if (!res.data.messages) return [];

  const mails = await Promise.all(
    res.data.messages.map(async msg => {
      const detail = await gmail.users.messages.get({
        userId: "me",
        id: msg.id,
      });
      const headers = detail.data.payload.headers;
      const subject =
        headers.find(h => h.name === "Subject")?.value || "No subject";
      const date = headers.find(h => h.name === "Date")?.value || "";
      return { title: subject, due: new Date(date).toISOString() };
    })
  );

  return mails;
}
