"""Portas (interfaces) do dominio chat.

O dominio declara contratos; a infraestrutura fornece adaptadores.
Assinaturas em termos das entidades do dominio, nunca de ORM ou HTTP.
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

# ---------- porta de persistencia ----------


class ConversationRepository(ABC):
    """Persistencia de Conversations e ConversationTurns."""

    @abstractmethod
    async def add_conversation(self, conversation: Conversation) -> Conversation:
        """Persiste uma nova conversa."""

    @abstractmethod
    async def get_conversation(
        self, conversation_id: UUID, *, user_id: UUID
    ) -> Conversation | None:
        """Busca conversa por id garantindo que pertence ao usuario."""

    @abstractmethod
    async def list_conversations(
        self,
        *,
        user_id: UUID,
        limit: int,
        offset: int,
        status: ConversationStatus | None = None,
    ) -> list[Conversation]:
        """Lista conversas do usuario, ordenadas por created_at desc."""

    @abstractmethod
    async def count_conversations(
        self,
        *,
        user_id: UUID,
        status: ConversationStatus | None = None,
    ) -> int:
        """Total de conversas do usuario."""

    @abstractmethod
    async def update_conversation(self, conversation: Conversation) -> Conversation:
        """Persiste mudancas de estado em uma conversa existente."""

    @abstractmethod
    async def add_turn(self, turn: ConversationTurn) -> ConversationTurn:
        """Persiste um novo turno."""

    @abstractmethod
    async def list_turns(
        self, conversation_id: UUID, *, user_id: UUID
    ) -> list[ConversationTurn]:
        """Lista todos os turnos da conversa em ordem crescente de turn_index."""

    @abstractmethod
    async def count_turns(self, conversation_id: UUID) -> int:
        """Conta turnos persistidos na conversa."""

    @abstractmethod
    async def last_turns(
        self, conversation_id: UUID, *, limit: int
    ) -> list[ConversationTurn]:
        """Retorna os ultimos N turnos em ordem cronologica crescente."""


class TopicRepository(ABC):
    """Leitura de topicos pre-definidos."""

    @abstractmethod
    async def list_topics(self, *, limit: int = 30) -> list[ChatTopic]:
        """Retorna topicos ate o limite."""

    @abstractmethod
    async def count_topics(self) -> int:
        """Total de topicos."""

    @abstractmethod
    async def seed(self, topics: list[ChatTopic]) -> None:
        """Insere topicos se a tabela estiver vazia."""


class GoalRepository(ABC):
    """Leitura de metas pre-definidas."""

    @abstractmethod
    async def list_goals(self, *, limit: int = 30) -> list[ChatGoal]:
        """Retorna metas ate o limite."""

    @abstractmethod
    async def count_goals(self) -> int:
        """Total de metas."""

    @abstractmethod
    async def seed(self, goals: list[ChatGoal]) -> None:
        """Insere metas se a tabela estiver vazia."""


# ---------- porta de IA ----------


@dataclass(frozen=True, slots=True)
class TurnContext:
    """Contexto enviado ao AI_Tutor para gerar um turno."""

    user_message: str
    mode: str
    level: str
    topic: str | None
    goal: str | None
    history: list[tuple[str, str]] = field(default_factory=list)
    # Quando True, solicita avaliacao de meta atingida na mesma chamada.
    evaluate_goal: bool = False


@dataclass(frozen=True, slots=True)
class TurnResult:
    """Resultado retornado pelo AI_Tutor para um turno."""

    ai_reply: str
    feedback: TurnFeedback | None
    goal_achieved: bool = False


class ChatAIPort(ABC):
    """Porta de geracao de respostas e feedback pedagogico.

    O dominio nao sabe que por tras existe um LLM.
    """

    @abstractmethod
    async def generate_turn(self, context: TurnContext) -> TurnResult:
        """Gera resposta + feedback (e avaliacao de meta, se solicitado)."""
