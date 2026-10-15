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
 * SETUP / UPDATE:
 * 1. Extensions → Apps Script (in your Responses Google Sheet)
 * 2. Delete the default code, paste ALL of this file, save (💾)
 * 3. Deploy → Manage deployments → ✏️ → Version: New version → Deploy
 *    (URL never changes)
 * 4. Run setupAnalysis ONCE: in the editor, select setupAnalysis in the
 *    toolbar dropdown → Run → authorize. It builds the auto-scoring
 *    "Analysis" tab. Afterwards you can rebuild anytime from the
 *    "Survey" menu inside the Sheet (no editor needed).
 *
 * TEST: open the Web app URL in a browser — you should see
 * {"ok":true,"service":"hidden-money-survey-collector"}
 */

var SHEET_NAME = "Responses";
var HEADERS = ["timestamp", "stage", "obstacle", "next_offer", "format", "paid_before", "outcome", "magic", "email", "ip"];

/* Option text must match survey/app.js exactly (used by the Analysis tab). */
var OPTIONS = {
  stage: [
    "Just researching — I haven't started yet",
    "I've identified a source or lead, but haven't contacted anyone",
    "I'm actively working claims or deals",
    "I've already recovered money (mine or someone else's)",
    "I want this as a business, not just a one-time thing"
  ],
  obstacle: [
    "Finding the money — knowing which government sources to search",
    "Finding the people — locating the rightful owners",
    "The legal process — filings, deadlines, paperwork",
    "Contacting owners — scripts, calls, getting responses",
    "Knowing what to charge and how to get paid",
    "Finding the time to do the work",
    "Something else (tell me in the magic-wand question!)"
  ],
  format: [
    "Self-paced video course I do alone",
    "Live training with Q&A (Zoom)",
    "1-on-1 coaching / consulting",
    "Done-WITH-you — you work on my actual deals with me",
    "Done-FOR-you — you just handle it",
    "Written guides, checklists, and templates"
  ],
  paid_before: [
    "No — your course is my first purchase",
    "Yes — another course or program",
    "Yes — coaching or mentorship",
    "Yes — I've paid someone to do it for me",
    "Yes — tools, lists, or data"
  ],
  outcome: [
    "I've recovered money for myself or my family",
    "I've closed my first paid claim or deal",
    "I'm earning consistent side income from this",
    "This is my full-time business",
    "I have a system running mostly without me"
  ],
  next_offer: [
    "Done-for-you service — I find the money, you do the work (revenue split)",
    "State-specific deep-dive training (e.g. Florida surplus, county tax overages)",
    "1-on-1 coaching or group mentorship with live Q&A",
    "Templates & tools — scripts, filing templates, county lists, spreadsheets",
    "Advanced strategies — tax surplus, judgment recovery, bankruptcy funds",
    "A live virtual workshop (weekend intensive)",
    "Certification + community — get trained, get listed, network",
    "Business-in-a-box — marketing, LLC setup, scaling to full-time"
  ]
};

/* ---------------- request handlers ---------------- */

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
    join_(a.email),
    data.ip || ""
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
  }
  // keep header row in sync (adds "ip" for sheets created before it existed)
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
  } else {
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }
  sh.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
  sh.setFrozenRows(1);
  return sh;
}

/* ---------------- Analysis tab ---------------- */

function onOpen() {
  SpreadsheetApp.getUi().createMenu("Survey")
    .addItem("Rebuild Analysis tab", "setupAnalysis")
    .addToUi();
}

