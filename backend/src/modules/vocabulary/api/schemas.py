"""HTTP Schemas (Pydantic) for vocabulary slice."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from modules.vocabulary.application.dto import (
    GeneratedSentences,
    SeenWordItem,
    StudyHistoryPage,
    TranslationResult,
)
from modules.vocabulary.domain.entities import (
    GeneratedSentence,
    ProficiencyLevel,
    SentenceChunk,
    SentenceVocabularyItem,
    VocabularyEntry,
)
from modules.vocabulary.domain.study import (
    ExerciseMode,
    ReviewGrade,
    StudyCard,
    StudyExercise,
    StudySession,
)


class VocabularyEntryCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    term: str = Field(min_length=1, max_length=120, examples=["breakthrough"])
    translation: str = Field(min_length=1, max_length=240, examples=["avanço, descoberta"])
    example: str | None = Field(default=None, max_length=500)
    level: ProficiencyLevel = ProficiencyLevel.A1
    tags: list[str] = Field(default_factory=list)


class VocabularyEntryUpdateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    translation: str | None = Field(default=None, min_length=1, max_length=240)
    example: str | None = Field(default=None, max_length=500)
    level: ProficiencyLevel | None = None
    tags: list[str] | None = None


class VocabularyEntryResponse(BaseModel):
    id: UUID
    term: str
    translation: str
    example: str | None
    level: ProficiencyLevel
    tags: list[str]
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_entity(cls, entry: VocabularyEntry) -> VocabularyEntryResponse:
        return cls(
            id=entry.id,
            term=entry.term,
            translation=entry.translation,
            example=entry.example,
            level=entry.level,
            tags=entry.tags,
            created_at=entry.created_at,
            updated_at=entry.updated_at,
        )


class VocabularyListResponse(BaseModel):
    items: list[VocabularyEntryResponse]
    total: int
    limit: int
    offset: int


class GenerateSentencesRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    level: ProficiencyLevel = Field(description="User CEFR level.")
    count: int = Field(default=3, ge=1, le=10)
    terms: list[str] = Field(
        default_factory=list,
        max_length=5,
        description="Terms to practice. Empty = use saved vocabulary.",
    )
    topic: str | None = Field(default=None, max_length=120)
    use_my_vocabulary: bool = Field(
        default=True,
        description="If `terms` is empty, samples terms from user vocabulary.",
    )


class SentenceChunkResponse(BaseModel):
    """A block from structural analysis for 'Understand Structure' feature."""

    text: str
    role: str
    explanation: str

    @classmethod
    def from_entity(cls, chunk: SentenceChunk) -> SentenceChunkResponse:
        return cls(text=chunk.text, role=chunk.role, explanation=chunk.explanation)


class SentenceVocabularyResponse(BaseModel):
    """A sentence vocabulary item (word/phrase + translation)."""

    term: str
    translation: str

    @classmethod
    def from_entity(cls, item: SentenceVocabularyItem) -> SentenceVocabularyResponse:
        return cls(term=item.term, translation=item.translation)


class SentenceResponse(BaseModel):
    text: str
    translation: str
    level: ProficiencyLevel
    focus_term: str | None
    chunks: list[SentenceChunkResponse]
    vocabulary: list[SentenceVocabularyResponse]

    @classmethod
    def from_entity(cls, sentence: GeneratedSentence) -> SentenceResponse:
        return cls(
            text=sentence.text,
            translation=sentence.translation,
            level=sentence.level,
            focus_term=sentence.focus_term,
            chunks=[SentenceChunkResponse.from_entity(chunk) for chunk in sentence.chunks],
            vocabulary=[
                SentenceVocabularyResponse.from_entity(item) for item in sentence.vocabulary
            ],
        )


class GenerateSentencesResponse(BaseModel):
    level: ProficiencyLevel
    items: list[SentenceResponse]
    terms_used: list[str]

    @classmethod
    def from_result(cls, result: GeneratedSentences) -> GenerateSentencesResponse:
        return cls(
            level=result.level,
            items=[SentenceResponse.from_entity(item) for item in result.items],
            terms_used=result.terms_used,
        )


class LevelOption(BaseModel):
    """Level option for onboarding screen."""

    level: ProficiencyLevel
    label: str


class AiStatusResponse(BaseModel):
    """Allows frontend to hide feature when AI is not configured."""

    enabled: bool
    model: str | None
    max_sentences_per_request: int


class StudyModeOption(BaseModel):
    """Individual mode that can be combined with others."""

    mode: ExerciseMode
    label: str


class StudyThemeOption(BaseModel):
    """Theme sent to generator; None keeps catalog selection."""

    theme: str | None
    label: str


class StudyOptionsResponse(BaseModel):
    modes: list[StudyModeOption]
    themes: list[StudyThemeOption]


class StudyCardResponse(BaseModel):
    id: UUID
    sentence: str
    translation: str
    focus_term: str
    focus_term_translation: str | None
    level: ProficiencyLevel
    theme: str
    sentence_chunks: list[SentenceChunkResponse]
    vocabulary: list[SentenceVocabularyResponse]
    repetitions: int
    lapses: int
    ease_factor: float
    interval_days: int
    due_at: datetime
    reviewed_at: datetime | None
    is_new: bool

    @classmethod
    def from_entity(cls, card: StudyCard) -> StudyCardResponse:
        return cls(
            id=card.id,
            sentence=card.sentence,
            translation=card.translation,
            focus_term=card.focus_term,
            focus_term_translation=card.focus_term_translation,
            level=card.level,
            theme=card.theme,
            sentence_chunks=[SentenceChunkResponse.from_entity(chunk) for chunk in card.chunks],
            vocabulary=[
                SentenceVocabularyResponse.from_entity(item) for item in card.vocabulary
            ],
            repetitions=card.repetitions,
            lapses=card.lapses,
            ease_factor=card.ease_factor,
            interval_days=card.interval_days,
            due_at=card.due_at,
            reviewed_at=card.reviewed_at,
            is_new=card.is_new,
        )


class StudyExerciseResponse(BaseModel):
    """A card rendered in selected mode for client UI rendering."""

    mode: ExerciseMode
    instruction: str
    needs_audio: bool
    prompt: str
    answer: str
    blocks: list[str]
    card: StudyCardResponse
    group: list[StudyCardResponse]

    @classmethod
    def from_entity(cls, exercise: StudyExercise) -> StudyExerciseResponse:
        return cls(
            mode=exercise.mode,
            instruction=exercise.mode.instruction,
            needs_audio=exercise.mode.needs_audio,
            prompt=exercise.prompt,
            answer=exercise.answer,
            blocks=list(exercise.blocks),
            card=StudyCardResponse.from_entity(exercise.card),
            group=[StudyCardResponse.from_entity(card) for card in exercise.group],
        )


class StudySessionResponse(BaseModel):
    level: ProficiencyLevel
    total: int
    generated_count: int
    due_count: int
    ahead_count: int
    themes: list[str]
    exercises: list[StudyExerciseResponse]

    @classmethod
    def from_entity(cls, session: StudySession) -> StudySessionResponse:
        return cls(
            level=session.level,
            total=session.size,
            generated_count=session.generated_count,
            due_count=session.due_count,
            ahead_count=session.ahead_count,
            themes=list(session.themes),
            exercises=[
                StudyExerciseResponse.from_entity(exercise) for exercise in session.exercises
            ],
        )


class ReviewStudyCardRequest(BaseModel):
    grade: ReviewGrade = Field(
        description="Student performance: AGAIN repeats in same session, EASY pushes further."
    )


class ReviewStudyCardResponse(BaseModel):
    card: StudyCardResponse
    next_due_at: datetime
    interval_days: int

    @classmethod
    def from_entity(cls, card: StudyCard) -> ReviewStudyCardResponse:
        return cls(
            card=StudyCardResponse.from_entity(card),
            next_due_at=card.due_at,
            interval_days=card.interval_days,
        )


# ---------- history ----------


class SeenWordResponse(BaseModel):
    """A unique target word seen by user."""

    term: str
    translation: str

    @classmethod
    def from_dto(cls, item: SeenWordItem) -> SeenWordResponse:
        return cls(term=item.term, translation=item.translation)


class StudyHistoryResponse(BaseModel):
    """Paginated history of sentences and words seen by user."""

    sentences: list[StudyCardResponse]
    sentences_total: int
    words: list[SeenWordResponse]
    words_total: int
    limit: int
    offset: int

    @classmethod
    def from_dto(cls, page: StudyHistoryPage) -> StudyHistoryResponse:
        return cls(
            sentences=[StudyCardResponse.from_entity(card) for card in page.sentences],
            sentences_total=page.sentences_total,
            words=[SeenWordResponse.from_dto(w) for w in page.words],
            words_total=page.words_total,
            limit=page.limit,
            offset=page.offset,
        )


# ---------- session words ----------


class SaveSessionWordsRequest(BaseModel):
    """Words seen in a session to translate and save."""

    words: list[str] = Field(
        default_factory=list,
        max_length=100,
        description="List of English words/expressions seen in completed session.",
    )
    translations: dict[str, str] = Field(
        default_factory=dict,
        description=(
            "Known translations by term (from AI generated vocabulary). "
            "Missing terms here are translated by server as fallback."
        ),
    )


class SaveSessionWordsResponse(BaseModel):
    saved: int
    translated: int


# ---------- sentence builder ----------


class SentenceBuilderValidateRequest(BaseModel):
    """Payload sent by user in SENTENCE_BUILDER mode."""

    model_config = ConfigDict(str_strip_whitespace=True)

    sentence: str = Field(min_length=1, max_length=500)
    focus_term: str = Field(min_length=1, max_length=120)


class SentenceBuilderValidateResponse(BaseModel):
    """spaCy validation result returned to client."""

    valid: bool
    reason: str | None = None
    feedback: str | None = None


# ---------- advanced translation ----------


class TranslateRequest(BaseModel):
    """Payload for advanced translation endpoint."""

    model_config = ConfigDict(str_strip_whitespace=True)

    text: str = Field(
        min_length=1,
        max_length=1000,
        description="Phrase or expression to translate and analyze.",
        examples=["I've been looking forward to this moment."],
    )


class TranslationChunkResponse(BaseModel):
    """A grammatical block with role and explanation."""

    text: str
    role: str
    explanation: str


class TranslationCorrectionResponse(BaseModel):
    """A grammar/spelling error found in English input."""

    original: str
    corrected: str
    explanation: str


class TranslateResponse(BaseModel):
    """Advanced translation result with block analysis."""

    original: str
    translation: str
    english_phrase: str
    portuguese_phrase: str
    corrections: list[TranslationCorrectionResponse]
    chunks: list[TranslationChunkResponse]
    assembly_summary: str

    @classmethod
    def from_result(cls, result: TranslationResult) -> TranslateResponse:
        return cls(
            original=result.original,
            translation=result.translation,
            english_phrase=result.english_phrase,
            portuguese_phrase=result.portuguese_phrase,
            corrections=[
                TranslationCorrectionResponse(
                    original=c.original,
                    corrected=c.corrected,
                    explanation=c.explanation,
                )
                for c in result.corrections
            ],
            chunks=[
                TranslationChunkResponse(
                    text=c.text, role=c.role, explanation=c.explanation
                )
                for c in result.chunks
            ],
            assembly_summary=result.assembly_summary,
        )
