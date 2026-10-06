# SoulSync — Real-Time Data & Live API Integration Guide (localhost deployment)

> Your requirement: **every feature uses live, real-time values wherever applicable**, running on **localhost**, with real API keys where a key is needed. This is the honest, complete guide — including which sources need keys, which are keyless, and which genuinely *cannot* run on localhost without extra accounts/devices.

---

## 1. The honest reality check (read this first)

Real-time data splits into three buckets. Be clear-eyed about which is which:

**✅ Bucket A — Works on localhost today, keyless, free.** These need **no API key** and run directly in your browser/backend. You can wire these up immediately (most are already partly in your project).

**🔑 Bucket B — Needs a free API key.** These need you to register and paste a key. Still localhost-friendly. Worth it for the data they add.

**📲 Bucket C — Needs OAuth + the user's own accounts/devices.** Wearable/heart-rate/activity platforms (Google Fit, Fitbit, Apple Health, Spotify). These are the *physiologically* rich real-time streams, but they can't produce real data unless real users connect real devices, and OAuth setup on localhost is more involved. Treat these as Phase 2 — and don't pretend a check-in slider is a heart rate.

The guiding rule: **only show real-time values where the data genuinely exists in real time.** Don't fabricate a "live" number just to say it's live.

---

## 2. Bucket A — Keyless, free, use now (localhost-ready)

| # | Real-time source | Needs key? | Localhost? | What it feeds |
|:--|:-----------------|:-----------|:-----------|:--------------|
| A1 | **Browser Geolocation API** (`navigator.geolocation`) | ❌ No | ✅ Yes | Pulls the user's real lat/lon in the browser (with consent) → sent to backend for weather/AQI + sunrise/sunset |
| A2 | **Open-Meteo Weather** | ❌ No | ✅ Yes | Live temperature, apparent temp, humidity, cloud cover, precipitation — already in your `moods.py` |
| A3 | **Open-Meteo Air Quality** | ❌ No | ✅ Yes | Live PM2.5, PM10, US/EU AQI — already in your `moods.py` |
| A4 | **Open-Meteo Daily: sunrise, sunset, UV, daylight hours** | ❌ No | ✅ Yes | **New:** circadian/sleep insight ("sunset today is 18:42 — earlier than your usual bedtime"), UV for outdoor activity recs |
| A5 | **Local date/time (client clock + timezone)** | ❌ No | ✅ Yes | Real-time greeting (Good Morning/Evening), precise check-in timestamp, day-of-week trend detection |
| A6 | **Web Speech API (SpeechRecognition)** | ❌ No | ✅ Yes | **New:** real-time voice dictation for the AI Journal — user speaks, text appears live. Built into Chrome/Edge. |
| A7 | **Notifications API** (`new Notification(...)`) | ❌ No | ✅ Yes | **New:** real-time check-in reminders, streak nudges, sleep-time alerts (browser-native, no push service needed) |
| A8 | **Nager.Date public holidays** (`date.nager.at`) | ❌ No | ✅ Yes | **New:** is-today-a-holiday + upcoming holidays → correlate mood/stress on workdays vs holidays |

**This bucket alone makes the whole app run live:** every page pull is real, current data — real weather at check-in, real clock, real calendar context, real speech, real notifications.

---

## 3. Bucket B — Free API keys to register (add value beyond the keyless set)

Register these, drop the key into your backend `.env`, and they enrich real-time data further. **Keys must live server-side only** (see §5).

| # | Service | Key needed? | Free tier | Localhost? | What it adds |
|:--|:--------|:------------|:----------|:-----------|:-------------|
| B1 | **OpenWeatherMap** | 🔑 Yes | ~1,000 calls/day | ✅ Yes | Alternative/richer current weather + 5-day forecast, configurable location units |
| B2 | **Tomorrow.io** | 🔑 Yes | ~500 calls/day | ✅ Yes | Real-time weather **+ air quality + pollen/grass allergens** (nice for physical-wellbeing correlation) |
| B3 | **OpenCage Geocoder** | 🔑 Yes | 2,500 calls/day | ✅ Yes | Reverse-geocode lat/lon → city/place name for a "how's the weather where you are, **in Bengaluru**" touch |
| B4 | **WeatherAPI.com** | 🔑 Yes | 1M calls/month | ✅ Yes | Weather + **astronomy** (sunrise/sunset/moon phase) in one call — good sleep-context upgrades |

> **Keyless-first recommendation:** Open-Meteo already covers weather + AQI with no key and no rate anxiety. Add **B2 (Tomorrow.io) for pollen** and **B3 (OpenCage) for location naming** as the highest-value paid-key additions. B1/B4 are optional alternatives, not required.

---

## 4. Bucket C — Real physiological real-time (OAuth; Phase 2)

These are the truly *biometric* real-time streams. They require **real user accounts + devices**, and OAuth setup on localhost is more work (redirect URIs, client secrets). List them honestly:

| # | Platform | What it streams | Reality check |
|:--|:---------|:----------------|:--------------|
| C1 | **Google Fit** | Steps, activity, heart rate, sleep via sensors | Free, but needs OAuth client + user's Google account + Wearable/phone sensors. OAuth works on localhost but must be configured. |
| C2 | **Fitbit Web API** | Sleep stages, heart-rate variability, activity | Needs a Fitbit device + app registration (consumer API approval process). Heavier. |
| C3 | **Apple HealthKit** | Health/sleep/exercise | iOS only; requires a native bridge — not feasible in a browser SPA. Skip unless you go native. |
| C4 | **Spotify** | For "mood music" suggestions | OAuth; pairs songs to emotional state. Nice differentiator, moderate effort. |

