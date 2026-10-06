# SoulSync — Real-Time Data, Real Datasets, and the Complete AI/ML Feature Specification

> This document does three things:
> 1. Explains **exactly how SoulSync runs on real, live data** (and where it currently does NOT — plus how to fix it).
> 2. Lists **every AI/ML technique** used, and **every real dataset** that genuinely exists behind them (with sources).
> 3. Specifies **every feature** in the project in detail.

---

## SECTION 1 — First, the honest truth about "real-time data" and "synthetic data"

Your concern is well-founded. Let me be direct about what the code does today:

**❌ The current problem:** `ml/generate_synthetic.py` fabricates fake daily check-ins, and `ml/train_models.py` trains three models (trend RandomForest, KMeans clustering, Isolation Forest anomaly) on that **fabricated** CSV. The runtime service (`ml_service.py`) **loads those synthetic-trained weights**. So today, the trend/clustering predictions are influenced by made-up data. This is exactly what you want removed.

**✅ The correct architecture (and the fix):** A personalized wellness app like SoulSync should be a **layered** system. There are three clean data classes, and only one of them uses pre-trained public models:

| Layer | What it is | Source | Is it "real"? |
|:------|:-----------|:-------|:--------------|
| **A. Pre-trained base models** | Emotion classifier, sentiment model — trained **once** offline on real public datasets, then run live on each new piece of user text | GoEmotions, SST-2, dair-ai/emotion (all real, see §3) | ✅ Trained on real data |
| **B. Live user data** | The user's own check-ins, sleep logs, journal entries — stored in PostgreSQL *as the user logs them* | The user, in real time | ✅ 100% real-time, real data |
| **C. Live third-party APIs** | Weather, AQI at check-in time | Open-Meteo (live, real) | ✅ Real-time |

