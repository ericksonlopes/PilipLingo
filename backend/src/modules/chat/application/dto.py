"""DTOs da fatia chat: Command/Query/Result entre a borda HTTP e os casos de uso."""

from __future__ import annotations

from dataclasses import dataclass, field
from uuid import UUID

from modules.chat.domain.entities import (
    ChatGoal,
    ChatTopic,
    Conversation,
    ConversationTurn,
)

# ---------- commands ----------


@dataclass(frozen=True, slots=True)
class CreateConversationCommand:
    user_id: UUID
    mode: str
    level: str
    topic: str | None = None
    goal: str | None = None


@dataclass(frozen=True, slots=True)
class AbandonConversationCommand:
    conversation_id: UUID
    user_id: UUID


@dataclass(frozen=True, slots=True)
class SendTurnCommand:
    conversation_id: UUID
    user_id: UUID
    user_message: str


# ---------- queries ----------


@dataclass(frozen=True, slots=True)
class ListConversationsQuery:
    user_id: UUID
    limit: int = 20
    offset: int = 0
    status: str | None = None


@dataclass(frozen=True, slots=True)
class GetTurnsQuery:
    conversation_id: UUID
    user_id: UUID


# ---------- results ----------


@dataclass(frozen=True, slots=True)
class ConversationPage:
    items: list[Conversation]
    total: int
    limit: int
    offset: int


@dataclass(frozen=True, slots=True)
class SendTurnResult:
    turn: ConversationTurn
    conversation_completed: bool = False
    goal_achieved: bool = False


@dataclass(frozen=True, slots=True)
class TopicsResult:
    items: list[ChatTopic]


@dataclass(frozen=True, slots=True)
class GoalsResult:
    items: list[ChatGoal]


@dataclass(frozen=True, slots=True)
class ChatStatusResult:
    enabled: bool
    model: str | None


@dataclass(frozen=True, slots=True)
class SeedDataCommand:
    """Comando de inicializacao do seed data."""

    topics: list[tuple[str, str, str]] = field(default_factory=list)
    goals: list[tuple[str, str, str]] = field(default_factory=list)
