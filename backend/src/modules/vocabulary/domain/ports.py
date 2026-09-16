"""Ports (interfaces) for vocabulary domain.

The domain declares requirements; infrastructure layer provides adapters.
No concrete implementations referenced here.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from modules.vocabulary.domain.entities import (
    GeneratedSentence,
    SentenceRequest,
    VocabularyEntry,
)
from modules.vocabulary.domain.study import StudyCard
from shared.domain.proficiency import ProficiencyLevel

# ---------- value objects used by ports ----------

@dataclass(frozen=True, slots=True)
class TranslationChunk:
    """A grammatical block returned by translation adapter."""
    text: str
    role: str
    explanation: str


@dataclass(frozen=True, slots=True)
class TranslationCorrection:
    """A grammar/spelling error found in English input."""
    original: str
    corrected: str
    explanation: str


@dataclass(frozen=True, slots=True)
class PhraseTranslationResult:
    """Raw result returned by PhraseTranslator adapter."""
    original: str
    translation: str
    english_phrase: str
    portuguese_phrase: str
    corrections: list[TranslationCorrection]
    chunks: list[TranslationChunk]
    assembly_summary: str


@dataclass(frozen=True, slots=True)
class PhraseVariation:
    """A natural way to express the user's intent in English."""
    english_phrase: str
    portuguese_translation: str
    context: str
    formality: str
    explanation: str


@dataclass(frozen=True, slots=True)
class SentencePattern:
    """A reusable grammatical structure/formula for building similar phrases."""
    pattern: str
    explanation: str
    examples: list[str]


@dataclass(frozen=True, slots=True)
class PhraseCraftResult:
    """Result of phrase crafting assistance."""
    original: str
    intent_summary: str
    cultural_tip: str
    variations: list[PhraseVariation]
    patterns: list[SentencePattern]


class VocabularyRepository(ABC):
    """Persistence port for vocabulary items."""

    @abstractmethod
    async def add(self, entry: VocabularyEntry) -> VocabularyEntry:
        """Persists a new item."""

    @abstractmethod
    async def update(self, entry: VocabularyEntry) -> VocabularyEntry:
        """Persists changes to an existing item."""

    @abstractmethod
    async def get_by_id(self, entry_id: UUID) -> VocabularyEntry | None:
        """Finds item by ID."""

    @abstractmethod
    async def find_by_term(self, term: str) -> VocabularyEntry | None:
        """Finds item by term (case-insensitive)."""

    @abstractmethod
    async def list_all(
        self,
        *,
        search: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[VocabularyEntry]:
        """Lists items with optional search filter and pagination."""

    @abstractmethod
    async def count(self, *, search: str | None = None) -> int:
        """Total items matching search filter."""

    @abstractmethod
    async def delete(self, entry_id: UUID) -> bool:
        """Removes an item. Returns False if it did not exist."""


class SentenceGenerator(ABC):
    """Port for example sentence generation (implemented by AI adapter)."""

    @abstractmethod
    async def generate(self, request: SentenceRequest) -> list[GeneratedSentence]:
        """Produces sentences consistent with requested level."""


class WordTranslator(ABC):
    """Port for translating individual words/terms EN->PT-BR."""

    @abstractmethod
    async def translate_many(self, words: list[str]) -> dict[str, str]:
        """Translates a list of terms and returns {term: translation}.

        Terms failing translation are omitted from result.
        """


class PhraseTranslator(ABC):
    """Port for advanced phrase translation with structural analysis."""

    @abstractmethod
    async def translate(self, text: str) -> PhraseTranslationResult:
        """Translates phrase and returns grammatical blocks with explanations."""


class PhraseCrafter(ABC):
    """Port for phrase construction options, sentence patterns, and pragmatic tips."""

    @abstractmethod
    async def craft(self, text: str) -> PhraseCraftResult:
        """Analyzes intent and returns variations, patterns, and pragmatic tips."""


class StudyCardRepository(ABC):
    """Persistence port for study cards and scheduling state."""

    @abstractmethod
    async def add_many(self, cards: list[StudyCard]) -> list[StudyCard]:
        """Persists newly generated cards."""

    @abstractmethod
    async def get_by_id(self, card_id: UUID) -> StudyCard | None:
        """Finds card by ID."""

    @abstractmethod
    async def update(self, card: StudyCard) -> StudyCard:
        """Persists updated scheduling state after review."""

    @abstractmethod
    async def delete_unreviewed(self, *, level: ProficiencyLevel) -> int:
        """Removes generated cards that were never reviewed (abandoned sessions)."""

    @abstractmethod
    async def list_due(
        self,
        *,
        level: ProficiencyLevel,
        now: datetime,
        limit: int,
        theme: str | None = None,
    ) -> list[StudyCard]:
        """Due cards for level, ordered from most overdue to least overdue."""

    @abstractmethod
    async def list_by_level(
        self,
        *,
        level: ProficiencyLevel,
        limit: int,
        exclude: set[UUID] | None = None,
        theme: str | None = None,
    ) -> list[StudyCard]:
        """Cards of level regardless of due date."""

    @abstractmethod
    async def count_due(
        self,
        *,
        level: ProficiencyLevel,
        now: datetime,
        theme: str | None = None,
    ) -> int:
        """How many cards for level are due."""

    @abstractmethod
    async def existing_sentences(self, *, level: ProficiencyLevel) -> set[str]:
        """Registered sentences (normalized), to avoid generating duplicates."""

    @abstractmethod
    async def list_reviewed(
        self,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> list[StudyCard]:
        """Cards already seen by user (reviewed_at IS NOT NULL), most recent first."""

    @abstractmethod
    async def count_reviewed(self) -> int:
        """Total cards reviewed by user."""

    @abstractmethod
    async def list_seen_words(
        self,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> list[tuple[str, str]]:
        """Seen words (word, translation), most recent first."""

    @abstractmethod
    async def count_seen_words(self) -> int:
        """Total words seen by user."""