function setupAnalysis() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  getSheet_(); // ensures Responses headers exist incl. "ip"

  var old = ss.getSheetByName("Analysis");
  if (old) ss.deleteSheet(old);
  var sh = ss.insertSheet("Analysis", 1);
  sh.setFrozenRows(2);

  var r = 1;
  cell_(sh, r, 1, "📊 Survey Analysis — recalculates automatically as responses arrive").setFontWeight("bold").setFontSize(13);
  r += 2;

  // ---- summary ----
  cell_(sh, r, 1, "Responses (total)").setFontWeight("bold");
  cell_(sh, r, 2, '=COUNTA(Responses!A:A)-1').setFontWeight("bold");
  r++;
  cell_(sh, r, 1, "Emails collected");
  cell_(sh, r, 2, '=COUNTIF(Responses!I:I,"*@*")');
  r++;
  cell_(sh, r, 1, "Unique IPs seen");
  cell_(sh, r, 2, '=COUNTA(UNIQUE(FILTER(Responses!J2:J,Responses!J2:J<>"")))');
  r += 2;

  // ---- single-choice sections: [title, Responses column letter, options] ----
  var sections = [
    ["WHERE THEY ARE NOW", "B", OPTIONS.stage],
    ["#1 BIGGEST OBSTACLE", "C", OPTIONS.obstacle],
    ["LEARNING FORMAT PREFERENCE", "E", OPTIONS.format],
    ["PAID FOR HELP BEFORE?", "F", OPTIONS.paid_before],
    ["IDEAL OUTCOME — 12 MONTHS", "G", OPTIONS.outcome]
  ];
  sections.forEach(function (sec) {
    cell_(sh, r, 1, sec[0]).setFontWeight("bold");
    cell_(sh, r, 2, "Count").setFontWeight("bold");
    cell_(sh, r, 3, "% of responses").setFontWeight("bold");
    r++;
    sec[2].forEach(function (opt) {
      cell_(sh, r, 1, opt);
      cell_(sh, r, 2, '=COUNTIF(Responses!' + sec[1] + ':' + sec[1] + ',"' + opt + '")');
      var pct = sh.getRange(r, 3);
      pct.setFormula('=IF(COUNTA(Responses!A:A)<=1,"",B' + r + '/(COUNTA(Responses!A:A)-1))');
      pct.setNumberFormat("0%");
      r++;
    });
    r++;
  });

  // ---- offer leaderboard (ranked top-3 scoring) ----
  // Responses!D holds "1st | 2nd | 3rd" (ranked order preserved)
  cell_(sh, r, 1, "OFFER LEADERBOARD (ranked top-3)").setFontWeight("bold");
  r++;
  ["Offer", "Mentions (top-3)", "#1 votes", "#2 votes", "#3 votes", "Weighted score"].forEach(function (h, i) {
    cell_(sh, r, i + 1, h).setFontWeight("bold");
  });
  r++;
  OPTIONS.next_offer.forEach(function (opt) {
    cell_(sh, r, 1, opt);
    cell_(sh, r, 2, '=SUMPRODUCT(--ISNUMBER(SEARCH($A' + r + ',Responses!$D$2:$D$5000)))');
    cell_(sh, r, 3, '=COUNTIF(Responses!$D:$D,$A' + r + '&"*")');
    cell_(sh, r, 5, '=COUNTIF(Responses!$D:$D,"* | "&$A' + r + ')');
    cell_(sh, r, 4, '=B' + r + '-C' + r + '-E' + r);
    cell_(sh, r, 6, '=C' + r + '*3+D' + r + '*2+E' + r).setFontWeight("bold");
    r++;
  });
  r++;

  // ---- raw magic-wand answers for qualitative reading ----
  cell_(sh, r, 1, "MAGIC-WAND ANSWERS (verbatim)").setFontWeight("bold");
  r++;
  cell_(sh, r, 1, '=FILTER(Responses!H2:H,Responses!H2:H<>"")');

  sh.autoResizeColumns(1, 6);
  ss.toast("Analysis tab built ✅ It updates itself as responses arrive.", "Survey", 5);
}

function cell_(sh, row, col, value) {
  var c = sh.getRange(row, col);
  if (typeof value === "string" && value.charAt(0) === "=") {
    c.setFormula(value.substring(1));
  } else {
    c.setValue(value);
  }
  return c;
}
