"""SQLAlchemy adapter for StudyCardRepository port."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from modules.vocabulary.domain.ports import StudyCardRepository
from modules.vocabulary.domain.study import StudyCard
from modules.vocabulary.infrastructure.mappers import (
    apply_to_study_card_model,
    study_card_to_domain,
    study_card_to_model,
)
from modules.vocabulary.infrastructure.models import SeenWordModel, StudyCardModel
from shared.domain.proficiency import ProficiencyLevel


class SqlAlchemyStudyCardRepository(StudyCardRepository):
    """Persists study cards via async SQLAlchemy.

    Only flush() is used here; commit is managed by get_session dependency.
    """

    def __init__(self, session: AsyncSession, *, user_id: UUID) -> None:
        self._session = session
        self._user_id = user_id

    async def add_many(self, cards: list[StudyCard]) -> list[StudyCard]:
        if not cards:
            return []
        models = [study_card_to_model(card, user_id=self._user_id) for card in cards]
        self._session.add_all(models)
        await self._session.flush()
        return [study_card_to_domain(model) for model in models]

    async def get_by_id(self, card_id: UUID) -> StudyCard | None:
        model = await self._session.get(StudyCardModel, card_id)
        if model is None or model.user_id != self._user_id:
            return None
        return study_card_to_domain(model)

    async def update(self, card: StudyCard) -> StudyCard:
        model = await self._session.get(StudyCardModel, card.id)
        if model is None or model.user_id != self._user_id:
            raise LookupError(f"StudyCardModel {card.id} not found for update.")
        apply_to_study_card_model(model, card)
        await self._session.flush()
        return study_card_to_domain(model)

    async def delete_unreviewed(self, *, level: ProficiencyLevel) -> int:
        stmt = delete(StudyCardModel).where(
            StudyCardModel.user_id == self._user_id,
            StudyCardModel.level == level.value,
            StudyCardModel.repetitions == 0,
            StudyCardModel.reviewed_at.is_(None),
        )
        result = await self._session.execute(stmt)
        await self._session.flush()
        return int(result.rowcount or 0)  # type: ignore[attr-defined]

    async def list_due(
        self,
        *,
        level: ProficiencyLevel,
        now: datetime,
        limit: int,
        theme: str | None = None,
    ) -> list[StudyCard]:
        stmt = select(StudyCardModel).where(
            StudyCardModel.user_id == self._user_id,
            StudyCardModel.level == level.value,
            StudyCardModel.due_at <= now,
            StudyCardModel.reviewed_at.is_not(None),
        )
        if theme and theme.strip():
            stmt = stmt.where(StudyCardModel.theme == theme.strip())
        stmt = (
            stmt.order_by(StudyCardModel.due_at.asc(), StudyCardModel.created_at.asc()).limit(
                limit
            )
        )
        models = (await self._session.execute(stmt)).scalars().all()
        return [study_card_to_domain(model) for model in models]

    async def list_by_level(
        self,
        *,
        level: ProficiencyLevel,
        limit: int,
        exclude: set[UUID] | None = None,
        theme: str | None = None,
    ) -> list[StudyCard]:
        stmt = select(StudyCardModel).where(
            StudyCardModel.user_id == self._user_id,
            StudyCardModel.level == level.value,
            StudyCardModel.reviewed_at.is_not(None),
        )
        if theme and theme.strip():
            stmt = stmt.where(StudyCardModel.theme == theme.strip())
        if exclude:
            stmt = stmt.where(StudyCardModel.id.notin_(exclude))
        stmt = stmt.order_by(StudyCardModel.due_at.asc()).limit(limit)
        models = (await self._session.execute(stmt)).scalars().all()
        return [study_card_to_domain(model) for model in models]

    async def count_due(
        self,
        *,
        level: ProficiencyLevel,
        now: datetime,
        theme: str | None = None,
    ) -> int:
        stmt = (
            select(func.count())
            .select_from(StudyCardModel)
            .where(
                StudyCardModel.user_id == self._user_id,
                StudyCardModel.level == level.value,
                StudyCardModel.due_at <= now,
                StudyCardModel.reviewed_at.is_not(None),
            )
        )
        if theme and theme.strip():
            stmt = stmt.where(StudyCardModel.theme == theme.strip())
        return int((await self._session.execute(stmt)).scalar_one())

    async def existing_sentences(self, *, level: ProficiencyLevel) -> set[str]:
        stmt = select(StudyCardModel.sentence_normalized).where(
            StudyCardModel.user_id == self._user_id,
            StudyCardModel.level == level.value,
        )
        return set((await self._session.execute(stmt)).scalars().all())

    async def list_reviewed(
        self,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> list[StudyCard]:
        stmt = (
            select(StudyCardModel)
            .where(
                StudyCardModel.user_id == self._user_id,
                StudyCardModel.reviewed_at.is_not(None),
            )
            .order_by(StudyCardModel.reviewed_at.desc())
            .limit(limit)
            .offset(offset)
        )
        models = (await self._session.execute(stmt)).scalars().all()
        return [study_card_to_domain(model) for model in models]

    async def count_reviewed(self) -> int:
        stmt = (
            select(func.count())
            .select_from(StudyCardModel)
            .where(
                StudyCardModel.user_id == self._user_id,
                StudyCardModel.reviewed_at.is_not(None),
            )
        )
        return int((await self._session.execute(stmt)).scalar_one())

    async def list_seen_words(
        self,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> list[tuple[str, str]]:
        stmt = (
            select(SeenWordModel.word, SeenWordModel.translation)
            .where(SeenWordModel.user_id == self._user_id)
            .order_by(SeenWordModel.last_seen_at.desc())
            .limit(limit)
            .offset(offset)
        )
        rows = (await self._session.execute(stmt)).all()
        return [(row.word, row.translation) for row in rows]

    async def count_seen_words(self) -> int:
        stmt = (
            select(func.count())
            .select_from(SeenWordModel)
            .where(SeenWordModel.user_id == self._user_id)
        )
        return int((await self._session.execute(stmt)).scalar_one())
