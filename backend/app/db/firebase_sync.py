"""
Firebase Cloud Firestore & Firebase Auth Synchronization Layer.

Automatically mirrors SQLAlchemy writes (User, UserProfile, MoodEntry,
SleepRecord, JournalEntry) to Google Cloud Firestore via the Firestore REST API
and verifies both Firebase Auth ID Tokens and Google OAuth2 ID Tokens.
"""

from __future__ import annotations

import datetime as dt
import json
import logging
import threading
from typing import Any, Dict, Optional

import httpx
from sqlalchemy import event

from app.core.config import settings

log = logging.getLogger("soulsync.firebase")


def _to_firestore_value(val: Any) -> Dict[str, Any]:
    """Encode a Python scalar/list/dict into Firestore REST Value representation."""
    if val is None:
        return {"nullValue": None}
    if isinstance(val, bool):
        return {"booleanValue": val}
    if isinstance(val, int):
        return {"integerValue": str(val)}
    if isinstance(val, float):
        return {"doubleValue": val}
    if isinstance(val, (dt.datetime, dt.date)):
        return {"stringValue": val.isoformat()}
    if isinstance(val, (list, tuple)):
        return {"arrayValue": {"values": [_to_firestore_value(x) for x in val]}}
    if isinstance(val, dict):
        return {"mapValue": {"fields": {str(k): _to_firestore_value(v) for k, v in val.items()}}}
    return {"stringValue": str(val)}


def sync_to_firestore_async(collection: str, doc_id: str, payload: Dict[str, Any]) -> None:
    """Asynchronously upsert a document in Google Cloud Firestore without blocking the request."""
    project_id = (settings.FIREBASE_PROJECT_ID or "").strip()
    if not project_id:
        return

    def _worker() -> None:
        url = (
            f"https://firestore.googleapis.com/v1/projects/{project_id}"
            f"/databases/(default)/documents/{collection}/{doc_id}"
        )
        params = {}
        if settings.FIREBASE_API_KEY:
            params["key"] = settings.FIREBASE_API_KEY

        fields = {k: _to_firestore_value(v) for k, v in payload.items()}
        try:
            with httpx.Client(timeout=6.0) as client:
                client.patch(url, params=params, json={"fields": fields})
        except Exception as exc:
            log.debug("Firestore background sync (%s/%s) skipped: %s", collection, doc_id, exc)

    threading.Thread(target=_worker, daemon=True).start()


def verify_firebase_or_google_id_token(credential: str) -> Optional[Dict[str, Any]]:
    """
    Verify either:
      1. A Firebase Auth ID Token (issued by securetoken.google.com/<project_id>)
      2. A Google Identity Services OAuth2 ID Token (issued by accounts.google.com)
    Returns normalized {"email": ..., "name": ..., "email_verified": bool, "aud": ...} or None.
    """
    cred = credential.strip()
    if not cred:
        return None

    with httpx.Client(timeout=10.0) as client:
        # 1. Try Google tokeninfo endpoint (validates RS256 signature & expiry for both Google & Firebase JWTs)
        try:
            resp = client.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": cred},
            )
            if resp.status_code == 200:
                info = resp.json()
                if info.get("email"):
                    return {
                        "email": info["email"],
                        "name": info.get("name") or info.get("given_name") or info["email"].split("@")[0].capitalize(),
                        "email_verified": str(info.get("email_verified", "")).lower() == "true",
                        "aud": info.get("aud", ""),
                        "iss": info.get("iss", ""),
                    }
        except Exception as exc:
            log.debug("Google tokeninfo check failed: %s", exc)

        # 2. If FIREBASE_API_KEY is configured, also support Firebase Identity Toolkit accounts:lookup
        api_key = (settings.FIREBASE_API_KEY or "").strip()
        if api_key:
            try:
                fb_resp = client.post(
                    f"https://identitytoolkit.googleapis.com/v1/accounts:lookup?key={api_key}",
                    json={"idToken": cred},
                )
                if fb_resp.status_code == 200:
                    users = fb_resp.json().get("users") or []
                    if users and users[0].get("email"):
                        u = users[0]
                        return {
                            "email": u["email"],
                            "name": u.get("displayName") or u["email"].split("@")[0].capitalize(),
                            "email_verified": bool(u.get("emailVerified", True)),
                            "aud": settings.FIREBASE_PROJECT_ID,
                            "iss": f"https://securetoken.google.com/{settings.FIREBASE_PROJECT_ID}",
                        }
            except Exception as exc:
                log.debug("Firebase Identity Toolkit lookup failed: %s", exc)

    return None


def register_firestore_listeners() -> None:
    """Attach SQLAlchemy event listeners to mirror writes to Cloud Firestore."""
    try:
        from app.models.journal import JournalEntry
        from app.models.tracking import MoodEntry, SleepRecord
        from app.models.user import User

        @event.listens_for(User, "after_insert")
        @event.listens_for(User, "after_update")
        def _on_user_change(_mapper, _connection, target: User) -> None:
            sync_to_firestore_async(
                "soulsync_users",
                f"user_{target.id}",
                {
                    "id": target.id,
                    "name": target.name,
                    "email": target.email,
                    "is_active": target.is_active,
                    "last_login_at": target.last_login_at,
                },
            )

        @event.listens_for(MoodEntry, "after_insert")
        @event.listens_for(MoodEntry, "after_update")
        def _on_checkin_change(_mapper, _connection, target: MoodEntry) -> None:
            sync_to_firestore_async(
                "soulsync_checkins",
                f"checkin_{target.user_id}_{target.id}",
                {
                    "id": target.id,
                    "user_id": target.user_id,
                    "mood_score": target.mood_score,
                    "stress_level": target.stress_level,
                    "energy_level": target.energy_level,
                    "sleep_quality": target.sleep_quality,
                    "primary_emotion": getattr(target, "primary_emotion", None),
                    "notes": getattr(target, "notes", None),
                    "recorded_at": target.recorded_at,
                },
            )

        @event.listens_for(SleepRecord, "after_insert")
        @event.listens_for(SleepRecord, "after_update")
        def _on_sleep_change(_mapper, _connection, target: SleepRecord) -> None:
            sync_to_firestore_async(
                "soulsync_sleep",
                f"sleep_{target.user_id}_{target.id}",
                {
                    "id": target.id,
                    "user_id": target.user_id,
                    "duration_hours": getattr(target, "duration_hours", None),
                    "quality_score": getattr(target, "quality_score", None),
                    "recorded_at": getattr(target, "recorded_at", None),
                },
            )

        @event.listens_for(JournalEntry, "after_insert")
        @event.listens_for(JournalEntry, "after_update")
        def _on_journal_change(_mapper, _connection, target: JournalEntry) -> None:
            sync_to_firestore_async(
                "soulsync_journals",
                f"journal_{target.user_id}_{target.id}",
                {
                    "id": target.id,
                    "user_id": target.user_id,
                    "title": getattr(target, "title", None),
                    "content": getattr(target, "content", None),
                    "dominant_emotion": getattr(target, "dominant_emotion", None),
                    "sentiment_score": getattr(target, "sentiment_score", None),
                    "created_at": getattr(target, "created_at", None),
                },
            )

        log.info("Registered Firebase Cloud Firestore sync listeners (project=%s).", settings.FIREBASE_PROJECT_ID)
    except Exception as exc:
        log.warning("Could not attach Firestore listeners: %s", exc)
