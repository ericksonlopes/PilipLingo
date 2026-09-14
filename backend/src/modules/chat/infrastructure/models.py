"""Modelos ORM da fatia chat. Detalhe de infraestrutura, nunca vaza para o dominio."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from shared.database import Base


class ConversationModel(Base):
    """Sessao de conversa entre aluno e IA."""

    __tablename__ = "conversations"

    id: Mapped[UUID] = mapped_column(Uuid(), primary_key=True)
    user_id: Mapped[UUID] = mapped_column(
        Uuid(),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    mode: Mapped[str] = mapped_column(String(16), nullable=False)
    level: Mapped[str] = mapped_column(String(4), nullable=False)
    topic: Mapped[str | None] = mapped_column(String(500), nullable=True)
    goal: Mapped[str | None] = mapped_column(String(500), nullable=True)
    goal_status: Mapped[str] = mapped_column(String(16), nullable=False, default="in_progress")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active", index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<ConversationModel {self.id} mode={self.mode} status={self.status}>"


class ConversationTurnModel(Base):
    """Um par (mensagem_aluno, resposta_ia) dentro de uma Conversation."""

    __tablename__ = "conversation_turns"

    id: Mapped[UUID] = mapped_column(Uuid(), primary_key=True)
    conversation_id: Mapped[UUID] = mapped_column(
        Uuid(),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    turn_index: Mapped[int] = mapped_column(Integer, nullable=False)
    user_message: Mapped[str] = mapped_column(String(1000), nullable=False)
    ai_reply: Mapped[str] = mapped_column(String(4000), nullable=False)
    # JSON: {"corrections": [...], "suggestion": "..."}
    feedback: Mapped[Any | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<ConversationTurnModel {self.id} idx={self.turn_index}>"


class ChatTopicModel(Base):
    """Topico pre-definido de conversa."""

    __tablename__ = "chat_topics"

    id: Mapped[UUID] = mapped_column(Uuid(), primary_key=True)
    label: Mapped[str] = mapped_column(String(60), nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    level_hint: Mapped[str] = mapped_column(String(4), nullable=False)

    def __repr__(self) -> str:  # pragma: no cover
        return f"<ChatTopicModel {self.label!r}>"


class ChatGoalModel(Base):
    """Meta comunicativa pre-definida."""

    __tablename__ = "chat_goals"

    id: Mapped[UUID] = mapped_column(Uuid(), primary_key=True)
    label: Mapped[str] = mapped_column(String(60), nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    level_hint: Mapped[str] = mapped_column(String(4), nullable=False)

    def __repr__(self) -> str:  # pragma: no cover
        return f"<ChatGoalModel {self.label!r}>"
