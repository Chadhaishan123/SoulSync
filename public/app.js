const api = {
  async get(path) {
    const response = await fetch(path, authOptions());
    if (!response.ok) throw new Error("Unable to load data");
    return response.json();
  },
  async send(path, method, body) {
    const response = await fetch(path, {
      method,
      headers: authHeaders(),
      body: JSON.stringify(body)
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Something went wrong");
    return payload;
  }
};

function authHeaders() {
  const token = localStorage.getItem("soulSyncToken");
  return {
    "Content-Type": "application/json",
    ...(token ? { "X-Session-Token": token } : {})
  };
}

function authOptions() {
  const token = localStorage.getItem("soulSyncToken");
  return token ? { headers: { "X-Session-Token": token } } : {};
}

function byId(id) {
  return document.getElementById(id);
}

function fmtDate(value) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setActiveNav() {
  const current = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav a").forEach((link) => {
    const href = link.getAttribute("href");
    if (href === current || (current === "" && href === "index.html")) {
      link.classList.add("active");
    }
  });
}

function setStatus(id, message) {
  const element = byId(id);
  if (element) element.textContent = message;
}

function renderList(id, items, renderer, emptyMessage = "Nothing here yet.") {
  const element = byId(id);
  if (!element) return;
  element.innerHTML = items.length ? items.map(renderer).join("") : `<div class="empty">${emptyMessage}</div>`;
}

function drawMoodChart(canvas, trend) {
  if (!canvas || !trend.length) return;
  const ctx = canvas.getContext("2d");
  const width = canvas.width = canvas.clientWidth * devicePixelRatio;
  const height = canvas.height = 260 * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);
  ctx.clearRect(0, 0, width, height);
  const pad = 34;
  const chartWidth = canvas.clientWidth - pad * 2;
  const chartHeight = 180;

  ctx.strokeStyle = "#ddd7ca";
  ctx.lineWidth = 1;
  for (let i = 1; i <= 5; i += 1) {
    const y = pad + chartHeight - (i / 5) * chartHeight;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(pad + chartWidth, y);
    ctx.stroke();
  }

  const points = trend.map((item, index) => ({
    x: pad + (trend.length === 1 ? chartWidth / 2 : (index / (trend.length - 1)) * chartWidth),
    y: pad + chartHeight - (Number(item.intensity) / 10) * chartHeight,
    item
  }));

  ctx.strokeStyle = "#25746a";
  ctx.lineWidth = 4;
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();

  points.forEach((point) => {
    ctx.fillStyle = "#fffaf2";
    ctx.strokeStyle = "#18564e";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#667270";
    ctx.font = "12px system-ui";
    ctx.fillText(point.item.label, point.x - 18, pad + chartHeight + 28);
  });
}

async function initAuth() {
  const authState = byId("authState");
  if (!authState) return;

  async function refresh() {
    const data = await api.get("/api/auth/me");
    authState.innerHTML = `
      <article class="card">
        <h3>${escapeHtml(data.user.name)}</h3>
        <p>${escapeHtml(data.user.email)} ${data.isDemo ? "(demo mode)" : ""}</p>
        <div class="tag-row"><span class="tag">${escapeHtml(data.user.role)}</span><span class="tag warn">${data.isDemo ? "Demo account" : "Signed in"}</span></div>
      </article>
    `;
  }

  document.querySelectorAll("[data-auth-form]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const payload = Object.fromEntries(new FormData(form));
      const route = form.dataset.authForm === "register" ? "/api/auth/register" : "/api/auth/login";
      try {
        const data = await api.send(route, "POST", payload);
        localStorage.setItem("soulSyncToken", data.token);
        setStatus("authStatus", "Signed in successfully.");
        form.reset();
        await refresh();
      } catch (error) {
        setStatus("authStatus", error.message);
      }
    });
  });

  const logout = byId("logoutButton");
  if (logout) {
    logout.addEventListener("click", async () => {
      await api.send("/api/auth/logout", "POST", {});
      localStorage.removeItem("soulSyncToken");
      setStatus("authStatus", "Signed out. Demo mode is active.");
      await refresh();
    });
  }

  await refresh();
}

