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
- Resources
- Therapists
- Crisis Help
- Profile
- Admin

## Safety Note

Soul Sync is a wellness support project and does not replace emergency care, therapy, diagnosis, or treatment. The Crisis Help page should always remain easy to reach from every major screen.
