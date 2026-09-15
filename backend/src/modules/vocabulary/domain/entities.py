"""Entities and value objects for vocabulary slice. No framework or ORM dependencies."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import UUID, uuid4

from shared.domain.proficiency import ProficiencyLevel
from shared.errors import ValidationError

MAX_TERM_LENGTH = 120
MAX_TRANSLATION_LENGTH = 240
MAX_EXAMPLE_LENGTH = 500
MAX_TOPIC_LENGTH = 120
# Cap of terms that a single sentence generation request can practice.
MAX_TERMS_PER_REQUEST = 5

MAX_CHUNK_TEXT_LENGTH = 120
MAX_CHUNK_ROLE_LENGTH = 80
MAX_CHUNK_EXPLANATION_LENGTH = 280
# Max chunks per sentence for study protection.
MAX_CHUNKS_PER_SENTENCE = 12

# Max vocabulary items extracted per sentence.
MAX_VOCABULARY_PER_SENTENCE = 8


__all__ = [
    "MAX_CHUNKS_PER_SENTENCE",
    "MAX_CHUNK_EXPLANATION_LENGTH",
    "MAX_CHUNK_ROLE_LENGTH",
    "MAX_CHUNK_TEXT_LENGTH",
    "MAX_EXAMPLE_LENGTH",
    "MAX_TERMS_PER_REQUEST",
    "MAX_TERM_LENGTH",
    "MAX_TOPIC_LENGTH",
    "MAX_TRANSLATION_LENGTH",
    "MAX_VOCABULARY_PER_SENTENCE",
    "GeneratedSentence",
    "ProficiencyLevel",
    "SentenceChunk",
    "SentenceRequest",
    "SentenceVocabularyItem",
    "VocabularyEntry",
]


def _clean(value: str, *, field_name: str, max_length: int) -> str:
    text = (value or "").strip()
    if not text:
        raise ValidationError(f"'{field_name}' cannot be empty.")
    if len(text) > max_length:
        raise ValidationError(f"'{field_name}' exceeds {max_length} characters.")
    return text


def _clean_optional(value: str | None, *, field_name: str, max_length: int) -> str | None:
    if value is None:
        return None
    text = value.strip()
    if not text:
        return None
    if len(text) > max_length:
        raise ValidationError(f"'{field_name}' exceeds {max_length} characters.")
    return text


@dataclass(slots=True)
class VocabularyEntry:
    """A vocabulary item: English term + Portuguese translation."""

    id: UUID
    term: str
    translation: str
    example: str | None
    level: ProficiencyLevel
    created_at: datetime
    updated_at: datetime
    tags: list[str] = field(default_factory=list)

    @classmethod
    def create(
        cls,
        *,
        term: str,
        translation: str,
        example: str | None = None,
        level: ProficiencyLevel = ProficiencyLevel.A1,
        tags: list[str] | None = None,
    ) -> VocabularyEntry:
        """Factory ensuring entity invariants."""
        now = datetime.now(UTC)
        return cls(
            id=uuid4(),
            term=_clean(term, field_name="term", max_length=MAX_TERM_LENGTH),
            translation=_clean(
                translation, field_name="translation", max_length=MAX_TRANSLATION_LENGTH
            ),
            example=_clean_optional(example, field_name="example", max_length=MAX_EXAMPLE_LENGTH),
            level=level,
            created_at=now,
            updated_at=now,
            tags=cls._normalize_tags(tags),
        )

    def update(
        self,
        *,
        translation: str | None = None,
        example: str | None = None,
        level: ProficiencyLevel | None = None,
        tags: list[str] | None = None,
    ) -> None:
        """Applies partial updates maintaining invariants."""
        if translation is not None:
            self.translation = _clean(
                translation, field_name="translation", max_length=MAX_TRANSLATION_LENGTH
            )
        if example is not None:
            self.example = _clean_optional(
                example, field_name="example", max_length=MAX_EXAMPLE_LENGTH
            )
        if level is not None:
            self.level = level
        if tags is not None:
            self.tags = self._normalize_tags(tags)
        self.updated_at = datetime.now(UTC)

    @property
    def normalized_term(self) -> str:
        """Uniqueness key for the term (case-insensitive)."""
        return self.term.casefold()

    @staticmethod
    def _normalize_tags(tags: list[str] | None) -> list[str]:
        if not tags:
            return []
        seen: dict[str, None] = {}
        for tag in tags:
            cleaned = tag.strip().casefold()
            if cleaned:
                seen.setdefault(cleaned, None)
        return list(seen)


@dataclass(frozen=True, slots=True)
class SentenceChunk:
    """A logical block of a sentence with its role and explanation."""

    text: str
    role: str
    explanation: str

    @classmethod
    def create(cls, *, text: str, role: str, explanation: str) -> SentenceChunk:
        """Factory that normalizes and validates field constraints."""
        return cls(
            text=_clean(text, field_name="chunk.text", max_length=MAX_CHUNK_TEXT_LENGTH),
            role=_clean(role, field_name="chunk.role", max_length=MAX_CHUNK_ROLE_LENGTH),
            explanation=_clean(
                explanation,
                field_name="chunk.explanation",
                max_length=MAX_CHUNK_EXPLANATION_LENGTH,
            ),
        )


def _validate_chunks(chunks: list[SentenceChunk]) -> None:
    if len(chunks) > MAX_CHUNKS_PER_SENTENCE:
        raise ValidationError(f"A sentence cannot have more than {MAX_CHUNKS_PER_SENTENCE} chunks.")


@dataclass(frozen=True, slots=True)
class SentenceVocabularyItem:
    """A word or expression from a sentence with Portuguese translation."""

    term: str
    translation: str

    @classmethod
    def create(cls, *, term: str, translation: str) -> SentenceVocabularyItem:
        """Factory that normalizes and validates field constraints."""
        return cls(
            term=_clean(term, field_name="vocabulary.term", max_length=MAX_TERM_LENGTH),
            translation=_clean(
                translation,
                field_name="vocabulary.translation",
                max_length=MAX_TRANSLATION_LENGTH,
            ),
        )


def _validate_vocabulary(vocabulary: list[SentenceVocabularyItem]) -> None:
    if len(vocabulary) > MAX_VOCABULARY_PER_SENTENCE:
        raise ValidationError(
            f"A sentence cannot have more than {MAX_VOCABULARY_PER_SENTENCE} vocabulary items."
        )


@dataclass(frozen=True, slots=True)
class GeneratedSentence:
    """An example sentence in English with translation and structural analysis."""

    text: str
    translation: str
    level: ProficiencyLevel
    focus_term: str | None = None
    focus_term_translation: str | None = None
    chunks: list[SentenceChunk] = field(default_factory=list)
    vocabulary: list[SentenceVocabularyItem] = field(default_factory=list)

    def __post_init__(self) -> None:
        if not self.text.strip():
            raise ValidationError("Generated sentence cannot be empty.")
        if not self.translation.strip():
            raise ValidationError("Translation of generated sentence cannot be empty.")
        _validate_chunks(self.chunks)
        _validate_vocabulary(self.vocabulary)


@dataclass(frozen=True, slots=True)
class SentenceRequest:
    """Request for sentence generation, validated by domain rules."""

    level: ProficiencyLevel
    count: int
    terms: list[str] = field(default_factory=list)
    topic: str | None = None

    @classmethod
    def create(
        cls,
        *,
        level: ProficiencyLevel,
        count: int,
        max_count: int,
        terms: list[str] | None = None,
        topic: str | None = None,
    ) -> SentenceRequest:
        """Factory enforcing request invariants."""
        if count < 1:
            raise ValidationError("Request at least one sentence.")
        if count > max_count:
            raise ValidationError(f"Maximum of {max_count} sentences per request.")

        return cls(
            level=level,
            count=count,
            terms=cls._normalize_terms(terms),
            topic=_clean_optional(topic, field_name="topic", max_length=MAX_TOPIC_LENGTH),
        )

    @staticmethod
    def _normalize_terms(terms: list[str] | None) -> list[str]:
        if not terms:
            return []

        unique: dict[str, str] = {}
        for term in terms:
            cleaned = term.strip()
            if not cleaned:
                continue
            if len(cleaned) > MAX_TERM_LENGTH:
                raise ValidationError(f"Term '{cleaned[:20]}...' is too long.")
            unique.setdefault(cleaned.casefold(), cleaned)

        if len(unique) > MAX_TERMS_PER_REQUEST:
            raise ValidationError(f"Send at most {MAX_TERMS_PER_REQUEST} terms.")
        return list(unique.values())
