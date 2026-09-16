"""Objetos de transporte entre a borda HTTP e os casos de uso.

Sao dataclasses puras: os casos de uso nao conhecem Pydantic nem FastAPI.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from modules.vocabulary.domain.entities import (
    GeneratedSentence,
    ProficiencyLevel,
    VocabularyEntry,
)
from modules.vocabulary.domain.study import ExerciseMode, ReviewGrade, StudyCard


@dataclass(frozen=True, slots=True)
class CreateVocabularyEntryCommand:
    term: str
    translation: str
    example: str | None = None
    level: ProficiencyLevel = ProficiencyLevel.A1
    tags: list[str] = field(default_factory=list)


@dataclass(frozen=True, slots=True)
class UpdateVocabularyEntryCommand:
    translation: str | None = None
    example: str | None = None
    level: ProficiencyLevel | None = None
    tags: list[str] | None = None


@dataclass(frozen=True, slots=True)
class ListVocabularyQuery:
    search: str | None = None
    limit: int = 50
    offset: int = 0


@dataclass(frozen=True, slots=True)
class PagedVocabulary:
    items: list[VocabularyEntry]
    total: int
    limit: int
    offset: int


@dataclass(frozen=True, slots=True)
class GenerateSentencesCommand:
    level: ProficiencyLevel
    count: int = 3
    terms: list[str] = field(default_factory=list)
    topic: str | None = None
    # Quando nao ha termos explicitos, sorteia palavras do vocabulario salvo.
    use_my_vocabulary: bool = True


@dataclass(frozen=True, slots=True)
class GeneratedSentences:
    level: ProficiencyLevel
    items: list[GeneratedSentence]
    terms_used: list[str]


# Tamanho padrao da sessao: curto o bastante para caber num intervalo de onibus.
DEFAULT_SESSION_SIZE = 8
MAX_SESSION_SIZE = 20


@dataclass(frozen=True, slots=True)
class StudySessionQuery:
    level: ProficiencyLevel
    limit: int = DEFAULT_SESSION_SIZE
    # Vazio = o tema e sorteado do catalogo.
    theme: str | None = None
    # None preserva a montagem legada, inclusive com VOCAB_MATCHING.
    modes: tuple[ExerciseMode, ...] | None = None
    # True = descarta cards nao revisados de sessoes anteriores/abandonadas antes de montar.
    reset: bool = False


@dataclass(frozen=True, slots=True)
class ResetStudySessionCommand:
    level: ProficiencyLevel


@dataclass(frozen=True, slots=True)
class ReviewStudyCardCommand:
    grade: ReviewGrade


@dataclass(frozen=True, slots=True)
class SaveSessionWordsCommand:
    """Palavras vistas numa sessao que devem ser traduzidas e salvas.

    `translations` traz as traducoes que o frontend ja possui (vindas do
    vocabulario gerado pela IA em cada card). Termos sem traducao aqui caem no
    tradutor externo como fallback.
    """
    words: list[str] = field(default_factory=list)
    translations: dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class SaveSessionWordsResult:
    saved: int          # palavras efetivamente persistidas
    translated: int     # palavras que receberam traducao


@dataclass(frozen=True, slots=True)
class StudyHistoryQuery:
    limit: int = 50
    offset: int = 0


@dataclass(frozen=True, slots=True)
class SeenWordItem:
    term: str
    translation: str


@dataclass(frozen=True, slots=True)
class StudyHistoryPage:
    sentences: list[StudyCard]
    sentences_total: int
    words: list[SeenWordItem]
    words_total: int
    limit: int
    offset: int


# ---------- traducao avancada ----------

@dataclass(frozen=True, slots=True)
class TranslationChunkItem:
    """Um bloco da frase com seu papel gramatical e explicacao."""
    text: str
    role: str
    explanation: str


@dataclass(frozen=True, slots=True)
class TranslationCommand:
    """Comando para traduzir uma frase com analise estrutural."""
    text: str


@dataclass(frozen=True, slots=True)
class TranslationCorrectionItem:
    """Um erro gramatical/ortografico encontrado na entrada em ingles."""
    original: str
    corrected: str
    explanation: str


@dataclass(frozen=True, slots=True)
class TranslationResult:
    """Resultado da traducao avancada com analise de blocos."""
    original: str
    translation: str
    english_phrase: str
    portuguese_phrase: str
    corrections: list[TranslationCorrectionItem]
    chunks: list[TranslationChunkItem]
    assembly_summary: str


# ---------- construcao de frases (phrase crafting) ----------

@dataclass(frozen=True, slots=True)
class PhraseVariationItem:
    """Uma variacao natural de expressar a ideia em ingles."""
    english_phrase: str
    portuguese_translation: str
    context: str
    formality: str
    explanation: str


@dataclass(frozen=True, slots=True)
class SentencePatternItem:
    """Estrutura/formula reutilizavel para montar frases semelhantes."""
    pattern: str
    explanation: str
    examples: list[str]


@dataclass(frozen=True, slots=True)
class PhraseCraftCommand:
    """Comando com o texto ou intencao a ser explorado em ingles."""
    text: str


@dataclass(frozen=True, slots=True)
class PhraseCraftResultDto:
    """Resultado com variacoes, padroes estruturais e orientacoes pragmaticas."""
    original: str
    intent_summary: str
    cultural_tip: str
    variations: list[PhraseVariationItem]
    patterns: list[SentencePatternItem]
