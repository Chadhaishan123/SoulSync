const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { analyzeDream } = require("./dreamAnalyzer");
const { buildInsights, detectCrisis, matchTherapists } = require("./intelligence");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DB_PATH = path.join(ROOT, "data", "db.json");
const DEMO_USER_ID = "user-demo";

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
  return normalizeDb(JSON.parse(data));
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

function hashPassword(password) {
  return crypto.createHash("sha256").update(String(password)).digest("hex");
}

function normalizeDb(db) {
  db.users = db.users || [
    {
      id: DEMO_USER_ID,
      name: "Ishan",
      email: "demo@soulsync.local",
      passwordHash: hashPassword("demo123"),
      role: "user",
      createdAt: "2026-05-22T00:00:00.000Z"
    }
  ];
  db.sessions = db.sessions || [];
  ["moods", "journal", "dreams", "appointments"].forEach((collection) => {
    db[collection] = (db[collection] || []).map((item) => ({ userId: item.userId || DEMO_USER_ID, ...item }));
  });
  db.profile = { userId: DEMO_USER_ID, ...(db.profile || {}) };
  return db;
}

function getToken(req) {
  const header = req.headers.authorization || req.headers["x-session-token"] || "";
  return String(header).replace(/^Bearer\s+/i, "").trim();
}

function getCurrentUser(req, db) {
  const token = getToken(req);
  const session = token ? db.sessions.find((item) => item.token === token) : null;
  return db.users.find((user) => user.id === session?.userId) || db.users.find((user) => user.id === DEMO_USER_ID);
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };
}

function userRecords(db, user) {
  const byUser = (item) => item.userId === user.id;
  return {
    moods: db.moods.filter(byUser).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    journal: db.journal.filter(byUser).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    dreams: (db.dreams || []).filter(byUser).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    appointments: db.appointments.filter(byUser).sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))
  };
}

function buildDashboard(db, user) {
  const records = userRecords(db, user);
  const sortedMoods = records.moods;
  const latestMood = sortedMoods[0] || null;
  const averageMood = records.moods.length
    ? Math.round(records.moods.reduce((sum, item) => sum + Number(item.intensity || 0), 0) / records.moods.length)
    : 0;

  return {
    user: publicUser(user),
    latestMood,
    averageMood,
    moodCount: records.moods.length,
    journalCount: records.journal.length,
    dreamCount: records.dreams.length,
    appointmentCount: records.appointments.length,
    nextAppointment: records.appointments[0] || null,
    recentJournal: records.journal[0] || null,
    recentDream: records.dreams[0] || null,
    resources: db.resources.slice(0, 3),
    insights: buildInsights(db, records)
  };
}

