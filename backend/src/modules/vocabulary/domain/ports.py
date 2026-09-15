"""Portas (interfaces) do dominio vocabulary.

O dominio declara o que precisa; a camada de infraestrutura fornece os
adaptadores. Nenhuma implementacao concreta e referenciada aqui.
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

# ---------- value objects usados pelas portas ----------

@dataclass(frozen=True, slots=True)
class TranslationChunk:
    """Um bloco gramatical retornado pelo adaptador de traducao."""
    text: str
    role: str
    explanation: str


@dataclass(frozen=True, slots=True)
class TranslationCorrection:
    """Um erro gramatical/ortografico encontrado na entrada em ingles."""
    original: str     # fragmento errado exatamente como o usuario escreveu
    corrected: str    # forma correta
    explanation: str  # explicacao em portugues de por que esta errado


@dataclass(frozen=True, slots=True)
class PhraseTranslationResult:
    """Resultado bruto devolvido pelo adaptador PhraseTranslator."""
    original: str
    translation: str
    english_phrase: str
    portuguese_phrase: str
    corrections: list[TranslationCorrection]
    chunks: list[TranslationChunk]
    assembly_summary: str


class VocabularyRepository(ABC):
    """Porta de persistencia de itens de vocabulario."""

    @abstractmethod
    async def add(self, entry: VocabularyEntry) -> VocabularyEntry:
        """Persiste um novo item."""

    @abstractmethod
    async def update(self, entry: VocabularyEntry) -> VocabularyEntry:
        """Persiste alteracoes de um item existente."""

    @abstractmethod
    async def get_by_id(self, entry_id: UUID) -> VocabularyEntry | None:
        """Busca por identificador."""

    @abstractmethod
    async def find_by_term(self, term: str) -> VocabularyEntry | None:
        """Busca pelo termo (case-insensitive)."""

    @abstractmethod
    async def list_all(
        self,
        *,
        search: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[VocabularyEntry]:
        """Lista itens com filtro opcional e paginacao."""

    @abstractmethod
    async def count(self, *, search: str | None = None) -> int:
        """Total de itens que atendem ao filtro."""

    @abstractmethod
    async def delete(self, entry_id: UUID) -> bool:
        """Remove um item. Retorna False se nao existia."""


class SentenceGenerator(ABC):
    """Porta de geracao de frases de exemplo (implementada por um adaptador de IA).

    O dominio nao sabe que por tras existe um LLM: so conhece este contrato.
    """

    @abstractmethod
    async def generate(self, request: SentenceRequest) -> list[GeneratedSentence]:
        """Produz frases coerentes com o nivel pedido."""


class WordTranslator(ABC):
    """Porta de traducao de palavras/termos individuais EN→PT-BR."""

    @abstractmethod
    async def translate_many(self, words: list[str]) -> dict[str, str]:
        """Traduz uma lista de termos e devolve {termo: traducao}.

        Termos que falharem na traducao sao omitidos do resultado.
        """


class PhraseTranslator(ABC):
    """Porta de traducao avancada de frases com analise estrutural (blocos + resumo)."""

    @abstractmethod
    async def translate(self, text: str) -> PhraseTranslationResult:
        """Traduz a frase e devolve blocos gramaticais com explicacoes."""


class StudyCardRepository(ABC):
    """Porta de persistencia dos cards de estudo e do estado do agendamento."""

    @abstractmethod
    async def add_many(self, cards: list[StudyCard]) -> list[StudyCard]:
        """Persiste os cards recem-gerados."""

    @abstractmethod
    async def get_by_id(self, card_id: UUID) -> StudyCard | None:
        """Busca por identificador."""

    @abstractmethod
    async def update(self, card: StudyCard) -> StudyCard:
        """Persiste o novo estado de agendamento apos a revisao."""

    @abstractmethod
    async def delete_unreviewed(self, *, level: ProficiencyLevel) -> int:
        """Remove cards gerados que nunca foram revisados (sessoes abandonadas)."""

    @abstractmethod
    async def list_due(
        self,
        *,
        level: ProficiencyLevel,
        now: datetime,
        limit: int,
        theme: str | None = None,
    ) -> list[StudyCard]:
        """Cards vencidos do nivel, dos mais atrasados para os menos."""

    @abstractmethod
    async def list_by_level(
        self,
        *,
        level: ProficiencyLevel,
        limit: int,
        exclude: set[UUID] | None = None,
        theme: str | None = None,
    ) -> list[StudyCard]:
        """Cards do nivel independente de vencimento (completa grupo e evita repeticao)."""

    @abstractmethod
    async def count_due(
        self,
        *,
        level: ProficiencyLevel,
        now: datetime,
        theme: str | None = None,
    ) -> int:
        """Quantos cards do nivel estao vencidos."""

    @abstractmethod
    async def existing_sentences(self, *, level: ProficiencyLevel) -> set[str]:
        """Frases ja cadastradas (normalizadas), para nao gerar duplicata."""

    @abstractmethod
    async def list_reviewed(
        self,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> list[StudyCard]:
        """Cards que o usuario ja viu (reviewed_at IS NOT NULL), mais recentes primeiro."""

    @abstractmethod
    async def count_reviewed(self) -> int:
        """Total de cards ja revisados pelo usuario."""

    @abstractmethod
    async def list_seen_words(
        self,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> list[tuple[str, str]]:
        """Palavras vistas (word, translation), mais recentes primeiro.

        Le do registro de palavras vistas, que guarda todo o vocabulario de cada
        sessao (varias palavras por frase), nao apenas o termo-alvo do card.
        """

    @abstractmethod
    async def count_seen_words(self) -> int:
        """Total de palavras ja vistas pelo usuario."""
