"""Wiring da fatia chat: liga portas a adaptadores concretos."""

from __future__ import annotations

from functools import lru_cache
from typing import Annotated

from fastapi import Depends
from langchain_core.language_models import BaseChatModel
from langchain_google_genai import ChatGoogleGenerativeAI

from modules.chat.application.use_cases import (
    AbandonConversation,
    CompleteConversation,
    CreateConversation,
    GetChatStatus,
    GetTurns,
    ListConversations,
    ListGoals,
    ListTopics,
    SeedChatData,
    SendTurn,
)
from modules.chat.domain.ports import (
    ChatAIPort,
    ConversationRepository,
    GoalRepository,
    TopicRepository,
)
from modules.chat.infrastructure.gemini_tutor import GeminiChatTutor
from modules.chat.infrastructure.repository import (
    SqlAlchemyConversationRepository,
    SqlAlchemyGoalRepository,
    SqlAlchemyTopicRepository,
)
from shared.api.dependencies import SessionDep, SettingsDep

# ---------- repositorios ----------


def get_conversation_repository(session: SessionDep) -> ConversationRepository:
    return SqlAlchemyConversationRepository(session)


def get_topic_repository(session: SessionDep) -> TopicRepository:
    return SqlAlchemyTopicRepository(session)


def get_goal_repository(session: SessionDep) -> GoalRepository:
    return SqlAlchemyGoalRepository(session)


ConversationRepoDep = Annotated[ConversationRepository, Depends(get_conversation_repository)]
TopicRepoDep = Annotated[TopicRepository, Depends(get_topic_repository)]
GoalRepoDep = Annotated[GoalRepository, Depends(get_goal_repository)]


# ---------- chat model ----------


@lru_cache(maxsize=4)
def _build_chat_model(
    model: str, api_key: str, temperature: float, timeout: float, retries: int
) -> BaseChatModel:
    """Cacheado por configuracao para reutilizar conexoes."""
    return ChatGoogleGenerativeAI(
        model=model,
        google_api_key=api_key,
        temperature=temperature,
        timeout=timeout,
        max_retries=retries,
    )


def get_chat_ai(settings: SettingsDep) -> ChatAIPort | None:
    """Retorna o adaptador de IA ou None quando a chave nao esta configurada."""
    if not settings.is_ai_configured:
        return None
    assert settings.google_api_key is not None
    chat_model = _build_chat_model(
        settings.chat_ai_model,
        settings.google_api_key.get_secret_value(),
        settings.gemini_temperature,
        settings.chat_ai_timeout,
        settings.gemini_max_retries,
    )
    return GeminiChatTutor(chat_model)


ChatAIDep = Annotated[ChatAIPort | None, Depends(get_chat_ai)]


# ---------- casos de uso ----------


def get_chat_status_use_case(settings: SettingsDep) -> GetChatStatus:
    enabled = settings.is_ai_configured
    model: str | None = settings.chat_ai_model if enabled else None
    return GetChatStatus(enabled=enabled, model=model)


def get_list_topics_use_case(repo: TopicRepoDep) -> ListTopics:
    return ListTopics(repo)


def get_list_goals_use_case(repo: GoalRepoDep) -> ListGoals:
    return ListGoals(repo)


def get_create_conversation_use_case(repo: ConversationRepoDep) -> CreateConversation:
    return CreateConversation(repo)


def get_abandon_conversation_use_case(repo: ConversationRepoDep) -> AbandonConversation:
    return AbandonConversation(repo)


def get_complete_conversation_use_case(repo: ConversationRepoDep) -> CompleteConversation:
    return CompleteConversation(repo)


def get_list_conversations_use_case(repo: ConversationRepoDep) -> ListConversations:
    return ListConversations(repo)


def get_send_turn_use_case(
    repo: ConversationRepoDep,
    ai: ChatAIDep,
    settings: SettingsDep,
) -> SendTurn:
    from modules.chat.domain.errors import ChatAIUnavailable

    if ai is None:
        # Cria um adaptador que sempre levanta ChatAIUnavailable.
        class _DisabledTutor(ChatAIPort):
            async def generate_turn(self, context: object) -> object:  # type: ignore[override]
                raise ChatAIUnavailable("Servico de IA nao configurado.")

        effective_ai: ChatAIPort = _DisabledTutor()
    else:
        effective_ai = ai

    return SendTurn(repo, effective_ai, max_turn_limit=settings.chat_max_turn_limit)


def get_get_turns_use_case(repo: ConversationRepoDep) -> GetTurns:
    return GetTurns(repo)


def get_seed_use_case(topic_repo: TopicRepoDep, goal_repo: GoalRepoDep) -> SeedChatData:
    return SeedChatData(topic_repo, goal_repo)


ChatStatusDep = Annotated[GetChatStatus, Depends(get_chat_status_use_case)]
ListTopicsDep = Annotated[ListTopics, Depends(get_list_topics_use_case)]
ListGoalsDep = Annotated[ListGoals, Depends(get_list_goals_use_case)]
CreateConversationDep = Annotated[CreateConversation, Depends(get_create_conversation_use_case)]
AbandonConversationDep = Annotated[AbandonConversation, Depends(get_abandon_conversation_use_case)]
CompleteConversationDep = Annotated[
    CompleteConversation, Depends(get_complete_conversation_use_case)
]
ListConversationsDep = Annotated[ListConversations, Depends(get_list_conversations_use_case)]
SendTurnDep = Annotated[SendTurn, Depends(get_send_turn_use_case)]
GetTurnsDep = Annotated[GetTurns, Depends(get_get_turns_use_case)]
SeedChatDataDep = Annotated[SeedChatData, Depends(get_seed_use_case)]
