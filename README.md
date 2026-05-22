# Soul Sync

Soul Sync is a full-stack mental health and wellness platform with multi-page navigation, mood tracking, journaling, therapist booking, resources, crisis support, profile settings, and an admin view.

## Tech Stack

- Frontend: HTML, CSS, and vanilla JavaScript
- Backend: Node.js built-in HTTP server
- Storage: JSON file persistence in `data/db.json`

No third-party packages are required.

## Run Locally

```bash
npm start
```

Then open:

```text
http://localhost:3000
```

If port `3000` is busy, set another port:

```bash
$env:PORT=4000; npm start
```

## Pages

- Home
- Dashboard
- Mood Tracker
- Journal
- Dream Analyzer
- Resources
- Therapists
- Crisis Help
- Profile
- Login / Register
- Predictive Insights
- Therapist Matching
- Safety Text Screen
- Admin

## Safety Note

Soul Sync is a wellness support project and does not replace emergency care, therapy, diagnosis, or treatment. The Crisis Help page should always remain easy to reach from every major screen.

## Dream Analyzer

The Dream Analyzer uses a local, dependency-free NLP/ML pipeline:

- NLP: tokenization, stop-word filtering, keyword extraction, and dream-symbol matching
- ML: weighted classification for emotional tone, recurring themes, and intensity
- DL-inspired scoring: a small neural-style dense layer with sigmoid activations to refine emotion probabilities

It is designed for reflective journaling only, not clinical interpretation or diagnosis.

## Phase Two Enhancements

- Demo authentication with local session tokens
- User-scoped moods, journals, dreams, appointments, and profile settings
- Predictive mood insight from recent check-ins
- Personalized resource recommendations from recent mood, journal, and dream signals
- Crisis keyword screening endpoint and UI
- Therapist matching by concern, language, and session mode

Demo account:

```text
email: demo@soulsync.local
password: demo123
```
