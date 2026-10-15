/**
 * Hidden Money Survey — Response Collector (Google Apps Script)
 * ==============================================================
 * Receives every survey response and appends a row to a Google Sheet.
 * From that Sheet you can analyze directly, or connect ANY CRM
 * (Zapier/Make/HubSpot/ActiveCampaign/etc.) — the Sheet is the hub.
 *
 * TRANSPORT NOTE: the survey sends data as a GET with an encoded payload
 * (?d=<urlencoded JSON>). This is deliberate — Apps Script 302-redirects
 * POST requests, and browsers rewrite redirected POSTs to GET, dropping
 * the body. doPost is kept for compatibility with other tools.
 *
 * SETUP (one time, ~5 minutes, needs your Google login):
 * 1. Create a new Google Sheet: https://sheets.new  (name it "Survey Responses")
 * 2. In the sheet: Extensions → Apps Script
 * 3. Delete the default code, paste ALL of this file, save (💾)
 * 4. Deploy → New deployment → type: Web app
 *      - Execute as:   Me
 *      - Who has access: Anyone
 * 5. Copy the Web app URL (ends in /exec) and give it to Kimi to bake
 *    into the live survey (CONFIG.webhookUrl in app.js).
 * 6. UPDATING LATER: after pasting new code, use Deploy → Manage
 *    deployments → ✏️ → Version: New version → Deploy. URL never changes.
 *
 * TEST: open the Web app URL in a browser — you should see
 * {"ok":true,"service":"hidden-money-survey-collector"}
 * Then submit one test answer at the survey URL and check the Sheet.
 */

var SHEET_NAME = "Responses";
var HEADERS = ["timestamp", "stage", "obstacle", "next_offer", "format", "paid_before", "outcome", "magic", "email"];

function doGet(e) {
  // Survey payload: ?d=<urlencoded JSON>
  if (e && e.parameter && e.parameter.d) {
    var data;
    try {
      data = JSON.parse(e.parameter.d);
    } catch (err) {
      return json_({ ok: false, error: "bad json" });
    }
    append_(data);
    return json_({ ok: true, stored: true });
  }
  // Plain health check
  return json_({ ok: true, service: "hidden-money-survey-collector" });
}

function doPost(e) {
  var data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: "bad json" });
  }
  append_(data);
  return json_({ ok: true, stored: true });
}

function append_(data) {
  var a = data.answers || {};
  getSheet_().appendRow([
    data.ts || new Date().toISOString(),
    join_(a.stage),
    join_(a.obstacle),
    join_(a.next_offer),
    join_(a.format),
    join_(a.paid_before),
    join_(a.outcome),
    join_(a.magic),
    join_(a.email)
  ]);
}

function join_(v) {
  return Array.isArray(v) ? v.join(" | ") : (v || "");
}

function json_(o) {
  return ContentService
    .createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return sh;
}
