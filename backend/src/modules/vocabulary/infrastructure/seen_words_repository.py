"""Adaptador SQLAlchemy para persistencia de palavras vistas pelo usuario."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from modules.vocabulary.infrastructure.models import SeenWordModel

logger = logging.getLogger(__name__)


class SqlAlchemySeenWordsRepository:
    """Persiste e atualiza o registro de palavras vistas pelo usuario.

    Usa INSERT OR IGNORE + UPDATE separado para funcionar com SQLite async sem
    precisar de dialeto especifico no dominio.
    """

    def __init__(self, session: AsyncSession, *, user_id: UUID) -> None:
        self._session = session
        self._user_id = user_id

    async def upsert_many(self, words_translations: dict[str, str]) -> int:
        """Insere ou atualiza palavras.

        - Nova palavra: INSERT com seen_count=1 e first_seen_at=now.
        - Palavra existente: incrementa seen_count e atualiza last_seen_at.

        Retorna o numero de palavras processadas.
        """
        if not words_translations:
            return 0

        now = datetime.now(UTC)
        processed = 0

        for word, translation in words_translations.items():
            normalized = word.casefold()
            existing = await self._get_existing(normalized)

            if existing is None:
                self._session.add(
                    SeenWordModel(
                        id=uuid4(),
                        user_id=self._user_id,
                        word=word,
                        word_normalized=normalized,
                        translation=translation,
                        first_seen_at=now,
                        last_seen_at=now,
                        seen_count=1,
                    )
                )
            else:
                existing.last_seen_at = now
                existing.seen_count += 1
                # Atualiza a traducao se veio uma nova (traducoes podem melhorar).
                if translation:
                    existing.translation = translation

            processed += 1

        await self._session.flush()
        logger.info(
            "[seen_words] %d palavras processadas para user_id=%s",
            processed, self._user_id,
        )
        return processed

    async def _get_existing(self, word_normalized: str) -> SeenWordModel | None:
        stmt = select(SeenWordModel).where(
            SeenWordModel.user_id == self._user_id,
            SeenWordModel.word_normalized == word_normalized,
        )
        return (await self._session.execute(stmt)).scalar_one_or_none()

    async def list_all(
        self,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> list[SeenWordModel]:
        stmt = (
            select(SeenWordModel)
            .where(SeenWordModel.user_id == self._user_id)
            .order_by(SeenWordModel.last_seen_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list((await self._session.execute(stmt)).scalars().all())

    async def count_all(self) -> int:
        from sqlalchemy import func  # local import evita ciclo
        stmt = (
            select(func.count())
            .select_from(SeenWordModel)
            .where(SeenWordModel.user_id == self._user_id)
        )
        return int((await self._session.execute(stmt)).scalar_one())