async function initHome() {
  const node = byId("homeStats");
  if (!node) return;
  const data = await api.get("/api/dashboard");
  node.innerHTML = `
    <article class="card metric"><span>Mood check-ins</span><strong>${data.moodCount}</strong><p>Logged moments of awareness.</p></article>
    <article class="card metric"><span>Journal entries</span><strong>${data.journalCount}</strong><p>Private reflections saved.</p></article>
    <article class="card metric"><span>Dream analyses</span><strong>${data.dreamCount || 0}</strong><p>NLP-assisted dream reflections.</p></article>
    <article class="card metric"><span>Bookings</span><strong>${data.appointmentCount}</strong><p>Support sessions requested.</p></article>
  `;
}

async function initDashboard() {
  const node = byId("dashboardMetrics");
  if (!node) return;
  const data = await api.get("/api/dashboard");
  node.innerHTML = `
    <article class="card metric"><span>Average mood</span><strong>${data.averageMood || "-"}/10</strong><p>Based on your saved check-ins.</p></article>
    <article class="card metric"><span>Latest mood</span><strong>${escapeHtml(data.latestMood?.mood || "New")}</strong><p>${data.latestMood ? fmtDate(data.latestMood.createdAt) : "Start with a quick check-in."}</p></article>
    <article class="card metric"><span>Journal</span><strong>${data.journalCount}</strong><p>Reflection entries created.</p></article>
    <article class="card metric"><span>Dreams</span><strong>${data.dreamCount || 0}</strong><p>Dreams analyzed with NLP signals.</p></article>
    <article class="card metric"><span>Sessions</span><strong>${data.appointmentCount}</strong><p>Appointments in the system.</p></article>
  `;

  byId("nextAppointment").innerHTML = data.nextAppointment
    ? `<h3>${escapeHtml(data.nextAppointment.therapist)}</h3><p>${escapeHtml(data.nextAppointment.sessionType)} on ${escapeHtml(data.nextAppointment.date)} at ${escapeHtml(data.nextAppointment.time)}</p>`
    : `<p class="empty">No appointment booked yet.</p>`;

  byId("recentJournal").innerHTML = data.recentJournal
    ? `<h3>${escapeHtml(data.recentJournal.title)}</h3><p>${escapeHtml(data.recentJournal.body)}</p><p class="meta">${fmtDate(data.recentJournal.createdAt)}</p>`
    : `<p class="empty">Your latest reflection will appear here.</p>`;

  byId("recentDream").innerHTML = data.recentDream
    ? `<h3>${escapeHtml(data.recentDream.title)}</h3><p>${escapeHtml(data.recentDream.analysis.interpretation)}</p><p class="meta">${fmtDate(data.recentDream.createdAt)}</p>`
    : `<p class="empty">Analyze a dream to see it here.</p>`;

  renderList("recommendedResources", data.resources, (item) => `
    <article class="list-item">
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.summary)}</p>
      <div class="tag-row"><span class="tag">${escapeHtml(item.category)}</span><span class="tag warn">${escapeHtml(item.readTime)}</span></div>
    </article>
  `);

  const insights = data.insights;
  if (byId("insightPanel") && insights) {
    byId("insightPanel").innerHTML = `
      <article class="card">
        <h3>Mood prediction</h3>
        <p>Predicted next check-in: <strong>${Number(insights.moodPrediction.predictedIntensity)}/10</strong></p>
        <p class="meta">Trend: ${escapeHtml(insights.moodPrediction.trend)} | Confidence: ${escapeHtml(insights.moodPrediction.confidence)}</p>
        <p>${escapeHtml(insights.moodPrediction.suggestion)}</p>
      </article>
      <article class="card">
        <h3>Safety screen</h3>
        <p>Current risk signal: <strong>${escapeHtml(insights.crisisScreen.risk)}</strong></p>
        <p>${escapeHtml(insights.crisisScreen.message)}</p>
      </article>
      <article class="card">
        <h3>Pattern summary</h3>
        <p>Recurring dream emotion: <strong>${escapeHtml(insights.patternSummary.recurringDreamEmotion)}</strong></p>
        <p class="meta">${Number(insights.patternSummary.moodEntries)} moods | ${Number(insights.patternSummary.journalEntries)} journals | ${Number(insights.patternSummary.dreamEntries)} dreams</p>
      </article>
    `;
  }
}

