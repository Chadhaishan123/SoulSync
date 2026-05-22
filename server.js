const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { analyzeDream } = require("./dreamAnalyzer");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DB_PATH = path.join(ROOT, "data", "db.json");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

async function readDb() {
  const data = await fs.readFile(DB_PATH, "utf8");
  return JSON.parse(data);
}

async function writeDb(db) {
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2));
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { error: message });
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (!chunks.length) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Invalid JSON body");
    error.statusCode = 400;
    throw error;
  }
}

function requiredFields(body, fields) {
  return fields.filter((field) => !String(body[field] || "").trim());
}

function createId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function buildDashboard(db) {
  const sortedMoods = [...db.moods].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const latestMood = sortedMoods[0] || null;
  const averageMood = db.moods.length
    ? Math.round(db.moods.reduce((sum, item) => sum + Number(item.intensity || 0), 0) / db.moods.length)
    : 0;

  return {
    latestMood,
    averageMood,
    moodCount: db.moods.length,
    journalCount: db.journal.length,
    dreamCount: (db.dreams || []).length,
    appointmentCount: db.appointments.length,
    nextAppointment: [...db.appointments].sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))[0] || null,
    recentJournal: [...db.journal].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null,
    recentDream: [...(db.dreams || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null,
    resources: db.resources.slice(0, 3)
  };
}

async function handleApi(req, res, pathname) {
  const db = await readDb();

  if (req.method === "GET" && pathname === "/api/dashboard") {
    return sendJson(res, 200, buildDashboard(db));
  }

  if (req.method === "GET" && pathname === "/api/moods") {
    return sendJson(res, 200, [...db.moods].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  }

  if (req.method === "POST" && pathname === "/api/moods") {
    const body = await readBody(req);
    const missing = requiredFields(body, ["mood", "intensity"]);
    if (missing.length) return sendError(res, 422, `Missing fields: ${missing.join(", ")}`);

    const entry = {
      id: createId("mood"),
      mood: String(body.mood).trim(),
      intensity: Number(body.intensity),
      sleep: Number(body.sleep || 0),
      trigger: String(body.trigger || "").trim(),
      note: String(body.note || "").trim(),
      createdAt: new Date().toISOString()
    };

    db.moods.push(entry);
    await writeDb(db);
    return sendJson(res, 201, entry);
  }

  if (req.method === "GET" && pathname === "/api/journal") {
    return sendJson(res, 200, [...db.journal].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  }

  if (req.method === "POST" && pathname === "/api/journal") {
    const body = await readBody(req);
    const missing = requiredFields(body, ["title", "body"]);
    if (missing.length) return sendError(res, 422, `Missing fields: ${missing.join(", ")}`);

    const entry = {
      id: createId("journal"),
      title: String(body.title).trim(),
      prompt: String(body.prompt || "").trim(),
      body: String(body.body).trim(),
      createdAt: new Date().toISOString()
    };

    db.journal.push(entry);
    await writeDb(db);
    return sendJson(res, 201, entry);
  }

  if (req.method === "GET" && pathname === "/api/dreams") {
    return sendJson(res, 200, [...(db.dreams || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  }

  if (req.method === "POST" && pathname === "/api/dreams") {
    const body = await readBody(req);
    const missing = requiredFields(body, ["title", "dream"]);
    if (missing.length) return sendError(res, 422, `Missing fields: ${missing.join(", ")}`);

    const analysis = analyzeDream(body.dream);
    const entry = {
      id: createId("dream"),
      title: String(body.title).trim(),
      dream: String(body.dream).trim(),
      sleepQuality: String(body.sleepQuality || "").trim(),
      wakingMood: String(body.wakingMood || "").trim(),
      analysis,
      createdAt: new Date().toISOString()
    };

    db.dreams = db.dreams || [];
    db.dreams.push(entry);
    await writeDb(db);
    return sendJson(res, 201, entry);
  }

  if (req.method === "GET" && pathname === "/api/resources") {
    return sendJson(res, 200, db.resources);
  }

  if (req.method === "GET" && pathname === "/api/therapists") {
    return sendJson(res, 200, db.therapists);
  }

  if (req.method === "GET" && pathname === "/api/appointments") {
    return sendJson(res, 200, [...db.appointments].sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)));
  }

  if (req.method === "POST" && pathname === "/api/appointments") {
    const body = await readBody(req);
    const missing = requiredFields(body, ["name", "email", "therapist", "sessionType", "date", "time"]);
    if (missing.length) return sendError(res, 422, `Missing fields: ${missing.join(", ")}`);

    const appointment = {
      id: createId("appointment"),
      name: String(body.name).trim(),
      email: String(body.email).trim(),
      therapist: String(body.therapist).trim(),
      sessionType: String(body.sessionType).trim(),
      date: String(body.date).trim(),
      time: String(body.time).trim(),
      concern: String(body.concern || "").trim(),
      createdAt: new Date().toISOString()
    };

    db.appointments.push(appointment);
    await writeDb(db);
    return sendJson(res, 201, appointment);
  }

  if (req.method === "GET" && pathname === "/api/profile") {
    return sendJson(res, 200, db.profile);
  }

  if (req.method === "PUT" && pathname === "/api/profile") {
    const body = await readBody(req);
    db.profile = {
      name: String(body.name || db.profile.name || "").trim(),
      goal: String(body.goal || db.profile.goal || "").trim(),
      preferredCheckIn: String(body.preferredCheckIn || db.profile.preferredCheckIn || "").trim(),
      notifications: Boolean(body.notifications),
      privacyMode: Boolean(body.privacyMode)
    };

    await writeDb(db);
    return sendJson(res, 200, db.profile);
  }

  return sendError(res, 404, "API route not found");
}

async function serveStatic(req, res, pathname) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const normalizedPath = path.normalize(decodeURIComponent(requestedPath)).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, normalizedPath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendError(res, 403, "Forbidden");
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream"
    });
    res.end(file);
  } catch {
    const notFound = await fs.readFile(path.join(PUBLIC_DIR, "404.html"));
    res.writeHead(404, { "Content-Type": MIME_TYPES[".html"] });
    res.end(notFound);
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url.pathname);
      return;
    }

    await serveStatic(req, res, url.pathname);
  } catch (error) {
    sendError(res, error.statusCode || 500, error.message || "Something went wrong");
  }
});

server.listen(PORT, () => {
  console.log(`Soul Sync is running at http://localhost:${PORT}`);
});
