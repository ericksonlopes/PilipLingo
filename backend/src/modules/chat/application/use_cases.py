"""Casos de uso da fatia chat.

Uma classe por operacao, portas injetadas no __init__, sem commit nem HTTP.
"""

from __future__ import annotations

import logging

from modules.chat.application.dto import (
    AbandonConversationCommand,
    ChatStatusResult,
    ConversationPage,
    CreateConversationCommand,
    GetTurnsQuery,
    GoalsResult,
    ListConversationsQuery,
    SeedDataCommand,
    SendTurnCommand,
    SendTurnResult,
    TopicsResult,
)
from modules.chat.domain.entities import (
    ChatGoal,
    ChatTopic,
    Conversation,
    ConversationMode,
    ConversationStatus,
    ConversationTurn,
)
from modules.chat.domain.errors import ChatAIUnavailable
from modules.chat.domain.ports import (
    ChatAIPort,
    ConversationRepository,
    GoalRepository,
    TopicRepository,
    TurnContext,
)
from shared.domain.proficiency import ProficiencyLevel
from shared.errors import ConflictError, NotFoundError, ValidationError

logger = logging.getLogger(__name__)


class GetChatStatus:
    """Informa se o servico de IA esta disponivel."""

    def __init__(self, *, enabled: bool, model: str | None) -> None:
        self._enabled = enabled
        self._model = model

    async def execute(self) -> ChatStatusResult:
        return ChatStatusResult(enabled=self._enabled, model=self._model)


class ListTopics:
    """Lista topicos pre-definidos."""

    def __init__(self, repo: TopicRepository) -> None:
        self._repo = repo

    async def execute(self) -> TopicsResult:
        items = await self._repo.list_topics(limit=30)
        return TopicsResult(items=items)


class ListGoals:
    """Lista metas pre-definidas."""

    def __init__(self, repo: GoalRepository) -> None:
        self._repo = repo

    async def execute(self) -> GoalsResult:
        items = await self._repo.list_goals(limit=30)
        return GoalsResult(items=items)


class CreateConversation:
    """Cria uma nova conversa validando modalidade e campos obrigatorios."""

    def __init__(self, repo: ConversationRepository) -> None:
        self._repo = repo

    async def execute(self, command: CreateConversationCommand) -> Conversation:
        try:
            mode = ConversationMode(command.mode)
        except ValueError as exc:
            raise ValidationError(
                f"Modalidade invalida: '{command.mode}'. Use FREE, TOPIC ou GOAL."
            ) from exc
        try:
            level = ProficiencyLevel(command.level)
        except ValueError as exc:
            raise ValidationError(
                f"Nivel invalido: '{command.level}'. Use A1, A2, B1, B2, C1 ou C2."
            ) from exc

        conversation = Conversation.create(
            user_id=command.user_id,
            mode=mode,
            level=level,
            topic=command.topic,
            goal=command.goal,
        )
        return await self._repo.add_conversation(conversation)


class AbandonConversation:
    """Abandona (soft delete) uma conversa ativa."""

    def __init__(self, repo: ConversationRepository) -> None:
        self._repo = repo

    async def execute(self, command: AbandonConversationCommand) -> None:
        conv = await self._repo.get_conversation(
            command.conversation_id, user_id=command.user_id
        )
        if conv is None:
            raise NotFoundError("Conversa nao encontrada.")
        conv.abandon()
        await self._repo.update_conversation(conv)


class ListConversations:
    """Lista conversas do usuario com paginacao."""

    def __init__(self, repo: ConversationRepository) -> None:
        self._repo = repo

    async def execute(self, query: ListConversationsQuery) -> ConversationPage:
        if query.limit < 1 or query.limit > 100:
            raise ValidationError("'limit' deve ser entre 1 e 100.")
        if query.offset < 0:
            raise ValidationError("'offset' deve ser maior ou igual a 0.")

        status: ConversationStatus | None = None
        if query.status is not None:
            try:
                status = ConversationStatus(query.status)
            except ValueError as exc:
                raise ValidationError(f"Status invalido: '{query.status}'.") from exc

        items = await self._repo.list_conversations(
            user_id=query.user_id,
            limit=query.limit,
            offset=query.offset,
            status=status,
        )
        total = await self._repo.count_conversations(
            user_id=query.user_id,
            status=status,
        )
        return ConversationPage(
            items=items,
            total=total,
            limit=query.limit,
            offset=query.offset,
        )


