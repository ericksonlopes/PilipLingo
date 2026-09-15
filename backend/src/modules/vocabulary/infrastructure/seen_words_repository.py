"""SQLAlchemy adapter for persisting words seen by user."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from modules.vocabulary.infrastructure.models import SeenWordModel

logger = logging.getLogger(__name__)


class SqlAlchemySeenWordsRepository:
    """Persists and updates record of words seen by user."""

    def __init__(self, session: AsyncSession, *, user_id: UUID) -> None:
        self._session = session
        self._user_id = user_id

    async def upsert_many(self, words_translations: dict[str, str]) -> int:
        """Inserts or updates words.

        - New word: INSERT with seen_count=1 and first_seen_at=now.
        - Existing word: increments seen_count and updates last_seen_at.

        Returns number of processed words.
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
                if translation:
                    existing.translation = translation

            processed += 1

        await self._session.flush()
        logger.info(
            "[seen_words] %d words processed for user_id=%s",
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
        from sqlalchemy import func
        stmt = (
            select(func.count())
            .select_from(SeenWordModel)
            .where(SeenWordModel.user_id == self._user_id)
        )
        return int((await self._session.execute(stmt)).scalar_one())
