"""Conversao entre modelos ORM e entidades de dominio da fatia chat."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from modules.chat.domain.entities import (
    ChatGoal,
    ChatTopic,
    Conversation,
    ConversationMode,
    ConversationStatus,
    ConversationTurn,
    FeedbackCorrection,
    GoalStatus,
    TurnFeedback,
)
from modules.chat.infrastructure.models import (
    ChatGoalModel,
    ChatTopicModel,
    ConversationModel,
    ConversationTurnModel,
)
from shared.domain.proficiency import ProficiencyLevel


def _as_utc(dt: datetime) -> datetime:
    """Reanexar UTC porque SQLite nao persiste timezone."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt


# ---------- conversation ----------


def conversation_to_model(entity: Conversation) -> ConversationModel:
    return ConversationModel(
        id=entity.id,
        user_id=entity.user_id,
        mode=entity.mode.value,
        level=entity.level.value,
        topic=entity.topic,
        goal=entity.goal,
        goals=entity.goals,
        goals_progress=entity.goals_progress,
        goal_status=entity.goal_status.value,
        status=entity.status.value,
        created_at=entity.created_at,
        updated_at=entity.updated_at,
    )


def conversation_to_domain(model: ConversationModel) -> Conversation:
    return Conversation(
        id=model.id,
        user_id=model.user_id,
        mode=ConversationMode(model.mode),
        level=ProficiencyLevel(model.level),
        topic=model.topic,
        goal=model.goal,
        goals=list(model.goals) if model.goals else [],
        goals_progress=list(model.goals_progress) if model.goals_progress else [],
        goal_status=GoalStatus(model.goal_status),
        status=ConversationStatus(model.status),
        created_at=_as_utc(model.created_at),
        updated_at=_as_utc(model.updated_at),
    )


def apply_conversation_to_model(model: ConversationModel, entity: Conversation) -> None:
    """Aplica mudancas de estado da entidade no model existente."""
    model.goals = entity.goals
    model.goals_progress = entity.goals_progress
    model.goal_status = entity.goal_status.value
    model.status = entity.status.value
    model.updated_at = entity.updated_at


# ---------- turn ----------


def _feedback_to_json(feedback: TurnFeedback) -> dict[str, Any]:
    return {
        "corrections": [
            {
                "original": c.original,
                "corrected": c.corrected,
                "explanation": c.explanation,
            }
            for c in feedback.corrections
        ],
        "suggestion": feedback.suggestion,
    }


def _feedback_from_json(data: Any) -> TurnFeedback | None:
    if data is None:
        return None
    try:
        corrections = [
            FeedbackCorrection(
                original=item["original"],
                corrected=item["corrected"],
                explanation=item["explanation"],
            )
            for item in (data.get("corrections") or [])
        ]
        return TurnFeedback(
            corrections=corrections,
            suggestion=data.get("suggestion"),
        )
    except Exception:  # noqa: BLE001 - JSON malformado nao deve travar a leitura
        return None


def turn_to_model(entity: ConversationTurn) -> ConversationTurnModel:
    return ConversationTurnModel(
        id=entity.id,
        conversation_id=entity.conversation_id,
        turn_index=entity.turn_index,
        user_message=entity.user_message,
        ai_reply=entity.ai_reply,
        feedback=_feedback_to_json(entity.feedback) if entity.feedback else None,
        created_at=entity.created_at,
    )


def turn_to_domain(model: ConversationTurnModel) -> ConversationTurn:
    return ConversationTurn(
        id=model.id,
        conversation_id=model.conversation_id,
        turn_index=model.turn_index,
        user_message=model.user_message,
        ai_reply=model.ai_reply,
        feedback=_feedback_from_json(model.feedback),
        created_at=_as_utc(model.created_at),
    )


# ---------- topic ----------


def topic_to_model(entity: ChatTopic) -> ChatTopicModel:
    return ChatTopicModel(
        id=entity.id,
        label=entity.label,
        description=entity.description,
        level_hint=entity.level_hint.value,
    )


def topic_to_domain(model: ChatTopicModel) -> ChatTopic:
    return ChatTopic(
        id=model.id,
        label=model.label,
        description=model.description,
        level_hint=ProficiencyLevel(model.level_hint),
    )


# ---------- goal ----------


def goal_to_model(entity: ChatGoal) -> ChatGoalModel:
    return ChatGoalModel(
        id=entity.id,
        label=entity.label,
        description=entity.description,
        level_hint=entity.level_hint.value,
        targets=entity.targets,
    )


def goal_to_domain(model: ChatGoalModel) -> ChatGoal:
    return ChatGoal(
        id=model.id,
        label=model.label,
        description=model.description,
        level_hint=ProficiencyLevel(model.level_hint),
        targets=list(model.targets) if model.targets else [],
    )
