"""
Built-in activity catalogue.

This is the **only** seeded data in SoulSync, and it is worth being precise
about why that is consistent with the "no generated data" rule: these rows are
reference content — a library of wellbeing exercises, like a list of countries
or timezones. They are not observations about the user. No mood entry, sleep
record, journal, or score is ever seeded; those must all come from the person
using the app.

Each activity declares the live conditions it suits (`contexts`). The
recommendation ranker matches those against the *actual* environment reading —
so when PM2.5 is genuinely high near the user, outdoor suggestions drop and
indoor ones rise. That is what makes the ranking real rather than decorative.

Idempotent: running it again updates existing built-ins in place rather than
duplicating them.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.activity import (
    CONTEXT_CLEAR_WEATHER,
    CONTEXT_COLD,
    CONTEXT_EVENING,
    CONTEXT_GOOD_AIR,
    CONTEXT_HIGH_AQI,
    CONTEXT_HIGH_STRESS,
    CONTEXT_HIGH_UV,
    CONTEXT_HOLIDAY,
    CONTEXT_HOT,
    CONTEXT_INDOOR,
    CONTEXT_LOW_ENERGY,
    CONTEXT_LOW_MOOD,
    CONTEXT_MORNING,
    CONTEXT_POOR_SLEEP,
    CONTEXT_RAIN,
    Activity,
)

log = logging.getLogger("soulsync.seed")

BUILTIN_ACTIVITIES: List[Dict[str, Any]] = [
    # ---------------------------------------------------------------- movement
    {
        "slug": "outdoor-walk",
        "name": "Take a walk outside",
        "category": "movement",
        "duration_minutes": 20,
        "difficulty": "easy",
        "description": (
            "A 20-minute walk in daylight. Movement and light exposure both act "
            "on mood, and daylight early in the day also anchors your body clock."
        ),
        "instructions": (
            "Leave your phone on silent. Walk at a pace where you could still "
            "hold a conversation. Notice five things you can see, four you can "
            "hear, three you can feel."
        ),
        "contexts": [
            CONTEXT_LOW_MOOD,
            CONTEXT_LOW_ENERGY,
            CONTEXT_GOOD_AIR,
            CONTEXT_CLEAR_WEATHER,
            CONTEXT_MORNING,
        ],
    },
    {
        "slug": "indoor-stretch",
        "name": "Gentle stretch sequence",
        "category": "movement",
        "duration_minutes": 10,
        "difficulty": "easy",
        "description": (
            "Ten minutes of slow stretching for neck, shoulders, back and hips — "
            "the places tension tends to settle after a long day at a desk."
        ),
        "instructions": (
            "Hold each stretch for 30 seconds without bouncing. Breathe out as "
            "you move deeper. Stop at mild tension, never at pain."
        ),
        "contexts": [
            CONTEXT_HIGH_STRESS,
            CONTEXT_HIGH_AQI,
            CONTEXT_RAIN,
            CONTEXT_INDOOR,
            CONTEXT_HOT,
        ],
    },
    {
        "slug": "movement-snack",
        "name": "Two-minute movement break",
        "category": "movement",
        "duration_minutes": 2,
        "difficulty": "easy",
        "description": (
            "Stand up and move for two minutes. Short and frequent beats long "
            "and rare when energy is already low."
        ),
        "instructions": (
            "Stand, roll your shoulders back ten times, do ten slow squats or "
            "calf raises, then shake out your hands and arms."
        ),
        "contexts": [CONTEXT_LOW_ENERGY, CONTEXT_INDOOR, CONTEXT_POOR_SLEEP],
    },
    # ------------------------------------------------------------- mindfulness
    {
        "slug": "box-breathing",
        "name": "Box breathing",
        "category": "mindfulness",
        "duration_minutes": 5,
        "difficulty": "easy",
        "description": (
            "Equal counts of in, hold, out, hold. Lengthening the exhale "
            "engages the parasympathetic response, which is why slow breathing "
            "settles a racing heart."
        ),
        "instructions": (
            "Inhale for 4, hold for 4, exhale for 4, hold for 4. Repeat for "
            "five minutes. If 4 feels long, start at 3."
        ),
        "contexts": [CONTEXT_HIGH_STRESS, CONTEXT_INDOOR, CONTEXT_HIGH_AQI],
    },
    {
        "slug": "four-seven-eight-breathing",
        "name": "4-7-8 breathing",
        "category": "mindfulness",
        "duration_minutes": 4,
        "difficulty": "easy",
        "description": (
            "A long exhale pattern that suits winding down. Best used near "
            "bedtime rather than before something demanding."
        ),
        "instructions": (
            "Inhale through the nose for 4, hold for 7, exhale through the mouth "
            "for 8. Four cycles is enough to start."
        ),
        "contexts": [CONTEXT_HIGH_STRESS, CONTEXT_EVENING, CONTEXT_POOR_SLEEP],
    },
    {
        "slug": "body-scan",
        "name": "Body scan",
        "category": "mindfulness",
        "duration_minutes": 10,
        "difficulty": "easy",
        "description": (
            "Move attention slowly through the body without trying to change "
            "anything. Useful when stress is showing up physically."
        ),
        "instructions": (
            "Lie down. Starting at your toes, spend a few breaths on each part "
            "of the body up to your scalp. Notice sensation; do not judge it."
        ),
        "contexts": [CONTEXT_HIGH_STRESS, CONTEXT_EVENING, CONTEXT_INDOOR],
    },
    {
        "slug": "grounding-five-senses",
        "name": "5-4-3-2-1 grounding",
        "category": "mindfulness",
        "duration_minutes": 3,
        "difficulty": "easy",
        "description": (
            "A sensory anchor for when your thoughts are running ahead of you. "
            "Works because it occupies the attention that anxiety was using."
        ),
        "instructions": (
            "Name five things you can see, four you can touch, three you can "
            "hear, two you can smell, one you can taste."
        ),
        "contexts": [CONTEXT_HIGH_STRESS, CONTEXT_INDOOR],
    },
    # ------------------------------------------------------------------- rest
    {
        "slug": "sleep-wind-down",
        "name": "Wind-down routine",
        "category": "rest",
        "duration_minutes": 30,
        "difficulty": "easy",
        "description": (
            "A consistent pre-sleep sequence. Regularity matters more than the "
            "specific steps — the routine itself becomes the cue."
        ),
        "instructions": (
            "Dim the lights. Screens away 30 minutes before bed. Same order of "
            "steps each night, same target bedtime within about 20 minutes."
        ),
        "contexts": [CONTEXT_POOR_SLEEP, CONTEXT_EVENING],
    },
    {
        "slug": "power-nap",
        "name": "Short nap",
        "category": "rest",
        "duration_minutes": 20,
        "difficulty": "easy",
        "description": (
            "Twenty minutes, set an alarm. Longer risks waking mid-deep-sleep "
            "and feeling worse than before."
        ),
        "instructions": (
            "Somewhere dark and cool, alarm at 20 minutes. Before about 3pm, so "
            "it does not eat into tonight's sleep."
        ),
        "contexts": [CONTEXT_LOW_ENERGY, CONTEXT_POOR_SLEEP, CONTEXT_HOT],
    },
    {
        "slug": "screen-break",
        "name": "Twenty-minute screen break",
        "category": "rest",
        "duration_minutes": 20,
        "difficulty": "easy",
        "description": (
            "Step away from all screens. Not a productivity trick — a genuine "
            "pause."
        ),
        "instructions": (
            "Set a timer. No phone, no laptop, no TV. Tea, a window, a stretch, "
            "or simply sitting."
        ),
        "contexts": [CONTEXT_HIGH_STRESS, CONTEXT_LOW_ENERGY, CONTEXT_INDOOR],
    },
    # ----------------------------------------------------------------- social
    {
        "slug": "reach-out",
        "name": "Message someone you trust",
        "category": "social",
        "duration_minutes": 10,
        "difficulty": "medium",
        "description": (
            "One message to one person. Connection is among the most reliable "
            "buffers against low mood, and it does not need to be a long "
            "conversation."
        ),
        "instructions": (
            "Pick one person. Send one honest message — even just \"thinking of "
            "you, how are things?\". No expectation of a reply."
        ),
        "contexts": [CONTEXT_LOW_MOOD, CONTEXT_HIGH_STRESS, CONTEXT_HOLIDAY],
    },
    {
        "slug": "shared-meal",
        "name": "Eat with someone",
        "category": "social",
        "duration_minutes": 45,
        "difficulty": "medium",
        "description": (
            "Share a meal, in person or on a call. Low-effort company with a "
            "natural structure to it."
        ),
        "instructions": "Phones face down. No agenda beyond eating together.",
        "contexts": [CONTEXT_LOW_MOOD, CONTEXT_HOLIDAY],
    },
    # --------------------------------------------------------------- creative
    {
        "slug": "gratitude-three",
        "name": "Three good things",
        "category": "creative",
        "duration_minutes": 5,
        "difficulty": "easy",
        "description": (
            "Write down three specific things that went well. Specific beats "
            "general — \"the coffee was good\" lands better than \"my family\"."
        ),
        "instructions": (
            "Three things from today, each with one line on why it mattered. "
            "Small counts."
        ),
        "contexts": [CONTEXT_LOW_MOOD, CONTEXT_EVENING, CONTEXT_INDOOR],
    },
    {
        "slug": "brain-dump",
        "name": "Brain dump",
        "category": "creative",
        "duration_minutes": 10,
        "difficulty": "easy",
        "description": (
            "Get everything out of your head and onto a page, unsorted. "
            "Particularly useful when worry is keeping you awake."
        ),
        "instructions": (
            "Ten minutes, no editing, no structure. Everything on your mind. "
            "Then close it — you are not solving anything tonight."
        ),
        "contexts": [CONTEXT_HIGH_STRESS, CONTEXT_EVENING, CONTEXT_POOR_SLEEP],
    },
    {
        "slug": "thought-reframe",
        "name": "Reframe a difficult thought",
        "category": "creative",
        "duration_minutes": 15,
        "difficulty": "medium",
        "description": (
            "A CBT-style thought record: name the automatic thought, weigh the "
            "evidence on both sides, then write a more balanced version."
        ),
        "instructions": (
            "Use the Reframe tool. Write the thought exactly as it appeared, "
            "then the evidence for and against, then a version you would offer "
            "a friend."
        ),
        "contexts": [CONTEXT_LOW_MOOD, CONTEXT_HIGH_STRESS],
    },
    # ----------------------------------------------------------------- nature
    {
        "slug": "sunlight-exposure",
        "name": "Ten minutes of morning light",
        "category": "nature",
        "duration_minutes": 10,
        "difficulty": "easy",
        "description": (
            "Daylight within an hour or two of waking is one of the strongest "
            "signals for your circadian rhythm — which is why it shows up in "
            "sleep advice so consistently."
        ),
        "instructions": (
            "Outside or by a bright window, no sunglasses, ten minutes. "
            "Overcast still works; outdoor light is far brighter than indoor."
        ),
        "contexts": [
            CONTEXT_POOR_SLEEP,
            CONTEXT_LOW_ENERGY,
            CONTEXT_MORNING,
            CONTEXT_GOOD_AIR,
        ],
    },
    {
        "slug": "green-space",
        "name": "Sit somewhere green",
        "category": "nature",
        "duration_minutes": 15,
        "difficulty": "easy",
        "description": (
            "Time in green space is associated with lower stress even in short "
            "doses. A park bench counts."
        ),
        "instructions": (
            "Find trees or grass. Sit for fifteen minutes without a screen."
        ),
        "contexts": [
            CONTEXT_HIGH_STRESS,
            CONTEXT_GOOD_AIR,
            CONTEXT_CLEAR_WEATHER,
            CONTEXT_HOLIDAY,
        ],
    },
    {
        "slug": "warm-shower",
        "name": "Warm shower",
        "category": "rest",
        "duration_minutes": 15,
        "difficulty": "easy",
        "description": (
            "A warm shower an hour or two before bed helps by dropping core "
            "body temperature afterwards — the same drop that accompanies "
            "falling asleep."
        ),
        "instructions": "Warm, not hot. An hour or two before your target bedtime.",
        "contexts": [CONTEXT_POOR_SLEEP, CONTEXT_EVENING, CONTEXT_COLD],
    },
    {
        "slug": "hydrate-check",
        "name": "Hydration check",
        "category": "rest",
        "duration_minutes": 2,
        "difficulty": "easy",
        "description": (
            "Mild dehydration shows up as fatigue and poor concentration before "
            "it shows up as thirst."
        ),
        "instructions": "A full glass of water now, and refill it where you can see it.",
        "contexts": [CONTEXT_LOW_ENERGY, CONTEXT_HOT, CONTEXT_HIGH_UV],
    },
]


def seed_activities(db: Session) -> int:
    """
    Insert or update the built-in catalogue. Returns the number of rows written.

    User-created activities are never touched: the query is scoped to
    `is_builtin == True`, so someone's own habit called "outdoor-walk" cannot
    be overwritten by a later seed run.
    """
    written = 0

    existing = {
        activity.slug: activity
        for activity in db.scalars(
            select(Activity).where(Activity.is_builtin.is_(True))
        ).all()
    }

    for spec in BUILTIN_ACTIVITIES:
        activity = existing.get(spec["slug"])
        if activity is None:
            db.add(Activity(is_builtin=True, is_active=True, **spec))
            written += 1
            continue

        # Refresh copy and context tags in place so wording improvements reach
        # existing installs without creating duplicates.
        changed = False
        for field, value in spec.items():
            if getattr(activity, field) != value:
                setattr(activity, field, value)
                changed = True
        if changed:
            written += 1

    db.commit()
    log.info(
        "Activity catalogue seeded: %d built-in activities (%d written).",
        len(BUILTIN_ACTIVITIES),
        written,
    )
    return written


def main() -> None:  # pragma: no cover - manual entry point
    """Run standalone: python -m app.db.seed"""
    from app.db.session import SessionLocal, init_db

    init_db()
    db = SessionLocal()
    try:
        seed_activities(db)
    finally:
        db.close()


if __name__ == "__main__":  # pragma: no cover
    main()