**The key insight:** clustering, anomaly detection, and trend prediction are *personalized* — a "normal" weekday for you is different from someone else's. So they should **never** be trained on synthetic or generic data. Instead they should be **computed on-the-fly from that one user's own accumulated real logs**. Your anomaly detector already does this correctly (it re-fits Isolation Forest on the live user's history at request time — `ml_service.py`). The fix is to give **KMeans and the trend model the same treatment**: compute them live from real user data instead of loading the synthetic-trained files.

**Recommended fix (concrete):**
1. Revise `ml_service.py` so KMeans and trend prediction **fit at request time on the live user's real rows** (exactly like anomaly detection already does). No joblib weights needed for personalized models.
2. Keep pre-trained weights **only** for the emotion/sentiment NLP, which was trained on real public datasets.
3. Delete `generate_synthetic.py` from the serving path entirely, or keep it **only** as an opt-in local "demo seed" script clearly labeled `DEV ONLY — never used in production`.
4. Enforce **honest minimum-data thresholds** (your code already returns "not enough check-ins" under 3 — extend this consistently) so nothing shows a confident result from too little real data.

The result: **every insight you see is computed from real, live, user-supplied data**, using models whose *base knowledge* comes from real public datasets. Nothing fabricated.

---

## SECTION 2 — AI/ML Techniques Used

Here is the full technique inventory, what each does, and how it runs in real time.

### 1. Emotion Classification — Transfer Learning with DistilBERT
- **Technique:** A transformer language model (DistilBERT, a distilled/smaller BERT) fine-tuned for emotion recognition. **Transfer learning**: start from a model pre-trained on billions of words, fine-tune on a small labeled emotion set.
- **Input:** journal text, live as the user writes/saves.
- **Output:** probability scores across 6 emotions → mapped to your (Happy, Sad, Anxious, Angry, Calm, Neutral) set.
- **Real-time:** runs on **each new journal entry** at save time (in `ai_service.py`). The fallback keyword lexicons keep it working offline.
- **Why it's appropriate:** emotion detection in free text is a well-solved language task; a fine-tuned small transformer is fast enough for real-time on modest hardware.

### 2. Sentiment Analysis — Sequence Classification / Lexicon Scoring
- **Technique:** A DistilBERT sequence classifier (fine-tuned on SST-2) that outputs positive/negative probability, converted to a continuous `-1.0 → +1.0` score; plus a dictionary (VADER-style) fallback.
- **Input:** journal text.
- **Output:** continuous sentiment score stored with each journal's analysis.
- **Real-time:** computed for every new entry; also feeds the trend and digest features.

### 3. Behavioral Clustering — K-Means (unsupervised)
- **Technique:** Unsupervised clustering over each user's own (mood, stress, energy, sleep) vectors. Groups the user's **own** days into recurring behavioral states (Balanced, High-Stress, Low-Energy, Recovery).
- **Real-time:** **must be re-fit on the user's live history at request time** (the fix in §1). New check-ins shift the cluster assignment immediately.
- **Purpose:** powers the **Digital Twin** — an evolving map of the user's behavioral states.

### 4. Anomaly Detection — Isolation Forest (unsupervised)
- **Technique:** Isolation Forest isolates outliers by randomly splitting features; points that isolate quickly are anomalies. Compares the newest log to the user's own baseline distribution.
- **Real-time:** already re-fits live on the user's history per request (`ml_service.py`). Flags "this day is unusually different for *you*."
- **Purpose:** gentle check-in prompts when a logged day strongly deviates.

### 5. Trend Prediction — Random Forest Classification + Rolling-Window Features
- **Technique:** A Random Forest classifier over **engineered features** — 3-day and 7-day rolling means and slopes of mood and stress. Predicts next-day class: Improving / Stable / Declining.
- **Real-time:** feature engineering runs live on recent real entries; prediction produced per dashboard load. (Apply same live-fit fix.)
- **Purpose:** short-term wellness forecast; also feeds the companion and the "emotional forecast" feature idea.

### 6. Correlation Analysis — Pearson correlation
- **Technique:** Computes the Pearson correlation coefficient between paired time series from the user's own data (sleep-duration vs. next-day mood, energy vs. sleep quality, mood vs. stress).
- **Real-time:** computed live from history each time the Insights page loads.
- **Purpose:** the "Observed Patterns" cards and Sleep-vs-Mood chart.

### 7. Theme / Keyword Extraction — Rule-based NLP
- **Technique:** Lookup-based extraction of topical themes (Workload, Deadlines, Family, Sleep, Health, Hobbies) via keyword lexicons; also detects crisis/danger keywords for safety escalation.
- **Real-time:** runs on each journal at save time (`ai_service.py`).
- **Purpose:** journal tags, digests, and the safety guard.

### 8. Future / Lighter ML (in the feature backlog)
- **Reframe classification** (cognitive-distortion tagging via keywords/rules, no LLM).
- **Energy-curve detection** (smooth/aggregate energy by time-of-day to find peaks/slumps).
- **Mood-forecast bands** (extend the Random Forest with day-of-week features).

---

## SECTION 3 — The Real Datasets (they genuinely exist; sources included)

> These are real, well-known, publicly available datasets. **None of them are injected into the live user database.** They are used to *pre-train base models* (Layer A) or as *offline reference/research* for feature engineering (Layer A/research). The live product runs on the user's own real-time data (Layer B).

| Dataset | What it is | Size | Real dataset? | Used for | Where to get it |
|:--------|:-----------|:-----|:--------------|:---------|:----------------|
| **GoEmotions** (Google Research) | Reddit comments labeled with 27 fine-grained emotions + neutral; multi-label, 3 annotators each | ~58k examples | ✅ Yes | Fine-tune the emotion classifier for richer granularity; emotion taxonomy design | [go_emotions on Hugging Face](https://huggingface.co/datasets/google-research-datasets/go_emotions) · [Google GitHub](https://github.com/google-research/google-research/tree/master/goemotions) |
| **SST-2** (Stanford Sentiment Treebank) | Movie-review sentences labeled binary positive/negative | ~67k train + 1.8k test | ✅ Yes | Pre-train the sentiment analyzer | [GLUE benchmark](https://huggingface.co/datasets/glue) (sst2) |
| **dair-ai/emotion** | Twitter messages labeled with 6 emotions (joy, sadness, anger, fear, disgust, surprise) | ~20k | ✅ Yes | The 6-class emotion model; maps cleanly to your HK-set | [dair-ai/emotion on Hugging Face](https://huggingface.co/datasets/dair-ai/emotion) |
| **StudentLife** (Dartmouth) | 10 weeks of EMA + phone-sensor data from college students | 49 students, continuous | ✅ Yes | Offline research only — designing feature schemas, validating clustering boundaries | [StudentLife project](https://studentlife.cs.dartmouth.edu/) |
| **WESAD** (Stress & Affect, UCI) | Multi-sensor wearable physiological signals (wrist/chest) during stress/affect tasks | 15 subjects | ✅ Yes | Optional offline research for future wearables integration | [UCI repository](https://archive.ics.uci.edu/dataset/465/wesad+wearable+stress+and+affect+detection) |
| **Sleep Health and Lifestyle** (public) | Survey rows of sleep duration, quality, physical activity, stress, BMI + mental health factors | ~374 rows | ✅ Yes | Offline exploration of sleep ↔ wellbeing relationships to guide feature choices | [Kaggle: Sleep Health and Lifestyle](https://www.kaggle.com/datasets/uom190346a/sleep-health-and-lifestyle-dataset) |
| **SWMH** (Suicide & Wellbeing Mental Health) | Real Reddit posts from r/SuicideWatch, r/depression, etc., used in mental-health NLP research | thousands of posts | ✅ Yes | *Optional* offline research on crisis/safety language patterns for the safety escalation feature | via research replicability data (see note below) |

**Honest notes on the above:**
- **GoEmotions is the strongest "real-data" story** for your emotion model. Replacing/augmenting the current `distilbert emotion` checkpoint with a model fine-tuned on GoEmotions (or dair-ai/emotion, which is the canonical 6-class set) gives you a **documented, genuinely-existing** training set. The current `bhadresh-savani/distilbert-base-uncased-emotion` is a popular public checkpoint; for full transparency you may want to retrain on a dataset you can cite.
- **StudentLife and WESAD are research/reference only** — they never touch live user data. They inform your *feature engineering*, which matches your blueprint's "Tier A" design.
- **SWMH is optional and sensitive.** Use it only for designing crisis *keyword/safety* heuristics (never to classify real people into diagnostic buckets). If you include it, handle it carefully and keep it relegated to the offline research tier. This is responsible-AI territory: your platform must not label users, only flag risk language and route to help resources.
- **Privacy guarantee to restate:** Layer A datasets are static snapshots for turning models; they contain **no SoulSync user data**, and user data is never mixed into them (per your blueprint's "no global mixing" rule).

---

## SECTION 4 — How Real-Time Data Flows End-to-End (per data type)

**Journal entry (NLP, real-time):**
```
User types/saves journal → POST /api/journals (fastapi)
  → local NLP: emotion (DistilBERT), sentiment (SST-2), theme extraction, crisis check
  → JournalAnalysis row saved → returned to UI with live sentiment/emotion
```

**Daily check-in (env context + anomaly, real-time):**
```
User submits sliders → POST /api/moods
  → if consent granted: fetch live weather + AQI from Open-Meteo (lat/lon)
  → save MoodEntry + EnvironmentSnapshot
  → IsolationForest compares this entry to the user's past → anomaly flag
  → Digital-Twin cluster assignment updates (live refit)
```

**Sleep log (correlation, real-time):**
```
User logs bedtime/wake → POST /api/sleep
  → saved → summary (3/7/30-day consistency) computed live
  → Insights page recomputes sleep-vs-mood Pearson correlation live from history
```

**Dashboard / Insights / Twin / Companion (aggregation, real-time):**
```
GET /api/insights/dashboard → aggregates: latest env, live cluster, live trend, live anomaly
GET /api/insights/patterns     → live correlations + detected patterns
GET /api/recommendations       → ranked from live state + goals
POST /api/companion/chat       → reply generated from live trend summary + message
```
Every number on screen is recomputed from the user's real, current data at the moment the page loads.

---

## SECTION 5 — Every Feature in the Project (full specification)

### Core Features (in the codebase today)

**1. Authentication & Profile**
- Register, login (JWT), profile (name, email, goals, timezone).
- **AI/ML:** none (bcrypt hashing + JWT).
- **Real-time:** token issued at login; profile read/write live.
- **Backlog:** forgot-password, change email/password, refresh tokens, data export/delete, rate limiting. *(Sec/polish milestones — see `feature_roadmap.md`.)*

**2. Daily Check-In (mood, stress, energy, sleep-quality, emotion, tags)**
- **AI/ML:** anomaly detection (Isolation Forest) on submit.
- **Real-time:** live weather/AQI appended if consented; anomaly flag computed on the new entry.
- **Backlog:** quick 1-tap check-in; submission ripple animation; animated slider gradients.

**3. AI Journal with NLP**
- **AI/ML:** emotion classification (DistilBERT), sentiment (SST-2 distilbert), theme extraction, crisis detection, text summary.
- **Real-time:** all computed at save; summary + scores returned to the UI.
- **Backlog:** Reframe assistant (→ positives), live "emotion meter while typing," weekly journal digest cards, gratitude mode.

**4. Sleep Tracker**
- **AI/ML:** none at core (Pearson correlation cross-feature).
- **Real-time:** consistency metrics (3/7/30-day) computed live from history.
- **Backlog:** sleep-hygiene tips generated from the user's actual sleep data; animated resonance/cycle display.

**5. Insights & Forecast (history charts, observed patterns)**
- **AI/ML:** Pearson correlations; trend prediction (Random Forest + rolling features).
- **Real-time:** recomputed live per page load.
- **Backlog:** interactive correlation explorer, mood heatmap calendar, animated chart draw-in, multi-day "emotional forecast" strip.

**6. Digital Twin (K-Means behavioral states)**
- **AI/ML:** K-Means clustering over the user's own vectors (apply live-refit fix in §1).
- **Real-time:** cluster assignment tracks new check-ins.
- **Backlog:** animated "emotional aura" visualization with 30-day playback; animated progress/bar charts.

**7. Wellness Recommendations (activity suggestions + feedback)**
- **AI/ML:** rule-based ranking from live state + goals + feedback history (lightweight).
- **Real-time:** re-ranked per dashboard load.
- **Backlog:** guided breathing widget (animated); recommendations driven by detected correlations (e.g., "you feel better after 30 min of exercise → here's a walk").

**8. AI Companion (chat)**
- **AI/ML:** rule/intent-based reply engine; crisis detection. *(Backlog: richer context-aware responses referencing the user's actual patterns; optional local LLM via Ollama/Hugging Face free inference.)*
- **Real-time:** reply generated from live trend summary + conversation history.

**9. Settings / Privacy / Consent**
- Granular toggles for location, environment snapshots, personalization; goals.
- **Backlog:** data export (GDPR), account deletion, dark mode, notification preferences.

### Differentiator Features (backlog — see `animations_and_new_features.md` for full detail)
- **A. Emotional Forecast** — 3-day mood "weather" strip from the trend predictor.
- **B. Digital-Twin Aura** — animated, evolving gradient visualization of behavioral state.
- **C. Reframe** — cognitive-distortion detection + guided counter-statement.
- **D. Journal Digest** — weekly animated summary cards (themes, emotion arc, "theme of the week").
- **E. Energy Scheduling** — animated 24h energy curve + optimal windows for Deep Work/Exercise/Rest.
- **F. Wellness Time Capsule** — messages to future self delivered at milestones.
- **G. Gratitude Wall** — animated, drifting gratitude entries.
- **H. Live Mood Meter** — emotion indicator that shifts as the user types.
- **I. Community Milestones** — opt-in, anonymous aggregated patterns + challenges.
- **Gamification & engagement:** streak tracking, wellness score (animated progress ring), weekly wellness report, mood heatmap.

### Cross-Cutting Polish (backlog — see `animations_and_new_features.md`)
- Global page transitions, animated numbers/rings, chart draw-in, loading skeletons, animated sidebar indicator, ambient mood background, error boundaries + toasts, mobile responsive sidebar, accessibility (`prefers-reduced-motion` respected).

---

## SECTION 6 — Recommended Actions (to fully satisfy "real data, real time")

1. **Refactor personality models to live computation:** KMeans + trend fit on the live user's real rows at request time (mirror what Isolation Forest already does). Remove synthetic weights from the serving path. *(Top priority for your requirement.)*
2. **Document and swap the NLP base model** to one whose training set is a citable real dataset (GoEmotions and/or dair-ai/emotion + SST-2). Add a `model_version` + dataset citation to each journal analysis for transparency.
3. **Move `generate_synthetic.py` to a clearly-labeled `DEV ONLY` seed script**, or delete it; never load its outputs in production.
4. **Keep strong minimum-data gates** (3 check-ins for trend, ~10 for patterns) so low-data users see honest "not enough real data yet" messages instead of fabricated-looking results.
5. **Add a privacy + dataset provenance page** in Settings: list the exact public datasets used to train base models, reiterate that user data stays isolated and is never mixed into training sets.

---

### Sources
- [GoEmotions — Hugging Face](https://huggingface.co/datasets/google-research-datasets/go_emotions) / [Google Research GitHub](https://github.com/google-research/google-research/tree/master/goemotions)
- [dair-ai/emotion — Hugging Face](https://huggingface.co/datasets/dair-ai/emotion)
- [GLUE / SST-2](https://huggingface.co/datasets/glue)
- [StudentLife (Dartmouth)](https://studentlife.cs.dartmouth.edu/)
- [WESAD — UCI](https://archive.ics.uci.edu/dataset/465/wesad+wearable+stress+and+affect+detection)
- [Sleep Health and Lifestyle — Kaggle](https://www.kaggle.com/datasets/uom190346a/sleep-health-and-lifestyle-dataset)
- SWMH: searchable/obtainable via mental-health NLP replicability channels (see §3 note).
