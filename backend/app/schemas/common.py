"""Shared schema conventions."""

from __future__ import annotations

from typing import Generic, List, Optional, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class ORMModel(BaseModel):
    """Base for schemas read out of SQLAlchemy objects."""

    model_config = ConfigDict(from_attributes=True)


class Message(BaseModel):
    """Generic acknowledgement payload."""

    detail: str


class Page(BaseModel, Generic[T]):
    """
    Cursor-free pagination. `total` is the unfiltered count so the UI can show
    "showing 20 of 143" without a second request.
    """

    items: List[T]
    total: int
    limit: int
    offset: int

    @property
    def has_more(self) -> bool:
        return self.offset + len(self.items) < self.total


class DataAvailability(BaseModel):
    """
    Attached to every analytical response.

    SoulSync computes everything from the user's own rows, so a response is
    meaningless without saying how many rows it had. When `is_sufficient` is
    False the frontend renders an unlock state ("log 5 more check-ins") rather
    than a chart of near-noise — this is the mechanism that keeps the product
    from implying insight it does not have.
    """

    row_count: int
    required_rows: int
    is_sufficient: bool
    message: Optional[str] = None

    @classmethod
    def build(
        cls, row_count: int, required_rows: int, subject: str = "check-ins"
    ) -> "DataAvailability":
        sufficient = row_count >= required_rows
        if sufficient:
            msg = f"Computed from your {row_count} {subject}."
        else:
            missing = required_rows - row_count
            plural = "entry" if missing == 1 else "entries"
            msg = (
                f"Needs {required_rows} {subject} — you have {row_count}. "
                f"Log {missing} more {plural} to unlock this."
            )
        return cls(
            row_count=row_count,
            required_rows=required_rows,
            is_sufficient=sufficient,
            message=msg,
        )
