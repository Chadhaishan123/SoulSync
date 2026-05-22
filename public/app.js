const api = {
  async get(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error("Unable to load data");
    return response.json();
  },
  async send(path, method, body) {
    const response = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Something went wrong");
    return payload;
  }
};

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

async function initHome() {
  const node = byId("homeStats");
  if (!node) return;
  const data = await api.get("/api/dashboard");
  node.innerHTML = `
    <article class="card metric"><span>Mood check-ins</span><strong>${data.moodCount}</strong><p>Logged moments of awareness.</p></article>
    <article class="card metric"><span>Journal entries</span><strong>${data.journalCount}</strong><p>Private reflections saved.</p></article>
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
    <article class="card metric"><span>Sessions</span><strong>${data.appointmentCount}</strong><p>Appointments in the system.</p></article>
  `;

  byId("nextAppointment").innerHTML = data.nextAppointment
    ? `<h3>${escapeHtml(data.nextAppointment.therapist)}</h3><p>${escapeHtml(data.nextAppointment.sessionType)} on ${escapeHtml(data.nextAppointment.date)} at ${escapeHtml(data.nextAppointment.time)}</p>`
    : `<p class="empty">No appointment booked yet.</p>`;

  byId("recentJournal").innerHTML = data.recentJournal
    ? `<h3>${escapeHtml(data.recentJournal.title)}</h3><p>${escapeHtml(data.recentJournal.body)}</p><p class="meta">${fmtDate(data.recentJournal.createdAt)}</p>`
    : `<p class="empty">Your latest reflection will appear here.</p>`;

  renderList("recommendedResources", data.resources, (item) => `
    <article class="list-item">
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.summary)}</p>
      <div class="tag-row"><span class="tag">${escapeHtml(item.category)}</span><span class="tag warn">${escapeHtml(item.readTime)}</span></div>
    </article>
  `);
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
  const [dashboard, appointments, moods, journals] = await Promise.all([
    api.get("/api/dashboard"),
    api.get("/api/appointments"),
    api.get("/api/moods"),
    api.get("/api/journal")
  ]);

  node.innerHTML = `
    <article class="card metric"><span>Total appointments</span><strong>${appointments.length}</strong><p>Booking requests stored.</p></article>
    <article class="card metric"><span>Mood entries</span><strong>${moods.length}</strong><p>Recent self check-ins.</p></article>
    <article class="card metric"><span>Journal entries</span><strong>${journals.length}</strong><p>Private reflections.</p></article>
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
  initDashboard().catch(console.error);
  initMood().catch(console.error);
  initJournal().catch(console.error);
  initResources().catch(console.error);
  initTherapists().catch(console.error);
  initProfile().catch(console.error);
  initAdmin().catch(console.error);
});
