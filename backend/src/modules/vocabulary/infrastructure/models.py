"""ORM mapping for vocabulary slice. Infrastructure detail, never leaks to domain."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.schema import UniqueConstraint

from shared.database import Base


class VocabularyEntryModel(Base):
    __tablename__ = "vocabulary_entries"
    __table_args__ = (
        UniqueConstraint("user_id", "term_normalized", name="uq_vocabulary_entries_user_term"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(), primary_key=True)
    user_id: Mapped[UUID] = mapped_column(
        Uuid(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    term: Mapped[str] = mapped_column(String(120), nullable=False)
    term_normalized: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    translation: Mapped[str] = mapped_column(String(240), nullable=False)
    example: Mapped[str | None] = mapped_column(String(500), nullable=True)
    level: Mapped[str] = mapped_column(String(2), nullable=False, default="A1")
    tags: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<VocabularyEntryModel {self.term!r} -> {self.translation!r}>"


class StudyCardModel(Base):
    """Sentence under study + structural analysis + SRS scheduling state."""

    __tablename__ = "study_cards"

    id: Mapped[UUID] = mapped_column(Uuid(), primary_key=True)
    user_id: Mapped[UUID] = mapped_column(
        Uuid(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sentence: Mapped[str] = mapped_column(String(500), nullable=False)
    sentence_normalized: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    translation: Mapped[str] = mapped_column(String(240), nullable=False)
    focus_term: Mapped[str] = mapped_column(String(120), nullable=False)
    focus_term_translation: Mapped[str | None] = mapped_column(String(240), nullable=True)
    level: Mapped[str] = mapped_column(String(2), nullable=False, index=True)
    theme: Mapped[str] = mapped_column(String(120), nullable=False)
    sentence_chunks: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON, nullable=False, default=list
    )
    vocabulary: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False, default=list)

    # ----- scheduling (simplified SM-2) -----
    repetitions: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    lapses: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    ease_factor: Mapped[float] = mapped_column(Float, nullable=False, default=2.5)
    interval_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<StudyCardModel {self.sentence[:40]!r} due={self.due_at.isoformat()}>"


class SeenWordModel(Base):
    """Individual word seen by user during a study session."""

    __tablename__ = "seen_words"
    __table_args__ = (
        UniqueConstraint("user_id", "word_normalized", name="uq_seen_words_user_word"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(), primary_key=True)
    user_id: Mapped[UUID] = mapped_column(
        Uuid(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    word: Mapped[str] = mapped_column(String(120), nullable=False)
    word_normalized: Mapped[str] = mapped_column(String(120), nullable=False)
    translation: Mapped[str] = mapped_column(String(240), nullable=False)
    first_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    seen_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    def __repr__(self) -> str:  # pragma: no cover
        return f"<SeenWordModel {self.word!r} -> {self.translation!r}>"