async function initAnalytics() {
  const reportNode = byId("weeklyReport");
  if (!reportNode) return;
  const [report, trend] = await Promise.all([
    api.get("/api/reports/weekly"),
    api.get("/api/analytics/mood-trend")
  ]);

  reportNode.innerHTML = `
    <article class="card metric"><span>Average mood</span><strong>${Number(report.averageMood) || "-"}/10</strong><p>${escapeHtml(report.summary)}</p></article>
    <article class="card metric"><span>Average sleep</span><strong>${Number(report.averageSleep) || "-"}</strong><p>Hours across recent check-ins.</p></article>
    <article class="card metric"><span>Journal words</span><strong>${Number(report.journalWords)}</strong><p>Reflection volume this week.</p></article>
  `;
  renderList("weeklySteps", report.nextSteps, (item) => `<article class="list-item"><p>${escapeHtml(item)}</p></article>`);
  renderList("weeklyResources", report.recommendedResources, (item) => `
    <article class="list-item"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary)}</p><p class="meta">${escapeHtml(item.category)} | ${escapeHtml(item.readTime)}</p></article>
  `);
  drawMoodChart(byId("moodChart"), trend);
}

async function initCompanion() {
  const form = byId("companionForm");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form));
    try {
      const result = await api.send("/api/companion", "POST", payload);
      byId("companionReply").innerHTML = `
        <article class="list-item">
          <h3>Companion response</h3>
          <p>${escapeHtml(result.reply)}</p>
          <p class="meta">Tone: ${escapeHtml(result.tone)} | Safety risk: ${escapeHtml(result.crisis.risk)}</p>
        </article>
      `;
      renderList("companionResources", result.suggestedResources || [], (item) => `
        <article class="list-item"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary)}</p></article>
      `);
    } catch (error) {
      setStatus("companionStatus", error.message);
    }
  });
}

async function initDreams() {
  const form = byId("dreamForm");
  if (!form) return;

  function renderAnalysis(entry) {
    const analysis = entry.analysis;
    const symbols = analysis.symbols.length
      ? analysis.symbols.map((item) => `<span class="tag">${escapeHtml(item.symbol)}</span>`).join("")
      : `<span class="tag warn">No clear symbols</span>`;
    const themes = analysis.topThemes.length
      ? analysis.topThemes.map((theme) => `<span class="tag">${escapeHtml(theme)}</span>`).join("")
      : `<span class="tag warn">reflective</span>`;
    const emotions = Object.entries(analysis.emotionScores)
      .map(([emotion, score]) => `
        <div class="score-row">
          <span>${escapeHtml(emotion)}</span>
          <div class="score-track"><span style="width: ${Number(score)}%"></span></div>
          <strong>${Number(score)}%</strong>
        </div>
      `).join("");

    return `
      <article class="list-item">
        <h3>${escapeHtml(entry.title)}</h3>
        <p>${escapeHtml(analysis.interpretation)}</p>
        <div class="analysis-grid">
          <div><span class="mini-label">Dominant emotion</span><strong>${escapeHtml(analysis.dominantEmotion)}</strong></div>
          <div><span class="mini-label">Intensity</span><strong>${Number(analysis.intensity)}/10</strong></div>
          <div><span class="mini-label">Word count</span><strong>${Number(analysis.wordCount)}</strong></div>
        </div>
        <div class="score-list">${emotions}</div>
        <div class="tag-row">${themes}${symbols}</div>
        <details>
          <summary>Model details</summary>
          <p>${escapeHtml(analysis.modelNotes.nlp)}</p>
          <p>${escapeHtml(analysis.modelNotes.ml)}</p>
          <p>${escapeHtml(analysis.modelNotes.dl)}</p>
        </details>
        <p class="meta">${escapeHtml(entry.sleepQuality || "Sleep quality not set")} | ${escapeHtml(entry.wakingMood || "Mood not set")} | ${fmtDate(entry.createdAt)}</p>
      </article>
    `;
  }

  async function load() {
    const dreams = await api.get("/api/dreams");
    renderList("dreamList", dreams, renderAnalysis, "No dreams analyzed yet.");
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form));
    try {
      const entry = await api.send("/api/dreams", "POST", payload);
      form.reset();
      setStatus("dreamStatus", "Dream analyzed and saved.");
      byId("dreamResult").innerHTML = renderAnalysis(entry);
      await load();
    } catch (error) {
      setStatus("dreamStatus", error.message);
    }
  });

  await load();
}

