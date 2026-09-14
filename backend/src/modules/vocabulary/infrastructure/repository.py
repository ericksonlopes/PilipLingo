"""Adaptador SQLAlchemy da porta VocabularyRepository."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import Select, delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from modules.vocabulary.domain.entities import VocabularyEntry
from modules.vocabulary.domain.ports import VocabularyRepository
from modules.vocabulary.infrastructure.mappers import (
    apply_to_model,
    to_domain,
    to_model,
)
from modules.vocabulary.infrastructure.models import VocabularyEntryModel


class SqlAlchemyVocabularyRepository(VocabularyRepository):
    """Persiste itens de vocabulario via SQLAlchemy async.

    O commit e responsabilidade da unidade de trabalho (dependencia get_session),
    entao aqui usamos apenas flush.
    """

    def __init__(self, session: AsyncSession, *, user_id: UUID) -> None:
        self._session = session
        # Escopo do dono: toda leitura/escrita passa por este id. Nunca cruza usuarios.
        self._user_id = user_id

    async def add(self, entry: VocabularyEntry) -> VocabularyEntry:
        model = to_model(entry, user_id=self._user_id)
        self._session.add(model)
        await self._session.flush()
        return to_domain(model)

    async def update(self, entry: VocabularyEntry) -> VocabularyEntry:
        model = await self._get_owned(entry.id)
        if model is None:
            raise LookupError(f"VocabularyEntryModel {entry.id} nao encontrado para update.")
        apply_to_model(model, entry)
        await self._session.flush()
        return to_domain(model)

    async def get_by_id(self, entry_id: UUID) -> VocabularyEntry | None:
        model = await self._get_owned(entry_id)
        return to_domain(model) if model is not None else None

    async def find_by_term(self, term: str) -> VocabularyEntry | None:
        stmt = select(VocabularyEntryModel).where(
            VocabularyEntryModel.user_id == self._user_id,
            VocabularyEntryModel.term_normalized == term.casefold(),
        )
        model = (await self._session.execute(stmt)).scalar_one_or_none()
        return to_domain(model) if model is not None else None

    async def list_all(
        self,
        *,
        search: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[VocabularyEntry]:
        stmt = self._apply_search(self._scoped(select(VocabularyEntryModel)), search)
        stmt = stmt.order_by(VocabularyEntryModel.created_at.desc()).limit(limit).offset(offset)
        models = (await self._session.execute(stmt)).scalars().all()
        return [to_domain(model) for model in models]

    async def count(self, *, search: str | None = None) -> int:
        stmt = self._apply_search(
            self._scoped(select(func.count()).select_from(VocabularyEntryModel)),
            search,
        )
        return int((await self._session.execute(stmt)).scalar_one())

    async def delete(self, entry_id: UUID) -> bool:
        stmt = delete(VocabularyEntryModel).where(
            VocabularyEntryModel.id == entry_id,
            VocabularyEntryModel.user_id == self._user_id,
        )
        result = await self._session.execute(stmt)
        return bool(result.rowcount)  # type: ignore[attr-defined]

    async def _get_owned(self, entry_id: UUID) -> VocabularyEntryModel | None:
        """Busca por id garantindo que o registro e do usuario da sessao."""
        model = await self._session.get(VocabularyEntryModel, entry_id)
        if model is None or model.user_id != self._user_id:
            return None
        return model

    def _scoped(self, stmt: Select[Any]) -> Select[Any]:
        return stmt.where(VocabularyEntryModel.user_id == self._user_id)

    def _apply_search(self, stmt: Select[Any], search: str | None) -> Select[Any]:
        if not search:
            return stmt
        pattern = f"%{search.strip().casefold()}%"
        return stmt.where(
            or_(
                VocabularyEntryModel.term_normalized.like(pattern),
                func.lower(VocabularyEntryModel.translation).like(pattern),
            )
        )
