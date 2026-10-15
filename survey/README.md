# Hidden Money Survey

Live at: **https://r1ee.github.io/survey/**

One-question-at-a-time customer survey for the hidden government money course.
Colorful animated UI, rank-your-top-3 product question, optional email capture,
confetti finish.

## Files
- `index.html` — page shell (survey view + owner dashboard)
- `styles.css` — colorful design system
- `app.js` — survey logic, animations, results dashboard, CSV export, webhook
- `collector-google-apps-script.gs` — Google Apps Script that receives responses into a Google Sheet

## How responses are collected
1. Every response is saved in the respondent's browser (`localStorage`) — this is
   only visible on *their* machine, so it is NOT the collection mechanism.
2. Every response is also POSTed (fire-and-forget) to the webhook URL baked into
   `app.js` → `CONFIG.webhookUrl` (sent as `text/plain` to avoid CORS preflight).
3. The recommended free collector is the bundled Google Apps Script: it appends
   each response as a row in a Google Sheet. From the Sheet you can analyze
   directly or sync to any CRM via Zapier/Make/native integrations.
   Setup instructions are at the top of the `.gs` file (~5 min, needs your Google login).
4. Owner dashboard: add `#admin` to the survey URL. It shows charts for whatever
   responses exist **in that browser** — for the full dataset, analyze the Google Sheet
   (or CSV exported from it).

## Local development
```
npm run dev          # http://127.0.0.1:3000/
npm run dev -- --port 7100
```
Zero dependencies — `server.js` is a plain Node static server.

## Updating the survey
Push changes to this folder; GitHub Pages republishes within ~1 minute.
