"""Rotas HTTP da fatia chat.

Ordem importa: caminhos fixos declarados antes de parametros UUID para o FastAPI
nao confundir "status" com um UUID.
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, Response, status

from modules.chat.api.dependencies import (
    AbandonConversationDep,
    ChatStatusDep,
    CompleteConversationDep,
    CreateConversationDep,
    GetTurnsDep,
    ListConversationsDep,
    ListGoalsDep,
    ListTopicsDep,
    SendTurnDep,
)
from modules.chat.api.schemas import (
    ChatGoalResponse,
    ChatStatusResponse,
    ChatTopicResponse,
    ConversationListResponse,
    ConversationResponse,
    CreateConversationRequest,
    SendTurnRequest,
    SendTurnResponse,
    TurnResponse,
)
from modules.chat.application.dto import (
    AbandonConversationCommand,
    CompleteConversationCommand,
    CreateConversationCommand,
    GetTurnsQuery,
    ListConversationsQuery,
    SendTurnCommand,
)
from modules.users.api.dependencies import CurrentUserDep

router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/status", response_model=ChatStatusResponse, summary="Status do servico de IA do chat")
async def chat_status(use_case: ChatStatusDep) -> ChatStatusResponse:
    result = await use_case.execute()
    return ChatStatusResponse(enabled=result.enabled, model=result.model)


@router.get("/topics", response_model=list[ChatTopicResponse], summary="Topicos pre-definidos")
async def list_topics(use_case: ListTopicsDep) -> list[ChatTopicResponse]:
    result = await use_case.execute()
    return [ChatTopicResponse.from_entity(t) for t in result.items]


@router.get("/goals", response_model=list[ChatGoalResponse], summary="Metas pre-definidas")
async def list_goals(use_case: ListGoalsDep) -> list[ChatGoalResponse]:
    result = await use_case.execute()
    return [ChatGoalResponse.from_entity(g) for g in result.items]


@router.post(
    "/conversations",
    response_model=ConversationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Cria uma nova conversa",
)
async def create_conversation(
    payload: CreateConversationRequest,
    use_case: CreateConversationDep,
    user: CurrentUserDep,
) -> ConversationResponse:
    command = CreateConversationCommand(
        user_id=user.id,
        mode=payload.mode.value,
        level=payload.level,
        topic=payload.topic,
        goal=payload.goal,
        goals=payload.goals,
    )
    conversation = await use_case.execute(command)
    return ConversationResponse.from_entity(conversation)


@router.get(
    "/conversations",
    response_model=ConversationListResponse,
    summary="Lista conversas do usuario",
)
async def list_conversations(
    use_case: ListConversationsDep,
    user: CurrentUserDep,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
    status_filter: Annotated[str | None, Query(alias="status")] = None,
) -> ConversationListResponse:
    query = ListConversationsQuery(
        user_id=user.id,
        limit=limit,
        offset=offset,
        status=status_filter,
    )
    page = await use_case.execute(query)
    return ConversationListResponse.from_page(page)


@router.post(
    "/conversations/{conversation_id}/complete",
    response_model=ConversationResponse,
    summary="Conclui uma conversa ativa",
    responses={
        404: {"description": "Conversa nao encontrada"},
    },
)
async def complete_conversation(
    conversation_id: UUID,
    use_case: CompleteConversationDep,
    user: CurrentUserDep,
) -> ConversationResponse:
    conv = await use_case.execute(
        CompleteConversationCommand(conversation_id=conversation_id, user_id=user.id)
    )
    return ConversationResponse.from_entity(conv)


@router.delete(
    "/conversations/{conversation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Abandona uma conversa ativa",
    responses={
        404: {"description": "Conversa nao encontrada"},
        409: {"description": "Conversa ja encerrada ou abandonada"},
    },
)
async def abandon_conversation(
    conversation_id: UUID,
    use_case: AbandonConversationDep,
    user: CurrentUserDep,
) -> Response:
    await use_case.execute(
        AbandonConversationCommand(conversation_id=conversation_id, user_id=user.id)
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/conversations/{conversation_id}/turns",
    response_model=SendTurnResponse,
    summary="Envia mensagem e recebe resposta da IA",
    responses={
        409: {"description": "Conversa nao esta ativa"},
        503: {"description": "Servico de IA indisponivel"},
    },
)
async def send_turn(
    conversation_id: UUID,
    payload: SendTurnRequest,
    use_case: SendTurnDep,
    user: CurrentUserDep,
) -> SendTurnResponse:
    result = await use_case.execute(
        SendTurnCommand(
            conversation_id=conversation_id,
            user_id=user.id,
            user_message=payload.user_message,
        )
    )
    return SendTurnResponse.from_result(result)


@router.get(
    "/conversations/{conversation_id}/turns",
    response_model=list[TurnResponse],
    summary="Lista todos os turnos de uma conversa",
    responses={404: {"description": "Conversa nao encontrada"}},
)
async def list_turns(
    conversation_id: UUID,
    use_case: GetTurnsDep,
    user: CurrentUserDep,
) -> list[TurnResponse]:
    turns = await use_case.execute(
        GetTurnsQuery(conversation_id=conversation_id, user_id=user.id)
    )
    return [TurnResponse.from_entity(t) for t in turns]