async function handleApi(req, res, pathname) {
  const db = await readDb();
  const user = getCurrentUser(req, db);

  if (req.method === "GET" && pathname === "/api/auth/me") {
    return sendJson(res, 200, { user: publicUser(user), isDemo: user.id === DEMO_USER_ID });
  }

  if (req.method === "POST" && pathname === "/api/auth/register") {
    const body = await readBody(req);
    const missing = requiredFields(body, ["name", "email", "password"]);
    if (missing.length) return sendError(res, 422, `Missing fields: ${missing.join(", ")}`);
    const email = String(body.email).trim().toLowerCase();
    if (db.users.some((item) => item.email === email)) return sendError(res, 409, "Email is already registered");

    const newUser = {
      id: createId("user"),
      name: String(body.name).trim(),
      email,
      passwordHash: hashPassword(body.password),
      role: "user",
      createdAt: new Date().toISOString()
    };
    const token = createId("session");
    db.users.push(newUser);
    db.sessions.push({ token, userId: newUser.id, createdAt: new Date().toISOString() });
    await writeDb(db);
    return sendJson(res, 201, { token, user: publicUser(newUser) });
  }

  if (req.method === "POST" && pathname === "/api/auth/login") {
    const body = await readBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    const foundUser = db.users.find((item) => item.email === email && item.passwordHash === hashPassword(body.password));
    if (!foundUser) return sendError(res, 401, "Invalid email or password");

    const token = createId("session");
    db.sessions.push({ token, userId: foundUser.id, createdAt: new Date().toISOString() });
    await writeDb(db);
    return sendJson(res, 200, { token, user: publicUser(foundUser) });
  }

  if (req.method === "POST" && pathname === "/api/auth/logout") {
    const token = getToken(req);
    db.sessions = db.sessions.filter((session) => session.token !== token);
    await writeDb(db);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "GET" && pathname === "/api/dashboard") {
    return sendJson(res, 200, buildDashboard(db, user));
  }

  if (req.method === "GET" && pathname === "/api/insights") {
    return sendJson(res, 200, buildInsights(db, userRecords(db, user)));
  }

  if (req.method === "POST" && pathname === "/api/safety-check") {
    const body = await readBody(req);
    return sendJson(res, 200, detectCrisis(body.text));
  }

  if (req.method === "GET" && pathname === "/api/moods") {
    return sendJson(res, 200, userRecords(db, user).moods);
  }

  if (req.method === "POST" && pathname === "/api/moods") {
    const body = await readBody(req);
    const missing = requiredFields(body, ["mood", "intensity"]);
    if (missing.length) return sendError(res, 422, `Missing fields: ${missing.join(", ")}`);

    const entry = {
      id: createId("mood"),
      userId: user.id,
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
    return sendJson(res, 200, userRecords(db, user).journal);
  }

  if (req.method === "POST" && pathname === "/api/journal") {
    const body = await readBody(req);
    const missing = requiredFields(body, ["title", "body"]);
    if (missing.length) return sendError(res, 422, `Missing fields: ${missing.join(", ")}`);

    const entry = {
      id: createId("journal"),
      userId: user.id,
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
    return sendJson(res, 200, userRecords(db, user).dreams);
  }

  if (req.method === "POST" && pathname === "/api/dreams") {
    const body = await readBody(req);
    const missing = requiredFields(body, ["title", "dream"]);
    if (missing.length) return sendError(res, 422, `Missing fields: ${missing.join(", ")}`);

    const analysis = analyzeDream(body.dream);
    const entry = {
      id: createId("dream"),
      userId: user.id,
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

  if (req.method === "POST" && pathname === "/api/therapist-match") {
    const body = await readBody(req);
    return sendJson(res, 200, matchTherapists(db.therapists, body.concern, body.language, body.mode));
  }

  if (req.method === "GET" && pathname === "/api/appointments") {
    return sendJson(res, 200, userRecords(db, user).appointments);
  }

  if (req.method === "POST" && pathname === "/api/appointments") {
    const body = await readBody(req);
    const missing = requiredFields(body, ["name", "email", "therapist", "sessionType", "date", "time"]);
    if (missing.length) return sendError(res, 422, `Missing fields: ${missing.join(", ")}`);

    const appointment = {
      id: createId("appointment"),
      userId: user.id,
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
    const profile = db.profiles?.[user.id] || db.profile || {};
    return sendJson(res, 200, { ...profile, name: profile.name || user.name });
  }

  if (req.method === "PUT" && pathname === "/api/profile") {
    const body = await readBody(req);
    const currentProfile = db.profiles?.[user.id] || db.profile || {};
    db.profiles = db.profiles || {};
    db.profiles[user.id] = {
      userId: user.id,
      name: String(body.name || currentProfile.name || user.name || "").trim(),
      goal: String(body.goal || currentProfile.goal || "").trim(),
      preferredCheckIn: String(body.preferredCheckIn || currentProfile.preferredCheckIn || "").trim(),
      notifications: Boolean(body.notifications),
      privacyMode: Boolean(body.privacyMode)
    };

    await writeDb(db);
    return sendJson(res, 200, db.profiles[user.id]);
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
