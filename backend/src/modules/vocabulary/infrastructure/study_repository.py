"""Adaptador SQLAlchemy da porta StudyCardRepository."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select
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
    """Persiste cards de estudo via SQLAlchemy async.

    Como no repositorio de vocabulario, aqui so ha `flush()`: o commit e da
    dependencia `get_session`, que fecha a transacao no fim do request.
    """

    def __init__(self, session: AsyncSession, *, user_id: UUID) -> None:
        self._session = session
        # Escopo do dono: cada aluno so ve e agenda os proprios cards.
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
            raise LookupError(f"StudyCardModel {card.id} nao encontrado para update.")
        apply_to_study_card_model(model, card)
        await self._session.flush()
        return study_card_to_domain(model)

    async def list_due(
        self,
        *,
        level: ProficiencyLevel,
        now: datetime,
        limit: int,
    ) -> list[StudyCard]:
        stmt = (
            select(StudyCardModel)
            .where(
                StudyCardModel.user_id == self._user_id,
                StudyCardModel.level == level.value,
                StudyCardModel.due_at <= now,
            )
            # Mais atrasados primeiro; entre iguais, os nunca revisados na frente.
            .order_by(StudyCardModel.due_at.asc(), StudyCardModel.created_at.asc())
            .limit(limit)
        )
        models = (await self._session.execute(stmt)).scalars().all()
        return [study_card_to_domain(model) for model in models]

    async def list_by_level(
        self,
        *,
        level: ProficiencyLevel,
        limit: int,
        exclude: set[UUID] | None = None,
    ) -> list[StudyCard]:
        stmt = select(StudyCardModel).where(
            StudyCardModel.user_id == self._user_id,
            StudyCardModel.level == level.value,
        )
        if exclude:
            stmt = stmt.where(StudyCardModel.id.notin_(exclude))
        stmt = stmt.order_by(StudyCardModel.due_at.asc()).limit(limit)
        models = (await self._session.execute(stmt)).scalars().all()
        return [study_card_to_domain(model) for model in models]

    async def count_due(self, *, level: ProficiencyLevel, now: datetime) -> int:
        stmt = (
            select(func.count())
            .select_from(StudyCardModel)
            .where(
                StudyCardModel.user_id == self._user_id,
                StudyCardModel.level == level.value,
                StudyCardModel.due_at <= now,
            )
        )
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
        """Palavras vistas pelo usuario, mais recentes primeiro.

        Le da tabela `seen_words`, que guarda VARIAS palavras por frase (todo o
        vocabulario de cada sessao), em vez do unico focus_term por card. Assim o
        historico "Palavras" mostra cada palavra praticada, nao uma por frase.
        """
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
