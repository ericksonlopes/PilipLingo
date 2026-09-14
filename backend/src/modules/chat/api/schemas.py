"""Schemas Pydantic da fatia chat: request/response HTTP."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from modules.chat.application.dto import ConversationPage, SendTurnResult
from modules.chat.domain.entities import (
    ChatGoal,
    ChatTopic,
    Conversation,
    ConversationMode,
    ConversationTurn,
    TurnFeedback,
)

# ---------- resposta de status ----------


class ChatStatusResponse(BaseModel):
    """Estado de disponibilidade do servico de IA."""

    enabled: bool
    model: str | None


# ---------- topicos e metas ----------


class ChatTopicResponse(BaseModel):
    id: UUID
    label: str
    description: str
    level_hint: str

    @classmethod
    def from_entity(cls, entity: ChatTopic) -> ChatTopicResponse:
        return cls(
            id=entity.id,
            label=entity.label,
            description=entity.description,
            level_hint=entity.level_hint.value,
        )


class ChatGoalResponse(BaseModel):
    id: UUID
    label: str
    description: str
    level_hint: str

    @classmethod
    def from_entity(cls, entity: ChatGoal) -> ChatGoalResponse:
        return cls(
            id=entity.id,
            label=entity.label,
            description=entity.description,
            level_hint=entity.level_hint.value,
        )


# ---------- conversas ----------


class CreateConversationRequest(BaseModel):
    mode: ConversationMode
    level: str = Field(min_length=2, max_length=2)
    topic: str | None = Field(default=None, max_length=500)
    goal: str | None = Field(default=None, max_length=500)


class ConversationResponse(BaseModel):
    id: UUID
    user_id: UUID
    mode: str
    level: str
    topic: str | None
    goal: str | None
    goal_status: str
    status: str
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_entity(cls, entity: Conversation) -> ConversationResponse:
        return cls(
            id=entity.id,
            user_id=entity.user_id,
            mode=entity.mode.value,
            level=entity.level.value,
            topic=entity.topic,
            goal=entity.goal,
            goal_status=entity.goal_status.value,
            status=entity.status.value,
            created_at=entity.created_at,
            updated_at=entity.updated_at,
        )


class ConversationListResponse(BaseModel):
    items: list[ConversationResponse]
    total: int
    limit: int
    offset: int

    @classmethod
    def from_page(cls, page: ConversationPage) -> ConversationListResponse:
        return cls(
            items=[ConversationResponse.from_entity(c) for c in page.items],
            total=page.total,
            limit=page.limit,
            offset=page.offset,
        )


# ---------- turnos ----------


class FeedbackCorrectionResponse(BaseModel):
    original: str
    corrected: str
    explanation: str


class TurnFeedbackResponse(BaseModel):
    corrections: list[FeedbackCorrectionResponse]
    suggestion: str | None

    @classmethod
    def from_entity(cls, entity: TurnFeedback) -> TurnFeedbackResponse:
        return cls(
            corrections=[
                FeedbackCorrectionResponse(
                    original=c.original,
                    corrected=c.corrected,
                    explanation=c.explanation,
                )
                for c in entity.corrections
            ],
            suggestion=entity.suggestion,
        )


class TurnResponse(BaseModel):
    id: UUID
    conversation_id: UUID
    turn_index: int
    user_message: str
    ai_reply: str
    feedback: TurnFeedbackResponse | None
    created_at: datetime

    @classmethod
    def from_entity(cls, entity: ConversationTurn) -> TurnResponse:
        return cls(
            id=entity.id,
            conversation_id=entity.conversation_id,
            turn_index=entity.turn_index,
            user_message=entity.user_message,
            ai_reply=entity.ai_reply,
            feedback=(
                TurnFeedbackResponse.from_entity(entity.feedback)
                if entity.feedback
                else None
            ),
            created_at=entity.created_at,
        )


class SendTurnRequest(BaseModel):
    user_message: str = Field(min_length=1, max_length=1000)


class SendTurnResponse(BaseModel):
    turn: TurnResponse
    conversation_completed: bool
    goal_achieved: bool

    @classmethod
    def from_result(cls, result: SendTurnResult) -> SendTurnResponse:
        return cls(
            turn=TurnResponse.from_entity(result.turn),
            conversation_completed=result.conversation_completed,
            goal_achieved=result.goal_achieved,
        )
