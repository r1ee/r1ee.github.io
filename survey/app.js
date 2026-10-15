/* ============================================================
   Hidden Money Survey — app logic
   - One question per screen, animated
   - Responses saved to localStorage + optional CRM webhook
   - Owner dashboard at #admin (charts, CSV export, webhook)
   ============================================================ */
(function () {
  "use strict";

  /* ---------------- question definitions ---------------- */
  var QUESTIONS = [
    {
      id: "stage", type: "single", emoji: "🧭", accent: "#7c3aed", accent2: "#a78bfa",
      title: "Where are you right now with finding hidden government money?",
      sub: "(surplus funds, overages, unclaimed funds — whatever you call it)",
      options: [
        "Just researching — I haven't started yet",
        "I've identified a source or lead, but haven't contacted anyone",
        "I'm actively working claims or deals",
        "I've already recovered money (mine or someone else's)",
        "I want this as a business, not just a one-time thing"
      ]
    },
    {
      id: "obstacle", type: "single", emoji: "🧱", accent: "#0891b2", accent2: "#22d3ee",
      title: "What's your #1 biggest obstacle right now?",
      sub: "Pick the one that slows you down most.",
      options: [
        "Finding the money — knowing which government sources to search",
        "Finding the people — locating the rightful owners",
        "The legal process — filings, deadlines, paperwork",
        "Contacting owners — scripts, calls, getting responses",
        "Knowing what to charge and how to get paid",
        "Finding the time to do the work",
        "Something else (tell me in the magic-wand question!)"
      ]
    },
    {
      id: "next_offer", type: "rank", max: 3, emoji: "🚀", accent: "#d97706", accent2: "#fbbf24",
      title: "Which of these would you pay for NEXT?",
      sub: "Tap to rank your top 3 — first tap is your #1.",
      options: [
        "Done-for-you service — I find the money, you do the work (revenue split)",
        "State-specific deep-dive training (e.g. Florida surplus, county tax overages)",
        "1-on-1 coaching or group mentorship with live Q&A",
        "Templates & tools — scripts, filing templates, county lists, spreadsheets",
        "Advanced strategies — tax surplus, judgment recovery, bankruptcy funds",
        "A live virtual workshop (weekend intensive)",
        "Certification + community — get trained, get listed, network",
        "Business-in-a-box — marketing, LLC setup, scaling to full-time"
      ]
    },
    {
      id: "format", type: "single", emoji: "🎓", accent: "#db2777", accent2: "#f472b6",
      title: "How do you prefer to learn?",
      sub: "Be honest — you'll get what you pick.",
      options: [
        "Self-paced video course I do alone",
        "Live training with Q&A (Zoom)",
        "1-on-1 coaching / consulting",
        "Done-WITH-you — you work on my actual deals with me",
        "Done-FOR-you — you just handle it",
        "Written guides, checklists, and templates"
      ]
    },
    {
      id: "paid_before", type: "single", emoji: "💳", accent: "#059669", accent2: "#34d399",
      title: "Have you ever paid for help with this before?",
      sub: "Courses, coaching, tools, anything counts.",
      options: [
        "No — your course is my first purchase",
        "Yes — another course or program",
        "Yes — coaching or mentorship",
        "Yes — I've paid someone to do it for me",
        "Yes — tools, lists, or data"
      ]
    },
    {
      id: "outcome", type: "single", emoji: "🎯", accent: "#4f46e5", accent2: "#818cf8",
      title: "What would an ideal outcome look like 12 months from now?",
      sub: "Picture yourself a year from today.",
      options: [
        "I've recovered money for myself or my family",
        "I've closed my first paid claim or deal",
        "I'm earning consistent side income from this",
        "This is my full-time business",
        "I have a system running mostly without me"
      ]
    },
    {
      id: "magic", type: "text", emoji: "🪄", accent: "#c026d3", accent2: "#e879f9", optional: true, skippable: true,
      title: "If you could wave a magic wand, what's the ONE thing that would make this easier?",
      sub: "No wrong answers. Your words shape what we build.",
      placeholder: "Type anything... e.g. “a ready-made list of counties that actually answer the phone”"
    },
    {
      id: "email", type: "email", emoji: "📬", accent: "#0284c7", accent2: "#38bdf8", optional: true,
      title: "Last one — want first dibs on what's next?",
      sub: "Leave your email to beta-test new programs at a discount (optional).",
      placeholder: "you@example.com"
    }
  ];

  var STORAGE_KEY = "hms_responses";
  var WEBHOOK_KEY = "hms_webhook_url";

  /* Baked-in webhook for the PUBLIC deployment.
     Every respondent's browser uses this URL (their localStorage is empty),
     so the collector URL must live here, not in the admin panel.
     Owner panel can still override it locally for testing. */
  var CONFIG = {
    webhookUrl: "https://script.google.com/macros/s/AKfycbwvFj_zHY_2_hencsV41Ml_O-QCCNiqq-NSW6ta-29SohmgO7Z38U0WSbUzyDvSUGdY/exec"
  };

  function getWebhookUrl() {
    return localStorage.getItem(WEBHOOK_KEY) || CONFIG.webhookUrl || "";
  }

  /* ---------------- state ---------------- */
  var step = -1; // -1 = welcome, 0..n-1 questions, n = thank you
  var answers = {};
  var animating = false;

  /* ---------------- dom refs ---------------- */
  var card = document.getElementById("card");
  var nextBtn = document.getElementById("next-btn");
  var backBtn = document.getElementById("back-btn");
  var progressFill = document.getElementById("progress-fill");
  var progressText = document.getElementById("progress-text");
  var progressPct = document.getElementById("progress-pct");
  var surveyView = document.getElementById("survey-view");
  var adminView = document.getElementById("admin-view");

  /* ============================================================
     ROUTING: #admin = owner dashboard, otherwise survey
     ============================================================ */
  function route() {
    if (location.hash === "#admin") {
      surveyView.classList.add("hidden");
      adminView.classList.remove("hidden");
      renderAdmin();
    } else {
      adminView.classList.add("hidden");
      surveyView.classList.remove("hidden");
    }
  }
  window.addEventListener("hashchange", route);

  /* ============================================================
     SURVEY FLOW
     ============================================================ */
  function setAccent(q) {
    document.documentElement.style.setProperty("--accent", q.accent || "#7c3aed");
    document.documentElement.style.setProperty("--accent-2", q.accent2 || "#ec4899");
  }

  function updateProgress() {
    var total = QUESTIONS.length;
    var done = step < 0 ? 0 : step >= total ? total : step;
    var pct = Math.round((done / total) * 100);
    progressFill.style.width = pct + "%";
    progressPct.textContent = pct + "%";
    if (step < 0) progressText.textContent = "Let's begin";
    else if (step >= total) progressText.textContent = "All done!";
    else progressText.textContent = "Question " + (step + 1) + " of " + total;
  }

  function renderStep() {
    updateProgress();
    backBtn.style.visibility = step <= 0 ? "hidden" : "visible";

    if (step === -1) { renderWelcome(); return; }
    if (step >= QUESTIONS.length) { renderThanks(); return; }

    var q = QUESTIONS[step];
    setAccent(q);
    var html = '';

    if (q.type === "single" || q.type === "rank") {
      var hint = q.type === "rank"
        ? '<p class="rank-hint">➡️ Pick your top ' + q.max + ' — order matters. <span id="rank-count"></span></p>'
        : "";
      html += '<span class="q-emoji">' + q.emoji + '</span>' +
        '<h2 class="q-title">' + q.title + '</h2>' +
        '<p class="q-sub">' + q.sub + '</p>' + hint +
        '<div class="options" id="options">' +
        q.options.map(function (opt, i) {
          return '<button type="button" class="option" data-idx="' + i + '" style="animation-delay:' + (i * 55) + 'ms">' +
            (q.type === "rank"
              ? '<span class="opt-rank" data-rank></span>'
              : '<span class="opt-letter">' + String.fromCharCode(65 + i) + '</span>') +
            '<span>' + opt + '</span></button>';
        }).join("") +
        '</div>';
    } else if (q.type === "text") {
      html += '<span class="q-emoji">' + q.emoji + '</span>' +
        '<h2 class="q-title">' + q.title + '</h2>' +
        '<p class="q-sub">' + q.sub + '</p>' +
        '<textarea id="free-text" class="free-input" placeholder="' + (q.placeholder || "") + '"></textarea>';
    } else if (q.type === "email") {
      html += '<span class="q-emoji">' + q.emoji + '</span>' +
        '<h2 class="q-title">' + q.title + '</h2>' +
        '<p class="q-sub">' + q.sub + '</p>' +
        '<input id="free-text" type="email" class="free-input email-input" placeholder="' + (q.placeholder || "") + '" />';
    }

    swapContent(html, function () {
      // restore existing answer (back-navigation editing)
      var existing = answers[q.id];
      if (q.type === "single" && typeof existing === "number") {
        selectOption(existing);
      } else if (q.type === "rank" && Array.isArray(existing)) {
        existing.forEach(function (idx, rankPos) { markRank(idx, rankPos + 1); });
        updateRankHint();
      } else if ((q.type === "text" || q.type === "email") && existing) {
        document.getElementById("free-text").value = existing;
      }
      refreshNextState();
      bindQuestionEvents(q);
    });
  }

  function renderWelcome() {
    document.documentElement.style.setProperty("--accent", "#7c3aed");
    document.documentElement.style.setProperty("--accent-2", "#ec4899");
    var html =
      '<div class="hero-emoji">💰</div>' +
      '<h1 class="hero-title">Help us build <span class="grad">what\'s next</span> for you</h1>' +
      '<p class="hero-sub">You found the course on hidden government money. Now we\'re deciding what to build next — and <strong>you</strong> get to vote: new trainings, tools, coaching, done-for-you services, and more.</p>' +
      '<p class="hero-sub"><strong>8 quick questions. About 3 minutes. Zero spam.</strong></p>' +
      '<div class="hero-chips">' +
      '<span class="chip chip-1">🗳️ You vote</span>' +
      '<span class="chip chip-2">🎁 Beta-test discounts</span>' +
      '<span class="chip chip-3">🚀 New offers</span>' +
      '<span class="chip chip-4">⏱️ 3 minutes</span>' +
      '</div>';
    swapContent(html);
    nextBtn.innerHTML = "Let's go 🎉";
    refreshNextState();
  }

  function renderThanks() {
    updateProgress();
    backBtn.style.visibility = "hidden";
    var html =
      '<div class="thanks">' +
      '<div class="thanks-emoji">🎉</div>' +
      '<h2>You\'re in!</h2>' +
      '<p>Thank you — your answers go straight into what we build next.<br/>' +
      'Keep an eye on your inbox for beta invites and early-bird pricing.</p>' +
      '</div>';
    swapContent(html);
    nextBtn.disabled = false;
    nextBtn.innerHTML = "Done ✔";
    nextBtn.onclick = function () { /* stay */ };
    fireConfetti();
  }

  function swapContent(html, afterRender) {
    if (animating) return;
    animating = true;
    card.classList.remove("q-enter");
    card.classList.add("q-exit");
    setTimeout(function () {
      card.innerHTML = html;
      card.classList.remove("q-exit");
      // force reflow so the enter animation replays
      void card.offsetWidth;
      card.classList.add("q-enter");
      animating = false;
      // binding must happen AFTER the DOM exists — never before
      if (afterRender) afterRender();
    }, 240);
  }

  /* ---------------- interactions ---------------- */
  function currentQuestion() {
    if (step < 0 || step >= QUESTIONS.length) return null;
    return QUESTIONS[step];
  }

  function bindQuestionEvents(q) {
    var opts = document.querySelectorAll("#options .option");
    opts.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var idx = parseInt(btn.getAttribute("data-idx"), 10);
        if (q.type === "single") {
          answers[q.id] = idx;
          opts.forEach(function (b) { b.classList.remove("selected"); });
          btn.classList.add("selected");
        } else if (q.type === "rank") {
          toggleRank(q, idx);
        }
        refreshNextState();
      });
    });
    var free = document.getElementById("free-text");
    if (free) {
      free.addEventListener("input", function () {
        answers[q.id] = free.value;
        refreshNextState();
      });
      setTimeout(function () { free.focus(); }, 500);
    }
  }

  function selectOption(idx) {
    var btn = document.querySelector('#options .option[data-idx="' + idx + '"]');
    if (btn) btn.classList.add("selected");
  }

  function toggleRank(q, idx) {
    var arr = answers[q.id] || (answers[q.id] = []);
    var pos = arr.indexOf(idx);
    if (pos > -1) {
      arr.splice(pos, 1); // deselect
    } else {
      if (arr.length >= q.max) arr.shift(); // drop oldest
      arr.push(idx);
    }
    // repaint all
    document.querySelectorAll("#options .option").forEach(function (b) {
      var i = parseInt(b.getAttribute("data-idx"), 10);
      var rankPos = arr.indexOf(i);
      b.classList.toggle("selected", rankPos > -1);
      var badge = b.querySelector("[data-rank]");
      if (badge) badge.textContent = rankPos > -1 ? (rankPos + 1) : "";
    });
    updateRankHint();
  }

  function markRank(idx, rankNum) {
    var btn = document.querySelector('#options .option[data-idx="' + idx + '"]');
    if (!btn) return;
    btn.classList.add("selected");
    var badge = btn.querySelector("[data-rank]");
    if (badge) badge.textContent = rankNum;
  }

  function updateRankHint() {
    var el = document.getElementById("rank-count");
    var q = currentQuestion();
    if (!el || !q) return;
    var arr = answers[q.id] || [];
    el.textContent = arr.length + " of " + q.max + " picked";
  }

  function isStepValid() {
    if (step === -1) return true;
    var q = currentQuestion();
    if (!q) return true;
    var a = answers[q.id];
    if (q.type === "single") return typeof a === "number";
    if (q.type === "rank") return Array.isArray(a) && a.length > 0;
    if (q.type === "text") return q.optional ? true : !!(a && a.trim());
    if (q.type === "email") {
      if (!a || !a.trim()) return q.optional === true;
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.trim());
    }
    return true;
  }

  function refreshNextState() {
    if (step >= QUESTIONS.length) return;
    nextBtn.disabled = !isStepValid();
    var q = currentQuestion();
    if (q && q.skippable && !isStepValid()) {
      nextBtn.disabled = false;
      nextBtn.innerHTML = "Skip ⏭";
    } else if (step === -1) {
      nextBtn.innerHTML = "Let's go 🎉";
    } else {
      nextBtn.innerHTML = step === QUESTIONS.length - 1 ? "Finish 🎉" : "Next ➜";
    }
  }

  /* ---------------- navigation ---------------- */
  var submitted = false;
  nextBtn.addEventListener("click", function () {
    if (nextBtn.disabled || animating) return;
    if (step >= QUESTIONS.length) return;
    // submit BEFORE incrementing step, while step still points at the last question
    if (step === QUESTIONS.length - 1 && !submitted) {
      submitted = true;
      submit();
    }
    step++;
    renderStep();
  });
  backBtn.addEventListener("click", function () {
    if (step <= -1 || animating) return;
    step--;
    renderStep();
  });
  document.addEventListener("keydown", function (e) {
    if (location.hash === "#admin") return;
    if (e.key === "Enter" && !nextBtn.disabled && document.activeElement.tagName !== "TEXTAREA") {
      nextBtn.click();
    }
    if (e.key === "ArrowRight" && !nextBtn.disabled) nextBtn.click();
    if (e.key === "ArrowLeft" && backBtn.style.visibility !== "hidden") backBtn.click();
  });

  /* ---------------- submission ---------------- */
  function getVisitorIp() {
    // Best-effort client-side IP lookup (static hosting has no server to read it from).
    // Resolves "" on failure/timeout so submission is never blocked.
    return new Promise(function (resolve) {
      var done = false;
      function finish(v) { if (!done) { done = true; resolve(v); } }
      setTimeout(function () { finish(""); }, 2500);
      try {
        fetch("https://api.ipify.org?format=json")
          .then(function (r) { return r.json(); })
          .then(function (d) { finish(d && d.ip ? d.ip : ""); })
          .catch(function () { finish(""); });
      } catch (e) { finish(""); }
    });
  }

  function submit() {
    var record = { ts: new Date().toISOString(), ip: "", answers: {} };
    QUESTIONS.forEach(function (q) {
      var a = answers[q.id];
      if (q.type === "single") record.answers[q.id] = typeof a === "number" ? q.options[a] : "";
      else if (q.type === "rank") record.answers[q.id] = (a || []).map(function (i) { return q.options[i]; });
      else record.answers[q.id] = a || "";
    });

    // Send exactly once: as soon as the IP resolves, or after 3s without it.
    var sent = false;
    function sendNow(ip) {
      if (sent) return;
      sent = true;
      record.ip = ip || "";
      var all = loadResponses();
      all.push(record);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); } catch (e) {}

      // fire-and-forget webhook to CRM / collector.
      // Transport = GET with encoded payload: Apps Script answers POST with a
      // 302 redirect, and browsers rewrite redirected POSTs to GET (body lost).
      // GET survives the redirect intact.
      var hook = getWebhookUrl();
      if (hook) {
        try {
          fetch(hook + (hook.indexOf("?") > -1 ? "&" : "?") + "d=" + encodeURIComponent(JSON.stringify(record)))
            .catch(function () {});
        } catch (e) {}
      }
    }
    getVisitorIp().then(sendNow);
    setTimeout(function () { sendNow(""); }, 3000);
  }

  /* ---------------- confetti ---------------- */
  function fireConfetti() {
    var canvas = document.getElementById("confetti");
    var ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    var colors = ["#7c3aed", "#ec4899", "#f59e0b", "#22d3ee", "#34d399", "#fbbf24"];
    var parts = [];
    for (var i = 0; i < 160; i++) {
      parts.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * canvas.height * 0.5,
        w: 6 + Math.random() * 8,
        h: 8 + Math.random() * 10,
        c: colors[Math.floor(Math.random() * colors.length)],
        vy: 2 + Math.random() * 3.5,
        vx: -1.5 + Math.random() * 3,
        rot: Math.random() * Math.PI,
        vr: -0.12 + Math.random() * 0.24
      });
    }
    var start = performance.now();
    (function frame(t) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      parts.forEach(function (p) {
        p.y += p.vy; p.x += p.vx; p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (t - start < 4200) requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    })(start);
  }

  /* ============================================================
     ADMIN DASHBOARD
     ============================================================ */
  function loadResponses() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  function renderAdmin() {
    var responses = loadResponses();
    document.getElementById("admin-count").textContent =
      responses.length + (responses.length === 1 ? " response" : " responses") +
      " · stored in this browser";

    // webhook panel
    var hookInput = document.getElementById("webhook-input");
    hookInput.value = localStorage.getItem(WEBHOOK_KEY) || "";
    var baked = getWebhookUrl();
    document.getElementById("webhook-status").textContent =
      baked
        ? "✅ Webhook active — every new response is sent there automatically. (Deployed URL: " + (CONFIG.webhookUrl || "local override") + ")"
        : "No webhook set — responses are only stored in this browser. Paste a collector/CRM URL above to activate.";

    var charts = document.getElementById("charts");
    charts.innerHTML = "";
    if (!responses.length) {
      charts.innerHTML = '<div class="chart-card"><p class="no-data">No responses yet. Share the survey link, then come back here.</p></div>';
    } else {
      QUESTIONS.forEach(function (q, qi) {
        var cardEl = document.createElement("div");
        cardEl.className = "chart-card";
        var title = document.createElement("div");
        title.className = "chart-title";
        title.textContent = (qi + 1) + ". " + q.title;
        cardEl.appendChild(title);
        var sub = document.createElement("div");
        sub.className = "chart-sub";
        sub.textContent = q.type === "rank" ? "Ranked picks (score = 3pts for #1, 2 for #2, 1 for #3)" :
          q.type === "single" ? "Single choice" : q.type === "email" ? "Optional email" : "Open answers";
        cardEl.appendChild(sub);

        if (q.type === "single") {
          var counts = q.options.map(function () { return 0; });
          responses.forEach(function (r) {
            var v = r.answers[q.id];
            var idx = q.options.indexOf(v);
            if (idx > -1) counts[idx]++;
          });
          var max = Math.max.apply(null, counts.concat([1]));
          q.options.forEach(function (opt, i) {
            cardEl.appendChild(barRow(opt, counts[i], max, responses.length, q));
          });
        } else if (q.type === "rank") {
          var scores = q.options.map(function () { return 0; });
          responses.forEach(function (r) {
            var arr = r.answers[q.id] || [];
            arr.forEach(function (label, pos) {
              var idx = q.options.indexOf(label);
              if (idx > -1) scores[idx] += (q.max - pos);
            });
          });
          var maxS = Math.max.apply(null, scores.concat([1]));
          q.options.forEach(function (opt, i) {
            cardEl.appendChild(barRow(opt, scores[i], maxS, responses.length, q, " pts"));
          });
        } else if (q.type === "text") {
          var any = false;
          responses.forEach(function (r) {
            var v = (r.answers[q.id] || "").toString().trim();
            if (v) {
              any = true;
              var d = document.createElement("div");
              d.className = "text-answer";
              d.textContent = "“" + v + "”";
              cardEl.appendChild(d);
            }
          });
          if (!any) cardEl.insertAdjacentHTML("beforeend", '<p class="no-data">No answers yet.</p>');
        } else if (q.type === "email") {
          var emails = responses.map(function (r) { return (r.answers[q.id] || "").toString().trim(); }).filter(Boolean);
          if (!emails.length) cardEl.insertAdjacentHTML("beforeend", '<p class="no-data">No emails collected yet.</p>');
          else emails.forEach(function (em) {
            var d = document.createElement("div");
            d.className = "text-answer";
            d.textContent = em;
            cardEl.appendChild(d);
          });
        }
        charts.appendChild(cardEl);
      });
    }

    renderResponsesTable(responses);
  }

  function barRow(label, value, max, total, q, suffix) {
    suffix = suffix || "";
    var pct = Math.round((value / max) * 100);
    var share = total ? Math.round((value / total) * 100) : 0;
    var row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML =
      '<div class="bar-label">' + escapeHtml(label) + '</div>' +
      '<div class="bar-track"><div class="bar-fill" style="--c1:' + q.accent + ';--c2:' + q.accent2 + '"></div></div>' +
      '<div class="bar-count">' + value + suffix + (suffix ? "" : " · " + share + "%") + '</div>';
    setTimeout(function () {
      row.querySelector(".bar-fill").style.width = pct + "%";
    }, 60);
    return row;
  }

  function renderResponsesTable(responses) {
    var wrap = document.getElementById("responses-table-wrap");
    if (!responses.length) {
      wrap.innerHTML = '<p class="no-data">Nothing here yet.</p>';
      return;
    }
    var cols = QUESTIONS.map(function (q) { return q.id; });
    var html = '<div class="resp-table-wrap"><table class="responses"><thead><tr>' +
      '<th>#</th><th>Time</th>' + QUESTIONS.map(function (q) { return "<th>" + escapeHtml(shortTitle(q)) + "</th>"; }).join("") +
      '</tr></thead><tbody>';
    responses.slice().reverse().forEach(function (r, i) {
      html += "<tr><td>" + (responses.length - i) + "</td><td>" + new Date(r.ts).toLocaleString() + "</td>";
      cols.forEach(function (id) {
        var v = r.answers[id];
        if (Array.isArray(v)) v = v.join(" | ");
        html += "<td>" + escapeHtml((v || "").toString()) + "</td>";
      });
      html += "</tr>";
    });
    html += "</tbody></table></div>";
    wrap.innerHTML = html;
  }

  function shortTitle(q) {
    return q.title.length > 34 ? q.title.slice(0, 34) + "…" : q.title;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------------- admin actions ---------------- */
  document.getElementById("save-webhook-btn").addEventListener("click", function () {
    var v = document.getElementById("webhook-input").value.trim();
    if (v) localStorage.setItem(WEBHOOK_KEY, v);
    else localStorage.removeItem(WEBHOOK_KEY);
    renderAdmin();
  });
  document.getElementById("export-btn").addEventListener("click", function () {
    var responses = loadResponses();
    if (!responses.length) { alert("No responses to export yet."); return; }
    var header = ["timestamp"].concat(QUESTIONS.map(function (q) { return q.id; }));
    var lines = [header.join(",")];
    responses.forEach(function (r) {
      var row = [r.ts];
      QUESTIONS.forEach(function (q) {
        var v = r.answers[q.id];
        if (Array.isArray(v)) v = v.join(" | ");
        row.push('"' + String(v || "").replace(/"/g, '""') + '"');
      });
      lines.push(row.join(","));
    });
    var blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "hidden-money-survey-responses.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });
  document.getElementById("clear-btn").addEventListener("click", function () {
    if (confirm("Delete ALL stored responses? This cannot be undone.")) {
      localStorage.removeItem(STORAGE_KEY);
      renderAdmin();
    }
  });

  /* ---------------- boot ---------------- */
  route();
  renderStep();
})();
