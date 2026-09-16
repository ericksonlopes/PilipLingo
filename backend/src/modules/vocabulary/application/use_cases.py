"""Use cases for vocabulary slice. Depend only on VocabularyRepository port."""

from __future__ import annotations

import asyncio
import logging
import random
from datetime import UTC, datetime
from uuid import UUID

from modules.vocabulary.application.dto import (
    CreateVocabularyEntryCommand,
    GeneratedSentences,
    GenerateSentencesCommand,
    ListVocabularyQuery,
    PagedVocabulary,
    ResetStudySessionCommand,
    ReviewStudyCardCommand,
    SaveSessionWordsCommand,
    SaveSessionWordsResult,
    SeenWordItem,
    StudyHistoryPage,
    StudyHistoryQuery,
    StudySessionQuery,
    UpdateVocabularyEntryCommand,
)
from modules.vocabulary.domain.entities import (
    ProficiencyLevel,
    SentenceRequest,
    VocabularyEntry,
)
from modules.vocabulary.domain.errors import (
    DuplicatedTerm,
    SentenceGenerationFailed,
    SentenceGeneratorNotConfigured,
    StudyCardNotFound,
    VocabularyEntryNotFound,
)
from modules.vocabulary.domain.ports import (
    SentenceGenerator,
    StudyCardRepository,
    VocabularyRepository,
    WordTranslator,
)
from modules.vocabulary.domain.study import (
    StudyCard,
    StudySession,
    assemble_session,
    random_theme,
)
from shared.errors import UnavailableError, ValidationError

logger = logging.getLogger(__name__)

# Sample size read from DB before random selection, to vary sentences across calls.
_TERM_SAMPLE_POOL = 50


class CreateVocabularyEntry:
    def __init__(self, repository: VocabularyRepository) -> None:
        self._repository = repository

    async def execute(self, command: CreateVocabularyEntryCommand) -> VocabularyEntry:
        entry = VocabularyEntry.create(
            term=command.term,
            translation=command.translation,
            example=command.example,
            level=command.level,
            tags=command.tags,
        )
        if await self._repository.find_by_term(entry.term) is not None:
            raise DuplicatedTerm(entry.term)
        return await self._repository.add(entry)


class ListVocabularyEntries:
    def __init__(self, repository: VocabularyRepository) -> None:
        self._repository = repository

    async def execute(self, query: ListVocabularyQuery) -> PagedVocabulary:
        items = await self._repository.list_all(
            search=query.search,
            limit=query.limit,
            offset=query.offset,
        )
        total = await self._repository.count(search=query.search)
        return PagedVocabulary(items=items, total=total, limit=query.limit, offset=query.offset)


class GetVocabularyEntry:
    def __init__(self, repository: VocabularyRepository) -> None:
        self._repository = repository

    async def execute(self, entry_id: UUID) -> VocabularyEntry:
        entry = await self._repository.get_by_id(entry_id)
        if entry is None:
            raise VocabularyEntryNotFound(entry_id)
        return entry


class UpdateVocabularyEntry:
    def __init__(self, repository: VocabularyRepository) -> None:
        self._repository = repository

    async def execute(
        self, entry_id: UUID, command: UpdateVocabularyEntryCommand
    ) -> VocabularyEntry:
        entry = await self._repository.get_by_id(entry_id)
        if entry is None:
            raise VocabularyEntryNotFound(entry_id)
        entry.update(
            translation=command.translation,
            example=command.example,
            level=command.level,
            tags=command.tags,
        )
        return await self._repository.update(entry)


class DeleteVocabularyEntry:
    def __init__(self, repository: VocabularyRepository) -> None:
        self._repository = repository

    async def execute(self, entry_id: UUID) -> None:
        if not await self._repository.delete(entry_id):
            raise VocabularyEntryNotFound(entry_id)


class GenerateSentences:
    """Generates example sentences, optionally using the user's saved vocabulary."""

    def __init__(
        self,
        generator: SentenceGenerator,
        repository: VocabularyRepository,
        *,
        max_per_request: int,
    ) -> None:
        self._generator = generator
        self._repository = repository
        self._max_per_request = max_per_request

    async def execute(self, command: GenerateSentencesCommand) -> GeneratedSentences:
        terms = list(command.terms)
        if not terms and command.use_my_vocabulary:
            terms = await self._sample_terms(level=command.level, limit=command.count)

        request = SentenceRequest.create(
            level=command.level,
            count=command.count,
            max_count=self._max_per_request,
            terms=terms,
            topic=command.topic,
        )
        sentences = await self._generator.generate(request)

        return GeneratedSentences(
            level=request.level,
            items=sentences,
            terms_used=request.terms,
        )

    async def _sample_terms(self, *, level: ProficiencyLevel, limit: int) -> list[str]:
        entries = await self._repository.list_all(limit=_TERM_SAMPLE_POOL, offset=0)
        if not entries:
            return []

        # Prioritize terms matching user level; fallback to all vocabulary if none match.
        same_level = [entry.term for entry in entries if entry.level == level]
        candidates = same_level or [entry.term for entry in entries]
        return random.sample(candidates, k=min(limit, len(candidates)))\