async function initMood() {
  const form = byId("moodForm");
  if (!form) return;

  async function load() {
    const moods = await api.get("/api/moods");
    renderList("moodList", moods, (item) => `
      <article class="list-item">
        <h3>${escapeHtml(item.mood)} - ${Number(item.intensity)}/10</h3>
        <p>${escapeHtml(item.note || "No note added.")}</p>
        <p class="meta">Sleep: ${Number(item.sleep || 0)} hours | Trigger: ${escapeHtml(item.trigger || "Not listed")} | ${fmtDate(item.createdAt)}</p>
      </article>
    `, "No mood check-ins yet.");
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form));
    try {
      await api.send("/api/moods", "POST", payload);
      form.reset();
      setStatus("moodStatus", "Mood check-in saved.");
      await load();
    } catch (error) {
      setStatus("moodStatus", error.message);
    }
  });

  await load();
}

async function initJournal() {
  const form = byId("journalForm");
  if (!form) return;

  async function load() {
    const entries = await api.get("/api/journal");
    renderList("journalList", entries, (item) => `
      <article class="list-item">
        <h3>${escapeHtml(item.title)}</h3>
        <p><strong>${escapeHtml(item.prompt || "Free reflection")}</strong></p>
        <p>${escapeHtml(item.body)}</p>
        <p class="meta">${fmtDate(item.createdAt)}</p>
      </article>
    `, "No journal entries yet.");
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form));
    try {
      await api.send("/api/journal", "POST", payload);
      form.reset();
      setStatus("journalStatus", "Journal entry saved.");
      await load();
    } catch (error) {
      setStatus("journalStatus", error.message);
    }
  });

  await load();
}

async function initResources() {
  const node = byId("resourceGrid");
  if (!node) return;
  const resources = await api.get("/api/resources");
  node.innerHTML = resources.map((item) => `
    <article class="card">
      <div class="tag-row"><span class="tag">${escapeHtml(item.category)}</span><span class="tag warn">${escapeHtml(item.readTime)}</span></div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.summary)}</p>
    </article>
  `).join("");
}

async function initTherapists() {
  const form = byId("appointmentForm");
  if (!form) return;
  const therapists = await api.get("/api/therapists");
  const therapistSelect = byId("therapist");
  therapistSelect.innerHTML = therapists.map((item) => `<option>${escapeHtml(item.name)}</option>`).join("");

  renderList("therapistList", therapists, (item) => `
    <article class="list-item">
      <h3>${escapeHtml(item.name)}</h3>
      <p>${escapeHtml(item.specialty)}</p>
      <p class="meta">${escapeHtml(item.language)} | ${escapeHtml(item.availability)} | ${escapeHtml(item.mode)}</p>
    </article>
  `);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form));
    try {
      await api.send("/api/appointments", "POST", payload);
      form.reset();
      therapistSelect.innerHTML = therapists.map((item) => `<option>${escapeHtml(item.name)}</option>`).join("");
      setStatus("appointmentStatus", "Appointment request saved.");
    } catch (error) {
      setStatus("appointmentStatus", error.message);
    }
  });

  const matchForm = byId("matchForm");
  if (matchForm) {
    matchForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const payload = Object.fromEntries(new FormData(matchForm));
      try {
        const matches = await api.send("/api/therapist-match", "POST", payload);
        renderList("matchList", matches, (item) => `
          <article class="list-item">
            <h3>${escapeHtml(item.name)} - ${Number(item.matchScore)}%</h3>
            <p>${escapeHtml(item.specialty)}</p>
            <p class="meta">${escapeHtml(item.language)} | ${escapeHtml(item.mode)} | ${escapeHtml(item.matchReason)}</p>
          </article>
        `);
      } catch (error) {
        setStatus("matchStatus", error.message);
      }
    });
  }
}