**Recommendation: keep Bucket C out of the core MVP.** Build the app on Bucket A + B so everything is genuinely live and self-contained on localhost. Revisit C1/C2 later if you want true biometric correlation — they'll slot cleanly into the existing `MoodEntry`/`SleepRecord` models (just add a `source` field).

---

## 5. Architecture for keys + localhost (do this right)

**Rule 1 — Keys never go in the frontend.** The browser is public; anything compiled into it is exposed. The backend holds all keys and proxies third-party calls.

```
Browser (frontend :3000)
   │  JWT + user lat/lon
   ▼
FastAPI backend (:8000)  ←── .env holds ALL third-party keys
   │  server-side calls
   ▼
Open-Meteo / Tomorrow.io / OpenCage / Nager.Date (external APIs)
```

**Rule 2 — Add endpoints that proxy live data lazily (only when a request comes in), so nothing is cached-stale:**
- `GET /api/env/now` → geolocation + live weather + AQI + sunrise/sunset + UV + optional pollen (aggregates on request).
- `GET /api/calendar/today` → is-today-a-holiday + day-of-week + local greeting context.
- `POST /api/speech/transcribe` → Web Speech runs **client-side** in the browser (no key, no backend); send result to journal NLP as usual.

**Rule 3 — `.env.example` (commit-safe template):**
```ini
# --- Backend secrets ---
SECRET_KEY=CHANGE_ME_random_long_string
# --- Real-time API keys (Bucket B) ---
# Leave blank to fall back to keyless sources (Open-Meteo)
OPENWEATHERMAP_API_KEY=
TOMORROW_IO_API_KEY=
OPENCAGE_API_KEY=
WEATHERAPI_KEY=
# --- Frontend ---
NEXT_PUBLIC_API_URL=http://localhost:8000
# --- Timers / defaults ---
GEO_CONSENT_DEFAULT=false
```

**Rule 4 — CORS for localhost:** the backend must allow the frontend origin. Set CORS allowlist to `http://localhost:3000` (and `http://127.0.0.1:3000`) so live fetches succeed. *(Check `main.py`/`cors` setup — if absent, add FastAPI `CORSMiddleware`.)*

**Rule 5 — Consent-gated geolocation:** only call the browser Geolocation API after the user grants it (your Settings page already models `location_enabled`). If denied, fetch weather with a city default or skip location-based fields — never fail the whole check-in.

---

## 6. Mapping real-time sources → each feature

| Feature | Real-time source(s) used |
|:--------|:-------------------------|
| **Daily Check-In** | A1 (geo) + A2 (weather) + A3 (AQI) + A4 (sunrise) at submit; A5 (timestamp/time-of-day) |
| **AI Journal** | A6 (voice dictation, browser) + live NLP (emotion/sentiment) each save |
| **Sleep Tracker** | A4 (sunrise/sunset for circadian context) + B2/B4 (pollen, moon phase) + live correlation on history |
| **Insights & Forecast** | All computed live from real history each load; A8 (holiday correlation); B1/B2 (forecast/pollen) |
| **Digital Twin** | Live refit on the user's real rows (§ from the AI/ML spec) |
| **Dashboard Overview** | A2–A5 live: today's real weather, real clock/time-of-day greeting, live trend/anomaly |
| **Recommendations** | Live ranking fed by current env (UV→"outdoor walk", pollen→"stay-in breathing", holiday→"rest") |
| **AI Companion** | Live trend summary + A5 time context + real journal themes |
| **Notifications** | A7 (browser notifications) — daily reminders, streak nudges, sleep alerts |
| **Settings/Privacy** | Live consent toggles controlling A1/A2/A3 access |

---

## 7. Recommended implementation order

1. **Fix CORS** + move the hardcoded `http://localhost:8000` out of the frontend into `NEXT_PUBLIC_API_URL`. *(30 min — unblocks all live calls)*
2. **Add `.env.example`** + backend config loading with graceful fallbacks (keyless first). *(1 hr)*
3. **Build `GET /api/env/now`** aggregator — weather + AQI + sunrise/sunset/UV live. *(2–3 hrs)*
4. **Wire geolocation** (consent-gated) from the browser into check-in. *(2 hrs)*
5. **Add live local-time greeting + day-of-week context** to the dashboard. *(1 hr)*
6. **Add Nager.Date holiday feed** to Insights (workday vs holiday mood). *(2 hrs)*
7. **Add browser Notifications** for reminders/streaks. *(1 hr)*
8. **Add OpenCage reverse-geocoding** (key) for city-labeled weather. *(1–2 hrs)*
9. **Add Tomorrow.io pollen** (key) into env snapshot + recommend logic. *(2 hrs)*
10. **Add Web Speech voice dictation** to the journal editor. *(2–3 hrs)*
11. *(Phase 2)* Google Fit / Fitbit / Spotify OAuth for biometric streams.

Everything in steps 1–10 is free, keyless-or-free-key, and runs fully on localhost. That's how SoulSync becomes genuinely "live everywhere."

---

### Sources
- [Open-Meteo (forecast + air quality + daily/solar)](https://open-meteo.com/en/docs) — keyless weather/AQI/sunrise/sunset/UV
- [OpenWeatherMap](https://openweathermap.org/api) — free keyed current-weather tier
- [Tomorrow.io](https://www.tomorrow.io/weather-api/) — free keyed real-time weather/air/pollen
- [OpenCage Geocoder](https://opencagedata.com/) — free keyed reverse geocoding
- [WeatherAPI.com](https://www.weatherapi.com/) — free keyed weather/astronomy
- [Nager.Date public holidays](https://date.nager.at/) — keyless holidays API · [GitHub](https://github.com/nager/Nager.Date)
- [MDN: Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API) · [MDN: Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) · [MDN: Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)