class BuildStudySession:
    """Assembles daily study session with reviews, generation, and chosen modes.

    Generator is optional on purpose. When AI key is missing or fails, the session
    still runs with existing cards in DB.
    """

    def __init__(
        self,
        cards: StudyCardRepository,
        generator: SentenceGenerator | None,
        *,
        max_per_generation: int,
        rng: random.Random | None = None,
    ) -> None:
        self._cards = cards
        self._generator = generator
        self._max_per_generation = max_per_generation
        self._rng = rng or random.Random()

    async def execute(self, query: StudySessionQuery) -> StudySession:
        if query.modes == ():
            raise ValidationError("Select at least one study mode.")
        if query.modes is not None and any(mode.is_group for mode in query.modes):
            raise ValidationError("VOCAB_MATCHING cannot be selected alone.")

        logger.info(
            "[session] starting | level=%s theme=%r limit=%d modes=%s reset=%s ai=%s",
            query.level.value,
            query.theme,
            query.limit,
            [m.value for m in (query.modes or [])],
            query.reset,
            "on" if self._generator is not None else "off",
        )

        # Always discard unreviewed cards from previous sessions
        deleted = await self._cards.delete_unreviewed(level=query.level)
        if deleted:
            logger.info(
                "[session] %d unreviewed cards from abandoned sessions discarded", deleted
            )

        now = datetime.now(UTC)
        requested_theme = query.theme.strip() if query.theme is not None else None
        deck = await self._cards.list_due(
            level=query.level,
            now=now,
            limit=query.limit,
            theme=requested_theme,
        )
        due_count = len(deck)
        logger.info(
            "[session] due cards in DB: %d/%d (theme=%r)",
            due_count,
            query.limit,
            requested_theme,
        )

        generated = 0
        if len(deck) < query.limit:
            missing = query.limit - len(deck)
            logger.info("[session] missing %d cards, calling _top_up", missing)
            new_cards = await self._top_up(query, missing=missing)
            deck.extend(new_cards)
            generated = len(new_cards)
            due_count += generated
            logger.info("[session] _top_up generated %d new cards", generated)

        if len(deck) < query.limit:
            # Still missing: advance review of non-due cards at user level
            advanced = await self._cards.list_by_level(
                level=query.level,
                limit=query.limit - len(deck),
                exclude={card.id for card in deck},
                theme=requested_theme,
            )
            logger.info(
                "[session] advancing %d future cards to fill deck",
                len(advanced),
            )
            deck.extend(advanced)

        logger.info(
            "[session] final deck: %d cards (generated=%d due=%d)",
            len(deck), generated, due_count,
        )

        if not deck:
            self._fail_empty()

        return assemble_session(
            deck,
            level=query.level,
            modes=query.modes,
            rng=self._rng,
            generated_count=generated,
            due_count=due_count,
        )

    async def _top_up(self, query: StudySessionQuery, *, missing: int) -> list[StudyCard]:
        """Generates new cards to complete session. AI failure here is non-fatal."""
        if self._generator is None:
            logger.warning("[top_up] AI generator not configured (generator=None), returning []")
            return []

        requested_theme = query.theme.strip() if query.theme is not None else ""
        theme = requested_theme or random_theme(self._rng)
        count = min(missing, self._max_per_generation)
        request = SentenceRequest.create(
            level=query.level,
            count=count,
            max_count=self._max_per_generation,
            topic=theme,
        )
        logger.info(
            "[top_up] requesting %d sentences from Gemini | level=%s theme=%r",
            count, query.level.value, theme,
        )

        try:
            sentences = await self._generator.generate(request)
            logger.info("[top_up] Gemini returned %d sentences", len(sentences))
        except UnavailableError as cause:
            logger.warning(
                "[top_up] generation failed, proceeding without new cards: %s",
                cause.message,
            )
            return []

        known = await self._cards.existing_sentences(level=query.level)
        fresh: list[StudyCard] = []
        duplicates = 0
        for sentence in sentences:
            if sentence.text.casefold() in known:
                duplicates += 1
                continue
            known.add(sentence.text.casefold())
            fresh.append(StudyCard.from_generated(sentence, theme=theme))

        if duplicates:
            logger.info("[top_up] %d sentence(s) discarded as duplicate", duplicates)

        saved = await self._cards.add_many(fresh)
        logger.info("[top_up] %d new cards saved to DB", len(saved))
        return saved

    def _fail_empty(self) -> None:
        """No cards and no AI means no session possible."""
        if self._generator is None:
            logger.error("[session] no cards available and AI not configured")
            raise SentenceGeneratorNotConfigured
        logger.error("[session] no cards available even with AI configured")
        raise SentenceGenerationFailed("no cards available to study right now")