async function initSafetyCheck() {
  const form = byId("safetyForm");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form));
    try {
      const result = await api.send("/api/safety-check", "POST", payload);
      byId("safetyResult").innerHTML = `
        <article class="list-item">
          <h3>Risk signal: ${escapeHtml(result.risk)}</h3>
          <p>${escapeHtml(result.message)}</p>
          <p class="meta">Matched phrases: ${escapeHtml(result.matches.join(", ") || "none")}</p>
        </article>
      `;
    } catch (error) {
      setStatus("safetyStatus", error.message);
    }
  });
}

async function initProfile() {
  const form = byId("profileForm");
  if (!form) return;
  const profile = await api.get("/api/profile");
  form.name.value = profile.name || "";
  form.goal.value = profile.goal || "";
  form.preferredCheckIn.value = profile.preferredCheckIn || "";
  form.notifications.checked = Boolean(profile.notifications);
  form.privacyMode.checked = Boolean(profile.privacyMode);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form));
    payload.notifications = form.notifications.checked;
    payload.privacyMode = form.privacyMode.checked;
    try {
      await api.send("/api/profile", "PUT", payload);
      setStatus("profileStatus", "Profile settings updated.");
    } catch (error) {
      setStatus("profileStatus", error.message);
    }
  });
}

async function initAdmin() {
  const node = byId("adminOverview");
  if (!node) return;
  const [dashboard, appointments, moods, journals, dreams] = await Promise.all([
    api.get("/api/dashboard"),
    api.get("/api/appointments"),
    api.get("/api/moods"),
    api.get("/api/journal"),
    api.get("/api/dreams")
  ]);

  node.innerHTML = `
    <article class="card metric"><span>Total appointments</span><strong>${appointments.length}</strong><p>Booking requests stored.</p></article>
    <article class="card metric"><span>Mood entries</span><strong>${moods.length}</strong><p>Recent self check-ins.</p></article>
    <article class="card metric"><span>Journal entries</span><strong>${journals.length}</strong><p>Private reflections.</p></article>
    <article class="card metric"><span>Dream analyses</span><strong>${dreams.length}</strong><p>Saved NLP outputs.</p></article>
    <article class="card metric"><span>Average mood</span><strong>${dashboard.averageMood || "-"}/10</strong><p>Across all demo data.</p></article>
  `;

  renderList("appointmentList", appointments, (item) => `
    <article class="list-item">
      <h3>${escapeHtml(item.name)} with ${escapeHtml(item.therapist)}</h3>
      <p>${escapeHtml(item.sessionType)} - ${escapeHtml(item.date)} at ${escapeHtml(item.time)}</p>
      <p class="meta">${escapeHtml(item.email)} | ${escapeHtml(item.concern || "No concern listed")}</p>
    </article>
  `, "No appointment requests yet.");
}

document.addEventListener("DOMContentLoaded", () => {
  setActiveNav();
  initHome().catch(console.error);
  initAuth().catch(console.error);
  initDashboard().catch(console.error);
  initAnalytics().catch(console.error);
  initCompanion().catch(console.error);
  initMood().catch(console.error);
  initJournal().catch(console.error);
  initDreams().catch(console.error);
  initResources().catch(console.error);
  initTherapists().catch(console.error);
  initSafetyCheck().catch(console.error);
  initProfile().catch(console.error);
  initAdmin().catch(console.error);
});
