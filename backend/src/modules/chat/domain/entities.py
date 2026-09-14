"""Entidades e value objects da fatia chat. Sem dependencia de framework ou ORM."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from enum import StrEnum
from uuid import UUID, uuid4

from shared.domain.proficiency import ProficiencyLevel
from shared.errors import ValidationError

# ---------- constantes de dominio ----------

MAX_USER_MESSAGE_LENGTH = 1000
MAX_TOPIC_LABEL_LENGTH = 60
MAX_TOPIC_DESCRIPTION_LENGTH = 255
MAX_GOAL_LABEL_LENGTH = 60
MAX_GOAL_DESCRIPTION_LENGTH = 255
MAX_FEEDBACK_CORRECTION_EXPLANATION_LENGTH = 500
MAX_FEEDBACK_SUGGESTION_LENGTH = 280
MAX_FEEDBACK_CORRECTIONS = 3
MAX_GOAL_LENGTH = 500  # meta customizada enviada pelo usuario


class ConversationMode(StrEnum):
    """Modalidade de conversa."""

    FREE = "FREE"
    TOPIC = "TOPIC"
    GOAL = "GOAL"


class ConversationStatus(StrEnum):
    """Estado de ciclo de vida da conversa."""

    ACTIVE = "active"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


class GoalStatus(StrEnum):
    """Progresso em relacao a meta comunicativa."""

    IN_PROGRESS = "in_progress"
    ACHIEVED = "achieved"
    ABANDONED = "abandoned"


# ---------- value objects ----------


@dataclass(frozen=True, slots=True)
class FeedbackCorrection:
    """Uma correcao gramatical ou de vocabulario encontrada na mensagem do aluno."""

    original: str
    corrected: str
    explanation: str


@dataclass(frozen=True, slots=True)
class TurnFeedback:
    """Analise pedagogica gerada pela IA para um turno."""

    corrections: list[FeedbackCorrection]
    suggestion: str | None


# ---------- entidades principais ----------


@dataclass(slots=True)
class Conversation:
    """Sessao de conversa entre o aluno e a IA."""

    id: UUID
    user_id: UUID
    mode: ConversationMode
    level: ProficiencyLevel
    topic: str | None
    goal: str | None
    goal_status: GoalStatus
    status: ConversationStatus
    created_at: datetime
    updated_at: datetime

    @classmethod
    def create(
        cls,
        *,
        user_id: UUID,
        mode: ConversationMode,
        level: ProficiencyLevel,
        topic: str | None = None,
        goal: str | None = None,
    ) -> Conversation:
        """Fabrica com validacao das invariantes."""
        if mode == ConversationMode.TOPIC and not (topic or "").strip():
            raise ValidationError("'topic' e obrigatorio para conversas no modo TOPIC.")
        if mode == ConversationMode.GOAL and not (goal or "").strip():
            raise ValidationError("'goal' e obrigatorio para conversas no modo GOAL.")
        if goal and len(goal.strip()) > MAX_GOAL_LENGTH:
            raise ValidationError(f"'goal' excede {MAX_GOAL_LENGTH} caracteres.")

        now = datetime.now(UTC)
        return cls(
            id=uuid4(),
            user_id=user_id,
            mode=mode,
            level=level,
            topic=topic.strip() if topic else None,
            goal=goal.strip() if goal else None,
            goal_status=GoalStatus.IN_PROGRESS,
            status=ConversationStatus.ACTIVE,
            created_at=now,
            updated_at=now,
        )

    def abandon(self) -> None:
        """Marca a conversa como abandonada."""
        if self.status != ConversationStatus.ACTIVE:
            from modules.chat.domain.errors import InvalidConversationState

            raise InvalidConversationState(
                f"Conversa nao pode ser abandonada: status atual e '{self.status}'."
            )
        self.status = ConversationStatus.ABANDONED
        self.goal_status = GoalStatus.ABANDONED
        self.updated_at = datetime.now(UTC)

    def complete(self, *, goal_achieved: bool = False) -> None:
        """Marca a conversa como concluida."""
        self.status = ConversationStatus.COMPLETED
        if goal_achieved:
            self.goal_status = GoalStatus.ACHIEVED
        self.updated_at = datetime.now(UTC)


@dataclass(slots=True)
class ConversationTurn:
    """Par mensagem-do-aluno / resposta-da-IA dentro de uma Conversation."""

    id: UUID
    conversation_id: UUID
    turn_index: int
    user_message: str
    ai_reply: str
    feedback: TurnFeedback | None
    created_at: datetime

    @classmethod
    def create(
        cls,
        *,
        conversation_id: UUID,
        turn_index: int,
        user_message: str,
        ai_reply: str,
        feedback: TurnFeedback | None,
    ) -> ConversationTurn:
        """Fabrica que valida a mensagem do aluno."""
        msg = (user_message or "").strip()
        if not msg:
            raise ValidationError("'user_message' nao pode ser vazio.")
        if len(msg) > MAX_USER_MESSAGE_LENGTH:
            raise ValidationError(
                f"'user_message' excede {MAX_USER_MESSAGE_LENGTH} caracteres."
            )
        now = datetime.now(UTC)
        return cls(
            id=uuid4(),
            conversation_id=conversation_id,
            turn_index=turn_index,
            user_message=msg,
            ai_reply=ai_reply,
            feedback=feedback,
            created_at=now,
        )


@dataclass(slots=True)
class ChatTopic:
    """Topico pre-definido de conversa (modalidade TOPIC)."""

    id: UUID
    label: str
    description: str
    level_hint: ProficiencyLevel

    @classmethod
    def create(
        cls,
        *,
        label: str,
        description: str,
        level_hint: ProficiencyLevel,
    ) -> ChatTopic:
        lbl = (label or "").strip()
        if not lbl or len(lbl) > MAX_TOPIC_LABEL_LENGTH:
            raise ValidationError(
                f"'label' do topico deve ter entre 1 e {MAX_TOPIC_LABEL_LENGTH} caracteres."
            )
        desc = (description or "").strip()
        if not desc or len(desc) > MAX_TOPIC_DESCRIPTION_LENGTH:
            raise ValidationError(
                f"'description' do topico deve ter entre 1 e "
                f"{MAX_TOPIC_DESCRIPTION_LENGTH} caracteres."
            )
        return cls(id=uuid4(), label=lbl, description=desc, level_hint=level_hint)


@dataclass(slots=True)
class ChatGoal:
    """Meta comunicativa pre-definida (modalidade GOAL)."""

    id: UUID
    label: str
    description: str
    level_hint: ProficiencyLevel

    @classmethod
    def create(
        cls,
        *,
        label: str,
        description: str,
        level_hint: ProficiencyLevel,
    ) -> ChatGoal:
        lbl = (label or "").strip()
        if not lbl or len(lbl) > MAX_GOAL_LABEL_LENGTH:
            raise ValidationError(
                f"'label' da meta deve ter entre 1 e {MAX_GOAL_LABEL_LENGTH} caracteres."
            )
        desc = (description or "").strip()
        if not desc or len(desc) > MAX_GOAL_DESCRIPTION_LENGTH:
            raise ValidationError(
                f"'description' da meta deve ter entre 1 e "
                f"{MAX_GOAL_DESCRIPTION_LENGTH} caracteres."
            )
        return cls(id=uuid4(), label=lbl, description=desc, level_hint=level_hint)
