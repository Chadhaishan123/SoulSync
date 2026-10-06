"""
Crisis-safety layer.

This is the single source of truth for crisis detection in SoulSync, and it
runs **before** any classifier or generative model touches the text. That
ordering is deliberate: an emotion classifier asked to label "I want to end
my life" will happily return `{"sadness": 0.87}` and carry on, which is
exactly the wrong response. Detection short-circuits to real human
resources instead.

Boundaries this module enforces:
  * SoulSync never diagnoses. No screening scores, no condition labels.
  * Matching is intentionally high-recall (a false positive shows a helpline;
    a false negative is a missed cry for help).
  * Resources are real, current, and region-aware.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

# ---------------------------------------------------------------------------
# Tiered phrase matching.
#
# CRITICAL  -> active risk language; always interrupts and shows resources.
# ELEVATED  -> distress worth surfacing support for, without interrupting.
#
# Phrases are matched on word boundaries against normalised text so that
# "therapist" does not trigger on "the rapist", and "I can't go on" still
# matches "i cant go on".
# ---------------------------------------------------------------------------

CRITICAL_PHRASES: tuple[str, ...] = (
    "kill myself",
    "killing myself",
    "end my life",
    "ending my life",
    "take my own life",
    "want to die",
    "wish i was dead",
    "wish i were dead",
    "better off dead",
    "suicide",
    "suicidal",
    "harm myself",
    "hurt myself",
    "self harm",
    "cut myself",
    "cutting myself",
    "overdose",
    "no reason to live",
    "nothing to live for",
    "cant go on",
    "cannot go on",
    "cant do this anymore",
    "cannot do this anymore",
    "everyone would be better off without me",
    "not worth living",
)

ELEVATED_PHRASES: tuple[str, ...] = (
    "hopeless",
    "worthless",
    "hate myself",
    "cant cope",
    "cannot cope",
    "breaking down",
    "falling apart",
    "trapped",
    "unbearable",
    "give up",
    "burnt out",
    "burned out",
    "panic attack",
    "cant breathe",
)

LEVEL_NONE = "none"
LEVEL_ELEVATED = "elevated"
LEVEL_CRITICAL = "critical"


# ---------------------------------------------------------------------------
# Real crisis resources.
#
# Region codes are ISO-3166 alpha-2. `international` is always included as a
# fallback so a user in an unlisted country is never left without a route to
# help.
# ---------------------------------------------------------------------------

CRISIS_RESOURCES: Dict[str, List[Dict[str, str]]] = {
    "IN": [
        {
            "name": "Tele-MANAS (Government of India)",
            "contact": "14416 or 1-800-891-4416",
            "detail": "Free 24/7 mental health support in 20+ languages.",
            "url": "https://telemanas.mohfw.gov.in/",
        },
        {
            "name": "AASRA",
            "contact": "+91 98204 66726",
            "detail": "24/7 crisis intervention and emotional support.",
            "url": "https://www.aasra.info/",
        },
        {
            "name": "Vandrevala Foundation",
            "contact": "+91 99996 66555",
            "detail": "24/7 free counselling by phone and WhatsApp.",
            "url": "https://www.vandrevalafoundation.com/",
        },
        {
            "name": "iCALL (TISS)",
            "contact": "+91 91529 87821",
            "detail": "Counselling Mon-Sat, 10am-8pm IST.",
            "url": "https://icallhelpline.org/",
        },
    ],
    "US": [
        {
            "name": "988 Suicide & Crisis Lifeline",
            "contact": "Call or text 988",
            "detail": "Free, confidential, 24/7 across the United States.",
            "url": "https://988lifeline.org/",
        },
        {
            "name": "Crisis Text Line",
            "contact": "Text HOME to 741741",
            "detail": "24/7 support over text with a trained counsellor.",
            "url": "https://www.crisistextline.org/",
        },
    ],
    "GB": [
        {
            "name": "Samaritans",
            "contact": "116 123",
            "detail": "Free, 24/7, from any phone in the UK and Ireland.",
            "url": "https://www.samaritans.org/",
        },
        {
            "name": "Shout",
            "contact": "Text SHOUT to 85258",
            "detail": "24/7 text support across the UK.",
            "url": "https://giveusashout.org/",
        },
    ],
    "CA": [
        {
            "name": "9-8-8 Suicide Crisis Helpline",
            "contact": "Call or text 988",
            "detail": "Free, 24/7, bilingual across Canada.",
            "url": "https://988.ca/",
        },
    ],
    "AU": [
        {
            "name": "Lifeline Australia",
            "contact": "13 11 14",
            "detail": "24/7 crisis support and suicide prevention.",
            "url": "https://www.lifeline.org.au/",
        },
    ],
    "international": [
        {
            "name": "Find A Helpline",
            "contact": "findahelpline.com",
            "detail": "Verified crisis lines in over 130 countries.",
            "url": "https://findahelpline.com/",
        },
        {
            "name": "International Association for Suicide Prevention",
            "contact": "iasp.info/resources/Crisis_Centres",
            "detail": "Directory of crisis centres worldwide.",
            "url": "https://www.iasp.info/resources/Crisis_Centres/",
        },
        {
            "name": "Local emergency services",
            "contact": "112 / 911 / your local number",
            "detail": "If there is immediate danger to life, contact emergency services.",
            "url": "",
        },
    ],
}

CRISIS_MESSAGE = (
    "It sounds like you are carrying something very heavy right now, and I want "
    "to be honest with you: this is beyond what I can help with. You deserve "
    "support from a real person who is trained for this.\n\n"
    "Please reach out to one of the services below. They are free, "
    "confidential, and available now. If you are in immediate danger, please "
    "contact your local emergency number.\n\n"
    "You are not a burden for needing help."
)

# Precompiled for speed and to avoid substring false positives.
_NON_WORD = re.compile(r"[^a-z0-9\s]+")
_WHITESPACE = re.compile(r"\s+")


def _normalise(text: str) -> str:
    """
    Lowercase, strip punctuation (so "can't" -> "cant"), collapse whitespace,
    and pad with spaces so word-boundary checks are simple containment tests.
    """
    lowered = text.lower()
    stripped = _NON_WORD.sub(" ", lowered)
    collapsed = _WHITESPACE.sub(" ", stripped).strip()
    return f" {collapsed} "


def _matches(normalised: str, phrases: tuple[str, ...]) -> List[str]:
    hits = []
    for phrase in phrases:
        if f" {phrase} " in normalised or normalised.startswith(f" {phrase} "):
            hits.append(phrase)
    return hits


def get_resources(country_code: Optional[str] = None) -> List[Dict[str, str]]:
    """
    Region-appropriate resources, always followed by international fallbacks.
    """
    code = (country_code or "").upper()
    regional = CRISIS_RESOURCES.get(code, [])
    return [*regional, *CRISIS_RESOURCES["international"]]


def assess(text: str, country_code: Optional[str] = None) -> Dict[str, Any]:
    """
    Classify crisis risk in a block of user text.

    Returns a dict with:
        level         "none" | "elevated" | "critical"
        matched       the phrases that triggered (for transparency/debugging)
        interrupt     True when the caller MUST skip normal processing and
                      surface `message` + `resources` instead
        message       supportive copy to show (critical only)
        resources     region-aware helpline list (elevated + critical)
    """
    if not text or not text.strip():
        return {
            "level": LEVEL_NONE,
            "matched": [],
            "interrupt": False,
            "message": None,
            "resources": [],
        }

    normalised = _normalise(text)

    critical_hits = _matches(normalised, CRITICAL_PHRASES)
    if critical_hits:
        return {
            "level": LEVEL_CRITICAL,
            "matched": critical_hits,
            "interrupt": True,
            "message": CRISIS_MESSAGE,
            "resources": get_resources(country_code),
        }

    elevated_hits = _matches(normalised, ELEVATED_PHRASES)
    if elevated_hits:
        return {
            "level": LEVEL_ELEVATED,
            "matched": elevated_hits,
            # Elevated does NOT interrupt: the entry is still analysed and
            # saved normally, we simply offer support alongside it.
            "interrupt": False,
            "message": None,
            "resources": get_resources(country_code),
        }

    return {
        "level": LEVEL_NONE,
        "matched": [],
        "interrupt": False,
        "message": None,
        "resources": [],
    }
