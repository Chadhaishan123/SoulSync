# SoulSync — Prioritized Feature Roadmap

> Based on a full audit of the existing codebase (backend, frontend, ML pipeline, blueprint).
> Features ranked by **impact** (user value, demo appeal, learning depth) vs **effort** (implementation complexity).
> Icons: 🔴 = security/critical, 🟡 = gap-closing (blueprint promises but code doesn't deliver), 🟢 = net-new standout.

---

## TIER 1 — Ship These First (Critical Gaps + High Impact, Low Effort)

These are features your blueprint explicitly promises but your code doesn't implement yet. Shipping them closes credibility gaps and hardens security.

### 1. 🔴 Fix Hardcoded Secrets & Add Environment Config
- **What:** `config.py` defaults to `super_secret_soulsync_key_for_jwt_tokens_change_in_production` as the JWT secret. Every frontend page hardcodes `http://localhost:8000` as the API base URL.
- **Why:** Any deployment leaks JWT signing keys. Any non-localhost deployment breaks.
- **Effort:** ~1 hour.
- **Action:** Create `.env.example` at project root. Use `NEXT_PUBLIC_API_URL` for frontend. Ensure `SECRET_KEY` has no default in production (fail loudly).

### 2. 🟡 Forgot Password / Password Reset Flow
- **What:** Your blueprint's directory structure lists `forgot-password` under `(auth)/` but the page doesn't exist.
- **Why:** No password reset = users get locked out permanently. Essential for any real product.
- **Effort:** ~4-6 hours (backend token generation + email integration or simple reset token page).
- **Approach without paid email:** Generate a time-limited reset token, display it on screen for demo/testing. For production, integrate a free email service (Brevo free tier, Resend free tier, or SMTP via Gmail app password).

### 3. 🟡 Data Export & Account Deletion (GDPR/CCPA)
- **What:** Your blueprint explicitly states users can "inspect, export, or permanently delete" their data. No endpoints or UI exist for this.
- **Why:** Legal compliance for a real product. Also a strong trust signal for users.
- **Effort:** ~3-4 hours.
- **Action:** Add `GET /api/auth/me/export` (returns all user data as JSON), `DELETE /api/auth/me` (cascading delete). Add a "Download My Data" and "Delete Account" button in Settings.

### 4. 🔴 Rate Limiting (Redis is configured but unused)
- **What:** `REDIS_URL` is in your config, Redis is in `docker-compose.yml`, but no rate limiting middleware exists anywhere.
- **Why:** Without it, your auth endpoints are vulnerable to brute-force attacks. Your companion chat could be spammed.
- **Effort:** ~2 hours.
- **Action:** Add `slowapi` or FastAPI's built-in rate limiting. Apply 5/min to login, 10/min to register, 30/min to chat.

### 5. 🟡 User Profile Edit Page (Name, Email, Password Change)
- **What:** Settings page only lets you change goals and consent toggles. There's no way to update your name, email, or password.
- **Why:** Basic account management. Users expect this.
- **Effort:** ~2 hours.

### 6. 🟡 Refresh Token System
- **What:** Your login returns a JWT with 7-day expiry but there's no refresh mechanism. When the token expires, the user is silently logged out with no warning.
- **Why:** Poor UX. Users lose their session without explanation.
- **Effort:** ~3 hours. Add a refresh token table, rotate on each request, implement an axios interceptor that refreshes proactively.

---

## TIER 2 — High-Impact UX Features (Strong Demo Value, Moderate Effort)

These features make SoulSync feel like a real, polished product and will stand out in demos or user testing.

### 7. 🟢 Streak Tracking & Gamification
- **What:** Track consecutive days of check-ins, journal entries, and sleep logging. Show a streak counter on the dashboard.
- **Why:** The #1 retention mechanic in wellness apps. Gives users a reason to come back daily. Visually impressive on the dashboard.
- **Effort:** ~4 hours (backend streak calculation + frontend badge/counter component).
- **Add-ons:** Weekly badge ("7-Day Streak!"), consistency score on dashboard, monthly recap card.

### 8. 🟢 Mood Calendar Heatmap
- **What:** A GitHub-contribution-style heatmap showing mood scores across months. Each day is a colored cell (red=low mood, green=high mood).
- **Why:** Instantly visualizes long-term patterns. One of the most visually distinctive features in wellness apps. High demo appeal.
- **Effort:** ~3-4 hours. Use Recharts or build a custom grid with Tailwind.

### 9. 🟢 Quick Mood Log (1-Tap Check-In)
- **What:** A simplified check-in: tap an emoji (or slider) to log mood in 5 seconds, without filling out all 4 fields.
- **Why:** The full check-in form is 4 sliders + emotion + tags. That's high friction for daily use. A quick-log captures the data point even when users are busy.
- **Effort:** ~2 hours.
- **Action:** Add a floating action button on the dashboard. One tap logs mood=5, stress=5, energy=5, sleep_quality=5 with a "Quick Check-in" tag. Users can edit details later.

### 10. 🟢 Weekly Wellness Report
- **What:** Auto-generated weekly summary: average mood/stress/energy, sleep consistency, journal sentiment trend, top themes, streak info. Delivered every Sunday or viewable on demand.
- **Why:** Transforms raw data into actionable insight. The core value proposition of SoulSync.
- **Effort:** ~5 hours.
- **Approach:** Backend endpoint `/api/insights/weekly-report` that aggregates the last 7 days. Frontend renders a beautiful summary card. Optionally save as a "report" that users can revisit.

### 11. 🟢 Search & Filter Across All Entries
- **What:** Search journal text, filter check-ins by date range/emotion/score ranges, filter sleep by quality.
- **Why:** As data accumulates, users need to find specific entries. Currently there's no way to look back at "that week I was really stressed."
- **Effort:** ~4 hours (backend query params + frontend filter UI).

### 12. 🟡 Habit Tracker (Frontend for Existing Model)
- **What:** The `Activity` and `ActivityCompletion` models exist in your database but there's no dedicated habit tracking UI. Only recommendations are shown.
- **Why:** Habit tracking is a core wellness feature. The data model is already built.
- **Effort:** ~4 hours.
- **Action:** Add a `/dashboard/habits` page with a calendar grid (like a GitHub contribution map for each habit), daily checkboxes, and completion stats.

---

## TIER 3 — Standout Differentiators (Medium Effort, High Wow Factor)

These features set SoulSync apart from generic wellness trackers and showcase your ML/AI capabilities.

### 13. 🟢 Wellness Score (Composite Index)
- **What:** A single 0-100 "SoulSync Score" computed from weighted combinations of mood, stress, energy, sleep, journal sentiment, and streak consistency.
- **Why:** Gives users a single number to track. Extremely satisfying to watch improve. Great for the dashboard hero card.
- **Effort:** ~3 hours.

### 14. 🟢 Correlation Explorer (Interactive Charts)
- **What:** Interactive scatter plots and line charts letting users explore correlations: Sleep vs Mood, Stress vs Energy, Weather vs Mood, Day-of-week patterns.
- **Why:** This is your ML pipeline's crown jewel. Currently the insights page exists but could be much richer.
- **Effort:** ~5-6 hours. Use Recharts with tooltips, filters, and trend lines.
- **Charts to add:**
  - Sleep duration vs next-day mood (scatter)
  - Stress level over time (area chart)
  - Mood by day of week (bar chart)
  - Sentiment trend from journal entries (line)
  - Weather impact on mood (if location enabled)

### 15. 🟢 Guided Breathing / Micro-Exercise Widget
- **What:** An embedded breathing exercise tool (box breathing, 4-7-8 technique) with an animated visual guide. Triggered from recommendations or directly accessible.
- **Why:** Concrete, actionable wellness intervention. Great for demos. Users can do it right in the app.
- **Effort:** ~3 hours. Use CSS animations or Framer Motion for the breathing circle.

### 16. 🟢 Gratitude Journaling Mode
- **What:** A dedicated journal mode where users list 3 things they're grateful for each day. Auto-tagged and analyzed for positive sentiment trends.
- **Why:** Gratitude journaling is evidence-based for improving wellbeing. Gives journaling a specific, low-barrier structure.
- **Effort:** ~3 hours.

### 17. 🟢 Enhanced AI Companion (Conversational Context)
- **What:** The current companion uses keyword matching. Upgrade it to maintain conversation history and reference the user's actual data patterns in responses.
- **Why:** The current companion feels robotic ("Thank you for sharing that..." for every input). A context-aware companion would be a major differentiator.
- **Effort:** ~6-8 hours.
- **Approach without paid LLM APIs:**
  - Option A: Build a richer rule engine that queries actual user data (recent mood trends, sleep patterns, journal themes) and weaves them into templated responses.
  - Option B: Use a free local LLM (Ollama with a small model) or Hugging Face's free inference API for the conversational layer.

### 18. 🟢 Onboarding Wizard (Guided First Experience)
- **What:** The current onboarding page is just profile setup. Add a 3-step guided experience: (1) First check-in walkthrough, (2) Optional journal entry, (3) View your first insights.
- **Why:** First-time users don't know what to do. A guided flow reduces drop-off and immediately demonstrates value.
- **Effort:** ~3 hours.

---

## TIER 4 — Polish & Production Readiness (Essential for Real Users)

### 19. 🔴 Error Boundaries & Toast Notifications
- **What:** Currently, API failures silently console.error. Add React error boundaries, toast notifications for actions (check-in saved, settings updated), and user-facing error messages.
- **Effort:** ~3 hours. Use `react-hot-toast` or `sonner`.

### 20. 🟡 Dark Mode
- **What:** Tailwind already supports dark mode. Add a toggle in Settings.
- **Effort:** ~2 hours.

### 21. 🟢 Loading Skeletons (Instead of Plain Text)
- **What:** Replace "Synchronizing with your data..." with shimmer skeleton cards that match the actual layout.
- **Effort:** ~2 hours.

### 22. 🔴 Mobile Responsive Sidebar
- **What:** The dashboard sidebar needs a hamburger menu on mobile. Currently it may overlap or be unusable on small screens.
- **Effort:** ~2 hours.

### 23. 🟡 Accessibility (ARIA Labels, Keyboard Navigation, Focus States)
- **What:** Ensure all interactive elements are keyboard-navigable, have proper ARIA labels, and pass basic Lighthouse accessibility audit.
- **Effort:** ~3-4 hours.

### 24. 🔴 Input Validation & Sanitization
- **What:** Add password strength validation on register, input length limits on journal/check-in, and basic XSS sanitization.
- **Effort:** ~2 hours.

---

## TIER 5 — Advanced / Phase 2 (Higher Effort, Future Value)

### 25. 🟢 Medication / Substance Tracker
- Track caffeine, alcohol, medication intake and correlate with sleep/mood. New model + simple UI.

### 26. 🟢 Sleep Hygiene Tips (Context-Aware)
- Based on the user's actual sleep data, suggest specific improvements ("Your average bedtime shifted 1.5 hours later this week").

### 27. 🟢 Data Import from Wearables
- Import CSV/JSON from Apple Health, Google Fit, Fitbit. Parse and merge with existing data.

### 28. 🟢 Push Notifications / Reminders
- Daily check-in reminders, sleep time alerts, streak maintenance nudges. Use browser notification API (free, no paid service needed).

### 29. 🟢 Monthly Wellness Recap (PDF Export)
- Generate a beautiful PDF report of the month's data, charts, and insights. Use `html2pdf.js` or a backend PDF generator.

### 30. 🟢 Optional Social Features
- Share anonymized wellness milestones ("I maintained a 14-day streak!"). Community challenges ("30-Day Mindfulness Challenge").

---

## Recommended Build Order

Here's the suggested sequence for maximum learning + product quality:

| Phase | Features | Est. Time | What You Learn |
|:------|:---------|:----------|:---------------|
| **Week 1: Harden** | #1, #4, #19, #24 | ~8 hrs | Security, env config, error handling |
| **Week 2: Complete** | #2, #3, #5, #6 | ~14 hrs | Auth flows, GDPR, token management |
| **Week 3: Engage** | #7, #8, #9, #18 | ~12 hrs | Gamification, visualizations, UX |
| **Week 4: Insights** | #10, #11, #13, #14 | ~18 hrs | Data aggregation, charts, analytics |
| **Week 5: Differentiate** | #12, #15, #16, #17 | ~16 hrs | AI companion upgrade, wellness tools |
| **Week 6: Polish** | #20, #21, #22, #23 | ~9 hrs | Dark mode, accessibility, mobile UX |

---

## Quick Wins (Do These Today, < 30 min each)

1. Create a `.env.example` file with all required environment variables
2. Replace hardcoded `http://localhost:8000` with `process.env.NEXT_PUBLIC_API_URL` everywhere
3. Add a `requirements.txt` entry for `slowapi` (rate limiting)
4. Add a `next.config.js` env variable for the API URL
5. Add a basic error boundary component wrapping the dashboard layout
