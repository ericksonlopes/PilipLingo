"""SQLAlchemy adapter for chat slice persistence ports."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from modules.chat.domain.entities import (
    ChatGoal,
    ChatTopic,
    Conversation,
    ConversationStatus,
    ConversationTurn,
)
from modules.chat.domain.ports import (
    ConversationRepository,
    GoalRepository,
    TopicRepository,
)
from modules.chat.infrastructure.mappers import (
    apply_conversation_to_model,
    conversation_to_domain,
    conversation_to_model,
    goal_to_domain,
    goal_to_model,
    topic_to_domain,
    topic_to_model,
    turn_to_domain,
    turn_to_model,
)
from modules.chat.infrastructure.models import (
    ChatGoalModel,
    ChatTopicModel,
    ConversationModel,
    ConversationTurnModel,
)


class SqlAlchemyConversationRepository(ConversationRepository):
    """Persists conversations and turns via async SQLAlchemy.

    Commit is the responsibility of get_session; here only flush.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add_conversation(self, conversation: Conversation) -> Conversation:
        model = conversation_to_model(conversation)
        self._session.add(model)
        await self._session.flush()
        return conversation_to_domain(model)

    async def get_conversation(
        self, conversation_id: UUID, *, user_id: UUID
    ) -> Conversation | None:
        model = await self._session.get(ConversationModel, conversation_id)
        if model is None or model.user_id != user_id:
            return None
        return conversation_to_domain(model)

    async def list_conversations(
        self,
        *,
        user_id: UUID,
        limit: int,
        offset: int,
        status: ConversationStatus | None = None,
    ) -> list[Conversation]:
        stmt = select(ConversationModel).where(ConversationModel.user_id == user_id)
        if status is not None:
            stmt = stmt.where(ConversationModel.status == status.value)
        stmt = stmt.order_by(ConversationModel.created_at.desc()).limit(limit).offset(offset)
        rows = (await self._session.execute(stmt)).scalars().all()
        return [conversation_to_domain(row) for row in rows]

    async def count_conversations(
        self,
        *,
        user_id: UUID,
        status: ConversationStatus | None = None,
    ) -> int:
        stmt = select(func.count()).select_from(ConversationModel).where(
            ConversationModel.user_id == user_id
        )
        if status is not None:
            stmt = stmt.where(ConversationModel.status == status.value)
        return int((await self._session.execute(stmt)).scalar_one())

    async def update_conversation(self, conversation: Conversation) -> Conversation:
        model = await self._session.get(ConversationModel, conversation.id)
        if model is None:
            raise LookupError(f"ConversationModel {conversation.id} not found.")
        apply_conversation_to_model(model, conversation)
        await self._session.flush()
        return conversation_to_domain(model)

    async def add_turn(self, turn: ConversationTurn) -> ConversationTurn:
        model = turn_to_model(turn)
        self._session.add(model)
        await self._session.flush()
        return turn_to_domain(model)

    async def list_turns(
        self, conversation_id: UUID, *, user_id: UUID
    ) -> list[ConversationTurn]:
        stmt = (
            select(ConversationTurnModel)
            .where(ConversationTurnModel.conversation_id == conversation_id)
            .order_by(ConversationTurnModel.turn_index.asc())
        )
        rows = (await self._session.execute(stmt)).scalars().all()
        return [turn_to_domain(row) for row in rows]

    async def count_turns(self, conversation_id: UUID) -> int:
        stmt = (
            select(func.count())
            .select_from(ConversationTurnModel)
            .where(ConversationTurnModel.conversation_id == conversation_id)
        )
        return int((await self._session.execute(stmt)).scalar_one())

    async def last_turns(
        self, conversation_id: UUID, *, limit: int
    ) -> list[ConversationTurn]:
        """Returns the last N turns in ascending chronological order."""
        # Simple strategy: fetch all and slice in Python (conversation max 40 turns).
        stmt = (
            select(ConversationTurnModel)
            .where(ConversationTurnModel.conversation_id == conversation_id)
            .order_by(ConversationTurnModel.turn_index.desc())
            .limit(limit)
        )
        rows = list((await self._session.execute(stmt)).scalars().all())
        # Reorder ascending before returning.
        rows.sort(key=lambda r: r.turn_index)
        return [turn_to_domain(row) for row in rows]


class SqlAlchemyTopicRepository(TopicRepository):
    """Persists and reads predefined topics."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_topics(self, *, limit: int = 30) -> list[ChatTopic]:
        stmt = select(ChatTopicModel).limit(limit)
        rows = (await self._session.execute(stmt)).scalars().all()
        return [topic_to_domain(row) for row in rows]

    async def count_topics(self) -> int:
        stmt = select(func.count()).select_from(ChatTopicModel)
        return int((await self._session.execute(stmt)).scalar_one())

    async def seed(self, topics: list[ChatTopic]) -> None:
        """Inserts only if table is empty."""
        count = await self.count_topics()
        if count > 0:
            return
        for topic in topics:
            self._session.add(topic_to_model(topic))
        await self._session.flush()


class SqlAlchemyGoalRepository(GoalRepository):
    """Persists and reads predefined goals."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_goals(self, *, limit: int = 30) -> list[ChatGoal]:
        stmt = select(ChatGoalModel).limit(limit)
        rows = (await self._session.execute(stmt)).scalars().all()
        return [goal_to_domain(row) for row in rows]

    async def count_goals(self) -> int:
        stmt = select(func.count()).select_from(ChatGoalModel)
        return int((await self._session.execute(stmt)).scalar_one())

    async def seed(self, goals: list[ChatGoal]) -> None:
        """Inserts or syncs predefined goals and their targets."""
        stmt = select(ChatGoalModel)
        existing_rows = (await self._session.execute(stmt)).scalars().all()
        if existing_rows:
            existing_by_label = {row.label: row for row in existing_rows}
            for goal in goals:
                if goal.label in existing_by_label:
                    model = existing_by_label[goal.label]
                    if not model.targets or model.targets != goal.targets:
                        model.targets = goal.targets
                        model.description = goal.description
                        model.level_hint = goal.level_hint.value
                else:
                    self._session.add(goal_to_model(goal))
            await self._session.flush()
            return

        for goal in goals:
            self._session.add(goal_to_model(goal))
        await self._session.flush()
