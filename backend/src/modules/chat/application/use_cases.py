"""Use cases for chat slice.

One class per operation, ports injected in __init__, no commit or HTTP.
"""

from __future__ import annotations

import logging

from modules.chat.application.dto import (
    AbandonConversationCommand,
    ChatStatusResult,
    CompleteConversationCommand,
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
    GoalStatus,
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
    """Informs whether AI service is available."""

    def __init__(self, *, enabled: bool, model: str | None) -> None:
        self._enabled = enabled
        self._model = model

    async def execute(self) -> ChatStatusResult:
        return ChatStatusResult(enabled=self._enabled, model=self._model)


class ListTopics:
    """Lists predefined topics."""

    def __init__(self, repo: TopicRepository) -> None:
        self._repo = repo

    async def execute(self) -> TopicsResult:
        items = await self._repo.list_topics(limit=30)
        return TopicsResult(items=items)


class ListGoals:
    """Lists predefined goals."""

    def __init__(self, repo: GoalRepository) -> None:
        self._repo = repo

    async def execute(self) -> GoalsResult:
        items = await self._repo.list_goals(limit=30)
        return GoalsResult(items=items)


class CreateConversation:
    """Creates a new conversation validating mode and required fields."""

    def __init__(self, repo: ConversationRepository) -> None:
        self._repo = repo

    async def execute(self, command: CreateConversationCommand) -> Conversation:
        try:
            mode = ConversationMode(command.mode)
        except ValueError as exc:
            raise ValidationError(
                f"Invalid mode: '{command.mode}'. Use FREE, TOPIC, or GOAL."
            ) from exc
        try:
            level = ProficiencyLevel(command.level)
        except ValueError as exc:
            raise ValidationError(
                f"Invalid level: '{command.level}'. Use A1, A2, B1, B2, C1, or C2."
            ) from exc

        conversation = Conversation.create(
            user_id=command.user_id,
            mode=mode,
            level=level,
            topic=command.topic,
            goal=command.goal,
            goals=command.goals,
        )
        return await self._repo.add_conversation(conversation)


class CompleteConversation:
    """Explicitly completes an active conversation."""

    def __init__(self, repo: ConversationRepository) -> None:
        self._repo = repo

    async def execute(self, command: CompleteConversationCommand) -> Conversation:
        conv = await self._repo.get_conversation(
            command.conversation_id, user_id=command.user_id
        )
        if conv is None:
            raise NotFoundError("Conversation not found.")
        conv.complete()
        return await self._repo.update_conversation(conv)


class AbandonConversation:
    """Abandons (soft delete) an active conversation."""

    def __init__(self, repo: ConversationRepository) -> None:
        self._repo = repo

    async def execute(self, command: AbandonConversationCommand) -> None:
        conv = await self._repo.get_conversation(
            command.conversation_id, user_id=command.user_id
        )
        if conv is None:
            raise NotFoundError("Conversation not found.")
        conv.abandon()
        await self._repo.update_conversation(conv)


class ListConversations:
    """Lists user conversations with pagination."""

    def __init__(self, repo: ConversationRepository) -> None:
        self._repo = repo

    async def execute(self, query: ListConversationsQuery) -> ConversationPage:
        if query.limit < 1 or query.limit > 100:
            raise ValidationError("'limit' must be between 1 and 100.")
        if query.offset < 0:
            raise ValidationError("'offset' must be greater than or equal to 0.")

        status: ConversationStatus | None = None
        if query.status is not None:
            try:
                status = ConversationStatus(query.status)
            except ValueError as exc:
                raise ValidationError(f"Invalid status: '{query.status}'.") from exc

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
    """Sends message, calls AI, persists turn, and updates conversation state."""

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
                "Conversation not found or not active."
            )

        # History of last 10 turns for AI context.
        history_turns = await self._repo.last_turns(conv.id, limit=10)
        history = [(t.user_message, t.ai_reply) for t in history_turns]

        evaluate_goal = conv.mode == ConversationMode.GOAL

        context = TurnContext(
            user_message=command.user_message,
            mode=conv.mode.value,
            level=conv.level.value,
            topic=conv.topic,
            goal=conv.goal,
            goals=conv.goals,
            goals_progress=conv.goals_progress,
            history=history,
            evaluate_goal=evaluate_goal,
        )

        try:
            result = await self._ai.generate_turn(context)
        except ChatAIUnavailable:
            raise
        except Exception as exc:
            logger.warning("[chat] AI_Tutor failed: %s: %s", type(exc).__name__, exc)
            raise ChatAIUnavailable(
                "AI service did not respond. Please try again in a few moments."
            ) from exc

        # Count existing turns to compute turn_index and check limit.
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

        if conv.mode == ConversationMode.GOAL:
            current_progress = list(conv.goals_progress or [False] * len(conv.goals))
            for i, is_achieved in enumerate(result.goals_progress):
                if i < len(current_progress) and is_achieved:
                    current_progress[i] = True
            conv.goals_progress = current_progress

            if (current_progress and all(current_progress)) or result.goal_achieved:
                conv.goal_status = GoalStatus.ACHIEVED
                goal_achieved = True

            await self._repo.update_conversation(conv)

        if turn_index >= self._max_turn_limit:
            conv.complete(goal_achieved=goal_achieved)
            await self._repo.update_conversation(conv)
            conversation_completed = True

        return SendTurnResult(
            turn=turn,
            conversation_completed=conversation_completed,
            goal_achieved=goal_achieved,
            goals_progress=conv.goals_progress,
        )


class GetTurns:
    """Lists all turns of a conversation."""

    def __init__(self, repo: ConversationRepository) -> None:
        self._repo = repo

    async def execute(self, query: GetTurnsQuery) -> list[ConversationTurn]:
        conv = await self._repo.get_conversation(
            query.conversation_id, user_id=query.user_id
        )
        if conv is None:
            raise NotFoundError("Conversation not found.")
        return await self._repo.list_turns(query.conversation_id, user_id=query.user_id)


class SeedChatData:
    """Populates topics and goals on first initialization."""

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
                label=lbl,
                description=desc,
                level_hint=ProficiencyLevel(lvl),
                targets=tgts,
            )
            for lbl, desc, lvl, tgts in command.goals
        ]
        await self._goals_repo.seed(goal_entities)
