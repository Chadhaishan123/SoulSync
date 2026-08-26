import os
# Force settings database URL to local SQLite file before imports execute
os.environ["DATABASE_URL"] = "sqlite:///./test.db"

import pytest
from fastapi.testclient import TestClient
from app.database.session import Base, engine
from main import app

# Ensure tables are freshly created
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)

client = TestClient(app)

def test_read_root():
    response = client.get("/")
    assert response.status_code == 200
    assert "Welcome" in response.json()["message"]

def test_auth_and_checkin_flow():
    # 1. Register User
    reg_data = {
        "name": "Test User",
        "email": "test@example.com",
        "password": "testpassword123"
    }
    res_reg = client.post("/api/auth/register", json=reg_data)
    assert res_reg.status_code == 200
    assert res_reg.json()["email"] == "test@example.com"

    # 2. Login User
    login_data = {
        "username": "test@example.com",
        "password": "testpassword123"
    }
    res_login = client.post("/api/auth/login", data=login_data)
    assert res_login.status_code == 200
    token = res_login.json()["access_token"]
    assert token is not None

    headers = {"Authorization": f"Bearer {token}"}

    # 3. Get Current User Profile
    res_profile = client.get("/api/auth/me/profile", headers=headers)
    assert res_profile.status_code == 200
    assert res_profile.json()["timezone"] == "UTC"

    # 4. Submit Mood Check-In
    checkin_data = {
        "mood_score": 7,
        "stress_level": 4,
        "energy_level": 8,
        "sleep_quality": 8,
        "primary_emotion": "Happy",
        "tags": ["Exercise", "Friends"]
    }
    res_checkin = client.post("/api/moods", json=checkin_data, headers=headers)
    assert res_checkin.status_code == 200
    assert res_checkin.json()["mood_score"] == 7

    # 5. Get Dashboard Insights
    res_dash = client.get("/api/insights/dashboard", headers=headers)
    assert res_dash.status_code == 200
    assert res_dash.json()["weather"]["latest_metrics"]["mood"] == 7
    assert res_dash.json()["digital_twin"]["current_pattern"] == "Balanced Pattern"

    # 6. Post Journal and trigger AI classification
    journal_data = {
        "content": "Today was a really good day! I finished my projects and exercised."
    }
    res_journal = client.post("/api/journals", json=journal_data, headers=headers)
    assert res_journal.status_code == 200
    assert res_journal.json()["analysis"]["dominant_emotion"] == "Happy"
    assert res_journal.json()["analysis"]["sentiment_score"] > 0

    # 7. Cleanup test.db file
    try:
        import os
        if os.path.exists("./test.db"):
            os.remove("./test.db")
    except Exception as e:
        print(f"Teardown cleanup failed: {e}")
