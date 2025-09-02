import express from "express";
import {
  getGoogleCalendarDeadlines,
  getGmailDeadlines,
} from "../services/googleService.js";

const router = express.Router();

// Google Calendar
router.get("/google/calendar", async (req, res) => {
  try {
    const deadlines = await getGoogleCalendarDeadlines();
    res.json(deadlines);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Gmail
router.get("/google/mail", async (req, res) => {
  try {
    const deadlines = await getGmailDeadlines();
    res.json(deadlines);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Combined
router.get("/google/all", async (req, res) => {
  try {
    const calendar = await getGoogleCalendarDeadlines();
    const mail = await getGmailDeadlines();
    res.json([...calendar, ...mail]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
