"""Ports (interfaces) for chat domain.

The domain declares contracts; infrastructure provides adapters.
Signatures in terms of domain entities, never ORM or HTTP.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from uuid import UUID

from modules.chat.domain.entities import (
    ChatGoal,
    ChatTopic,
    Conversation,
    ConversationStatus,
    ConversationTurn,
    TurnFeedback,
)

# ---------- persistence port ----------


class ConversationRepository(ABC):
    """Persistence for Conversations and ConversationTurns."""

    @abstractmethod
    async def add_conversation(self, conversation: Conversation) -> Conversation:
        """Persists a new conversation."""

    @abstractmethod
    async def get_conversation(
        self, conversation_id: UUID, *, user_id: UUID
    ) -> Conversation | None:
        """Finds conversation by id ensuring it belongs to the user."""

    @abstractmethod
    async def list_conversations(
        self,
        *,
        user_id: UUID,
        limit: int,
        offset: int,
        status: ConversationStatus | None = None,
    ) -> list[Conversation]:
        """Lists user conversations, ordered by created_at desc."""

    @abstractmethod
    async def count_conversations(
        self,
        *,
        user_id: UUID,
        status: ConversationStatus | None = None,
    ) -> int:
        """Total user conversations."""

    @abstractmethod
    async def update_conversation(self, conversation: Conversation) -> Conversation:
        """Persists state changes in an existing conversation."""

    @abstractmethod
    async def add_turn(self, turn: ConversationTurn) -> ConversationTurn:
        """Persists a new turn."""

    @abstractmethod
    async def list_turns(
        self, conversation_id: UUID, *, user_id: UUID
    ) -> list[ConversationTurn]:
        """Lists all turns of the conversation in ascending order of turn_index."""

    @abstractmethod
    async def count_turns(self, conversation_id: UUID) -> int:
        """Counts persisted turns in the conversation."""

    @abstractmethod
    async def last_turns(
        self, conversation_id: UUID, *, limit: int
    ) -> list[ConversationTurn]:
        """Returns the last N turns in ascending chronological order."""


class TopicRepository(ABC):
    """Read interface for predefined topics."""

    @abstractmethod
    async def list_topics(self, *, limit: int = 30) -> list[ChatTopic]:
        """Returns topics up to limit."""

    @abstractmethod
    async def count_topics(self) -> int:
        """Total topics."""

    @abstractmethod
    async def seed(self, topics: list[ChatTopic]) -> None:
        """Inserts topics if the table is empty."""


class GoalRepository(ABC):
    """Read interface for predefined goals."""

    @abstractmethod
    async def list_goals(self, *, limit: int = 30) -> list[ChatGoal]:
        """Returns goals up to limit."""

    @abstractmethod
    async def count_goals(self) -> int:
        """Total goals."""

    @abstractmethod
    async def seed(self, goals: list[ChatGoal]) -> None:
        """Inserts goals if the table is empty."""


# ---------- AI port ----------


@dataclass(frozen=True, slots=True)
class TurnContext:
    """Context sent to AI_Tutor to generate a turn."""

    user_message: str
    mode: str
    level: str
    topic: str | None
    goal: str | None
    goals: list[str] = field(default_factory=list)
    goals_progress: list[bool] = field(default_factory=list)
    history: list[tuple[str, str]] = field(default_factory=list)
    # When True, requests evaluation of goal achievement in the same call.
    evaluate_goal: bool = False


@dataclass(frozen=True, slots=True)
class TurnResult:
    """Result returned by AI_Tutor for a turn."""

    ai_reply: str
    feedback: TurnFeedback | None
    goal_achieved: bool = False
    goals_progress: list[bool] = field(default_factory=list)


class ChatAIPort(ABC):
    """Port for generating responses and pedagogical feedback.

    The domain does not know that an LLM exists behind this.
    """

    @abstractmethod
    async def generate_turn(self, context: TurnContext) -> TurnResult:
        """Generates response + feedback (and goal evaluation, if requested)."""