class SendTurn:
    """Envia mensagem, chama IA, persiste turno e atualiza estado da conversa."""

    def __init__(
        self,
        repo: ConversationRepository,
        ai: ChatAIPort,
        max_turn_limit: int = 40,
    ) -> None:
        self._repo = repo
        self._ai = ai
        self._max_turn_limit = max_turn_limit

    async def execute(self, command: SendTurnCommand) -> SendTurnResult:
        conv = await self._repo.get_conversation(
            command.conversation_id, user_id=command.user_id
        )
        if conv is None or conv.status != ConversationStatus.ACTIVE:
            raise ConflictError(
                "Conversa nao encontrada ou nao esta ativa."
            )

        # Historico dos ultimos 10 turnos para contexto da IA.
        history_turns = await self._repo.last_turns(conv.id, limit=10)
        history = [(t.user_message, t.ai_reply) for t in history_turns]

        evaluate_goal = conv.mode == ConversationMode.GOAL

        context = TurnContext(
            user_message=command.user_message,
            mode=conv.mode.value,
            level=conv.level.value,
            topic=conv.topic,
            goal=conv.goal,
            history=history,
            evaluate_goal=evaluate_goal,
        )

        try:
            result = await self._ai.generate_turn(context)
        except ChatAIUnavailable:
            raise
        except Exception as exc:
            logger.warning("[chat] falha no AI_Tutor: %s: %s", type(exc).__name__, exc)
            raise ChatAIUnavailable(
                "O servico de IA nao respondeu. Tente novamente em alguns instantes."
            ) from exc

        # Conta turnos ja existentes para calcular turn_index e checar limite.
        turn_count = await self._repo.count_turns(conv.id)
        turn_index = turn_count + 1

        turn = ConversationTurn.create(
            conversation_id=conv.id,
            turn_index=turn_index,
            user_message=command.user_message,
            ai_reply=result.ai_reply,
            feedback=result.feedback,
        )
        await self._repo.add_turn(turn)

        conversation_completed = False
        goal_achieved = False

        if result.goal_achieved and conv.mode == ConversationMode.GOAL:
            conv.complete(goal_achieved=True)
            await self._repo.update_conversation(conv)
            conversation_completed = True
            goal_achieved = True
        elif turn_index >= self._max_turn_limit:
            conv.complete(goal_achieved=False)
            await self._repo.update_conversation(conv)
            conversation_completed = True

        return SendTurnResult(
            turn=turn,
            conversation_completed=conversation_completed,
            goal_achieved=goal_achieved,
        )


class GetTurns:
    """Lista todos os turnos de uma conversa."""

    def __init__(self, repo: ConversationRepository) -> None:
        self._repo = repo

    async def execute(self, query: GetTurnsQuery) -> list[ConversationTurn]:
        conv = await self._repo.get_conversation(
            query.conversation_id, user_id=query.user_id
        )
        if conv is None:
            raise NotFoundError("Conversa nao encontrada.")
        return await self._repo.list_turns(query.conversation_id, user_id=query.user_id)


class SeedChatData:
    """Popula topicos e metas na primeira inicializacao."""

    def __init__(self, topics_repo: TopicRepository, goals_repo: GoalRepository) -> None:
        self._topics_repo = topics_repo
        self._goals_repo = goals_repo

    async def execute(self, command: SeedDataCommand) -> None:
        topic_entities = [
            ChatTopic.create(
                label=label,
                description=description,
                level_hint=ProficiencyLevel(level_hint),
            )
            for label, description, level_hint in command.topics
        ]
        await self._topics_repo.seed(topic_entities)

        goal_entities = [
            ChatGoal.create(
                label=label,
                description=description,
                level_hint=ProficiencyLevel(level_hint),
            )
            for label, description, level_hint in command.goals
        ]
        await self._goals_repo.seed(goal_entities)