class ResetStudySession:
    """Discards generated cards that were never reviewed (abandoned session)."""

    def __init__(self, cards: StudyCardRepository) -> None:
        self._cards = cards

    async def execute(self, command: ResetStudySessionCommand) -> int:
        deleted = await self._cards.delete_unreviewed(level=command.level)
        logger.info(
            "[session] explicit reset: %d unreviewed cards discarded for level=%s",
            deleted,
            command.level.value,
        )
        return deleted


class ReviewStudyCard:
    """Applies review grade and reschedules card."""

    def __init__(self, repository: StudyCardRepository) -> None:
        self._repository = repository

    async def execute(self, card_id: UUID, command: ReviewStudyCardCommand) -> StudyCard:
        card = await self._repository.get_by_id(card_id)
        if card is None:
            raise StudyCardNotFound(card_id)
        card.register_review(command.grade)
        return await self._repository.update(card)


class GetStudyHistory:
    """Returns paginated sentences and words seen by user."""

    def __init__(self, repository: StudyCardRepository) -> None:
        self._repository = repository

    async def execute(self, query: StudyHistoryQuery) -> StudyHistoryPage:
        logger.info(
            "[history] fetching history | limit=%d offset=%d",
            query.limit,
            query.offset,
        )
        sentences, sentences_total, word_rows, words_total = await asyncio.gather(
            self._repository.list_reviewed(limit=query.limit, offset=query.offset),
            self._repository.count_reviewed(),
            self._repository.list_seen_words(limit=query.limit, offset=query.offset),
            self._repository.count_seen_words(),
        )
        words = [
            SeenWordItem(term=term, translation=translation)
            for term, translation in word_rows
        ]
        logger.info(
            "[history] found %d sentences (total=%d) and %d unique words (total=%d)",
            len(sentences),
            sentences_total,
            len(words),
            words_total,
        )
        return StudyHistoryPage(
            sentences=sentences,
            sentences_total=sentences_total,
            words=words,
            words_total=words_total,
            limit=query.limit,
            offset=query.offset,
        )


class SaveSessionWords:
    """Translates session words and persists in individual history."""

    def __init__(
        self,
        translator: WordTranslator,
        seen_words_repo: SeenWordsRepositoryProtocol,
    ) -> None:
        self._translator = translator
        self._repo = seen_words_repo

    async def execute(self, command: SaveSessionWordsCommand) -> SaveSessionWordsResult:
        unique: dict[str, str] = {}
        for word in command.words:
            cleaned = word.strip()
            if cleaned:
                unique.setdefault(cleaned.casefold(), cleaned)
        words = list(unique.values())

        if not words:
            return SaveSessionWordsResult(saved=0, translated=0)

        provided: dict[str, str] = {}
        for term, translation in command.translations.items():
            cleaned_term = term.strip()
            cleaned_translation = (translation or "").strip()
            if cleaned_term and cleaned_translation:
                provided.setdefault(cleaned_term.casefold(), cleaned_translation)

        translations: dict[str, str] = {}
        missing: list[str] = []
        for word in words:
            hit = provided.get(word.casefold())
            if hit:
                translations[word] = hit
            else:
                missing.append(word)

        if missing:
            logger.info(
                "[session_words] %d translated by AI, %d via deep-translator",
                len(translations), len(missing),
            )
            fallback = await self._translator.translate_many(missing)
            translations.update(fallback)
        else:
            logger.info(
                "[session_words] %d words translated by AI (no external call)",
                len(translations),
            )

        translated = len(translations)

        saved = await self._repo.upsert_many(translations)
        logger.info(
            "[session_words] %d/%d words saved to DB", saved, len(words)
        )
        return SaveSessionWordsResult(saved=saved, translated=translated)


from typing import Protocol  # noqa: E402


class SeenWordsRepositoryProtocol(Protocol):
    async def upsert_many(self, words_translations: dict[str, str]) -> int: ...
