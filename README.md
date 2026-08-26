# 🧠 SoulSync

> **Understand your patterns. Sync with yourself.**

SoulSync is a full-stack, AI and machine learning-powered mental wellness platform. It analyzes self-reported mood, stress, energy, sleep, journaling, and optional environmental context to detect personal patterns, generate explainable insights, predict short-term self-reported wellness trends, and build a personalized behavioral **Digital Twin**.

---

## 🏗️ Folder Structure

```text
soulsync/
├── frontend/             # Next.js, TypeScript, Tailwind, Recharts
├── backend/              # FastAPI, Python, SQLAlchemy, Hugging Face Transformers
├── ml/                   # Data Preprocessing, Synthetic Generator, Scikit-Learn Training
├── docker-compose.yml    # Orchestrates PostgreSQL, Redis, Backend, and Frontend
└── README.md
```

---

## ⚡ Quick Start: Running with Docker Compose

Ensure you have [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.

1. **Build and Start All Services:**
   ```bash
   docker compose up --build
   ```
2. **Access the Application:**
   - Frontend Client: [http://localhost:3000](http://localhost:3000)
   - Backend REST API: [http://localhost:8000](http://localhost:8000)
   - Swagger API Documentation: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🛠️ Standalone Local Development

If you prefer to run services individually without Docker:

### 1. Prerequisite: Train ML Models
The backend expects trained models in the `ml/saved_models` folder.
```bash
# Install dependencies
pip install pandas numpy scikit-learn joblib

# Generate synthetic dataset and train models
python ml/generate_synthetic.py
python ml/train_models.py
```

### 2. Standalone Backend (FastAPI)
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 3. Standalone Frontend (Next.js)
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧠 Core ML and NLP Capabilities

1. **Emotion Classification & Sentiment Analysis:**
   Uses Hugging Face `transformers` pipeline to parse journal text, detect dominant emotions (Happy, Sad, Anxious, Angry, Calm, Neutral), and score sentiment range (-1.0 to 1.0) with an automatic rule-based dictionary fallback mechanism.
2. **Behavioral Clustering (K-Means):**
   Groups user check-in history into behavioral profiles (Balanced, High-Stress, Low-Energy, Recovery) dynamically, showing how much supporting data points are mapped to the user profile.
3. **Anomaly Detection (Isolation Forest):**
   Flags when a user's logged metrics dramatically deviate from their historical average baseline, triggering gentle check-in prompts.
4. **Trend Prediction:**
   Fits a Random Forest Classifier to project short-term wellness trends based on 3-day and 7-day rolling statistical averages.

---

## 🛡️ Medical Disclaimer
SoulSync is a wellness and self-reflection tracker. It does **not** substitute professional mental healthcare, clinical diagnostic services, or medical advice.
