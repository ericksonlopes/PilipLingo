"""Mapeamento ORM da fatia vocabulary. Detalhe de infraestrutura, nunca vaza para o dominio."""

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
    # Unicidade do termo agora e por usuario, nao global.
    __table_args__ = (
        UniqueConstraint("user_id", "term_normalized", name="uq_vocabulary_entries_user_term"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(), primary_key=True)
    # Dono do item. FK com ON DELETE CASCADE: apagar o usuario limpa o vocabulario.
    user_id: Mapped[UUID] = mapped_column(
        Uuid(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    term: Mapped[str] = mapped_column(String(120), nullable=False)
    # Termo em casefold: garante unicidade case-insensitive de forma portavel.
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

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<VocabularyEntryModel {self.term!r} -> {self.translation!r}>"


class StudyCardModel(Base):
    """Frase em estudo + analise estrutural + estado do agendamento SRS."""

    __tablename__ = "study_cards"

    id: Mapped[UUID] = mapped_column(Uuid(), primary_key=True)
    # Dono do card. FK com ON DELETE CASCADE, igual ao vocabulario.
    user_id: Mapped[UUID] = mapped_column(
        Uuid(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sentence: Mapped[str] = mapped_column(String(500), nullable=False)
    # Frase em casefold: usada para nao gerar a mesma frase duas vezes.
    sentence_normalized: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    translation: Mapped[str] = mapped_column(String(240), nullable=False)
    focus_term: Mapped[str] = mapped_column(String(120), nullable=False)
    # Traducao do termo-alvo em portugues. Nullable para compatibilidade com cards antigos.
    focus_term_translation: Mapped[str | None] = mapped_column(String(240), nullable=True)
    level: Mapped[str] = mapped_column(String(2), nullable=False, index=True)
    theme: Mapped[str] = mapped_column(String(120), nullable=False)
    # Analise estrutural: [{"text": ..., "role": ..., "explanation": ...}, ...].
    # JSON porque e um value object de leitura, sempre consumido junto do card.
    sentence_chunks: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON, nullable=False, default=list
    )
    # Itens de vocabulario da frase: [{"term": ..., "translation": ...}, ...].
    # JSON pelo mesmo motivo de sentence_chunks: value object de leitura, sempre
    # consumido junto do card. Alimenta o historico "Palavras".
    vocabulary: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False, default=list)

    # ----- agendamento (SM-2 simplificado) -----
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

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<StudyCardModel {self.sentence[:40]!r} due={self.due_at.isoformat()}>"


class SeenWordModel(Base):
    """Palavra individual vista pelo usuario em alguma sessao de estudo.

    Armazenada separadamente dos cards para ter traducao propria (via
    deep-translator) e historico de quando foi vista pela primeira vez.
    Unicidade por (user_id, word_normalized): a mesma palavra nao e duplicada.
    """

    __tablename__ = "seen_words"
    __table_args__ = (
        UniqueConstraint("user_id", "word_normalized", name="uq_seen_words_user_word"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(), primary_key=True)
    user_id: Mapped[UUID] = mapped_column(
        Uuid(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Palavra em ingles como veio do focus_term ou gerada a partir da frase.
    word: Mapped[str] = mapped_column(String(120), nullable=False)
    # Casefold para unicidade case-insensitive.
    word_normalized: Mapped[str] = mapped_column(String(120), nullable=False)
    # Traducao em portugues fornecida pelo deep-translator.
    translation: Mapped[str] = mapped_column(String(240), nullable=False)
    # Quando esta palavra foi vista pela primeira vez.
    first_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    # Atualizado a cada sessao em que a palavra aparece.
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    # Quantas sessoes diferentes expuseram esta palavra.
    seen_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    def __repr__(self) -> str:  # pragma: no cover
        return f"<SeenWordModel {self.word!r} -> {self.translation!r}>"
