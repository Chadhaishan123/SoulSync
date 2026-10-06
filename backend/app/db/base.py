"""Declarative base, shared column conventions, and a timezone-safe DateTime."""

from __future__ import annotations

import datetime as dt
from typing import Optional

from sqlalchemy import DateTime, TypeDecorator, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def utcnow() -> dt.datetime:
    """Timezone-aware UTC now — datetime.utcnow() is deprecated in 3.12+."""
    return dt.datetime.now(dt.timezone.utc)


class UTCDateTime(TypeDecorator):
    """
    A DateTime that is always timezone-aware UTC in Python, on every backend.

    SQLite has no native timezone support: it stores whatever string it is
    given and hands back a **naive** datetime, even for
    `DateTime(timezone=True)`. Two things break as a result:

      1. Serialisation. A naive `2026-09-09T01:53:32` sent to the browser is
         parsed as *local* time, so a UTC timestamp silently displays hours off.
      2. Comparison. `stored.expires_at > utcnow()` raises TypeError when one
         side is naive — which would turn token expiry checks into 500s.

    Coercing here means models and endpoints can assume aware UTC everywhere,
    rather than each one remembering to patch tzinfo back on. Postgres already
    behaves correctly and passes through unchanged.
    """

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(
        self, value: Optional[dt.datetime], dialect
    ) -> Optional[dt.datetime]:
        if value is None:
            return None
        if value.tzinfo is None:
            # Assume naive input is UTC rather than guessing a local zone;
            # every writer in this codebase uses utcnow().
            return value.replace(tzinfo=dt.timezone.utc)
        return value.astimezone(dt.timezone.utc)

    def process_result_value(
        self, value: Optional[dt.datetime], dialect
    ) -> Optional[dt.datetime]:
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=dt.timezone.utc)
        return value.astimezone(dt.timezone.utc)


class Base(DeclarativeBase):
    """Base class for every SoulSync ORM model."""

    # Any Mapped[datetime] annotation resolves to UTCDateTime automatically, so
    # a new model cannot accidentally reintroduce the naive-timestamp bug by
    # writing DateTime instead.
    type_annotation_map = {dt.datetime: UTCDateTime}


class TimestampMixin:
    """
    created_at / updated_at maintained by the database where possible.

    Defaults are applied server-side (func.now()) with a Python-side default
    as well, so rows written through raw SQL and through the ORM both get
    sensible values.
    """

    created_at: Mapped[dt.datetime] = mapped_column(
        UTCDateTime,
        default=utcnow,
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[dt.datetime] = mapped_column(
        UTCDateTime,
        default=utcnow,
        onupdate=utcnow,
        server_default=func.now(),
        nullable=False,
    )
