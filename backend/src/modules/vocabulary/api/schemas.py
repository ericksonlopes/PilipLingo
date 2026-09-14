"""Schemas HTTP (Pydantic) da fatia vocabulary."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from modules.vocabulary.application.dto import GeneratedSentences, SeenWordItem, StudyHistoryPage
from modules.vocabulary.domain.entities import (
    GeneratedSentence,
    ProficiencyLevel,
    SentenceChunk,
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
    translation: str = Field(min_length=1, max_length=240, examples=["avanco, descoberta"])
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

    level: ProficiencyLevel = Field(description="Nivel CEFR informado pelo usuario.")
    count: int = Field(default=3, ge=1, le=10)
    terms: list[str] = Field(
        default_factory=list,
        max_length=5,
        description="Termos que as frases devem praticar. Vazio = usa o vocabulario salvo.",
    )
    topic: str | None = Field(default=None, max_length=120)
    use_my_vocabulary: bool = Field(
        default=True,
        description="Se `terms` vier vazio, sorteia palavras do vocabulario do usuario.",
    )


class SentenceChunkResponse(BaseModel):
    """Um bloco da analise estrutural, por tras do botao "Entender Estrutura"."""

    text: str
    role: str
    explanation: str

    @classmethod
    def from_entity(cls, chunk: SentenceChunk) -> SentenceChunkResponse:
        return cls(text=chunk.text, role=chunk.role, explanation=chunk.explanation)


class SentenceResponse(BaseModel):
    text: str
    translation: str
    level: ProficiencyLevel
    focus_term: str | None
    # Vazio quando a IA nao devolveu analise reconstruivel (ver gemini_generator).
    chunks: list[SentenceChunkResponse]

    @classmethod
    def from_entity(cls, sentence: GeneratedSentence) -> SentenceResponse:
        return cls(
            text=sentence.text,
            translation=sentence.translation,
            level=sentence.level,
            focus_term=sentence.focus_term,
            chunks=[SentenceChunkResponse.from_entity(chunk) for chunk in sentence.chunks],
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
    """Opcao de nivel para o app montar a tela de onboarding."""

    level: ProficiencyLevel
    label: str


class AiStatusResponse(BaseModel):
    """Permite ao frontend esconder a feature quando a IA nao esta configurada."""

    enabled: bool
    model: str | None
    max_sentences_per_request: int


class StudyModeOption(BaseModel):
    """Modo individual que pode ser combinado com os demais."""

    mode: ExerciseMode
    label: str


class StudyThemeOption(BaseModel):
    """Tema enviado ao gerador; None mantem o sorteio do catalogo."""

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
            repetitions=card.repetitions,
            lapses=card.lapses,
            ease_factor=card.ease_factor,
            interval_days=card.interval_days,
            due_at=card.due_at,
            reviewed_at=card.reviewed_at,
            is_new=card.is_new,
        )


class StudyExerciseResponse(BaseModel):
    """Um card ja renderizado no modo sorteado.

    `answer` vai para o cliente porque a correcao dos cinco modos acontece no
    aparelho (digitacao, ordem dos blocos e Speech Recognition do navegador), o
    que mantem a sessao respondendo rapido e funcionando com rede ruim. Nao e um
    contrato a prova de trapaca: nao ha nota nem ranking, o app e de estudo
    individual e o proprio aluno decide a nota da revisao.
    """

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
    # Quantos cards a IA criou agora para fechar a sessao.
    generated_count: int
    # Divida real de revisao. `ahead_count` e o excedente de estudo adiantado, que
    # aparece quando nao havia card vencido suficiente nem geracao disponivel.
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
        description="Como o aluno se saiu: AGAIN volta na mesma sessao, EASY afasta mais."
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


# ---------- historico ----------

class SeenWordResponse(BaseModel):
    """Uma palavra-alvo unica vista pelo usuario."""

    term: str
    translation: str

    @classmethod
    def from_dto(cls, item: SeenWordItem) -> SeenWordResponse:
        return cls(term=item.term, translation=item.translation)


class StudyHistoryResponse(BaseModel):
    """Historico paginado de frases e palavras vistas pelo usuario."""

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
    """Palavras vistas na sessao que devem ser traduzidas e salvas."""

    words: list[str] = Field(
        default_factory=list,
        max_length=100,
        description="Lista de palavras em ingles (focus_terms) da sessao concluida.",
    )


class SaveSessionWordsResponse(BaseModel):
    saved: int
    translated: int


# ---------- sentence builder ----------

class SentenceBuilderValidateRequest(BaseModel):
    """Payload enviado pelo aluno no modo SENTENCE_BUILDER."""

    model_config = ConfigDict(str_strip_whitespace=True)

    sentence: str = Field(min_length=1, max_length=500)
    focus_term: str = Field(min_length=1, max_length=120)


class SentenceBuilderValidateResponse(BaseModel):
    """Resultado da validacao spaCy retornado ao cliente."""

    valid: bool
    reason: str | None = None
    feedback: str | None = None
