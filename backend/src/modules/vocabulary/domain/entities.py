"""Entidades e value objects de vocabulary. Sem dependencia de framework ou ORM."""

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
# Teto de termos que uma unica geracao de frases pode praticar.
MAX_TERMS_PER_REQUEST = 5

MAX_CHUNK_TEXT_LENGTH = 120
MAX_CHUNK_ROLE_LENGTH = 80
MAX_CHUNK_EXPLANATION_LENGTH = 280
# Uma frase util para estudo nao passa disso; protege contra resposta degenerada da IA.
MAX_CHUNKS_PER_SENTENCE = 12


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
    "GeneratedSentence",
    "ProficiencyLevel",
    "SentenceChunk",
    "SentenceRequest",
    "VocabularyEntry",
]


def _clean(value: str, *, field_name: str, max_length: int) -> str:
    text = (value or "").strip()
    if not text:
        raise ValidationError(f"'{field_name}' nao pode ser vazio.")
    if len(text) > max_length:
        raise ValidationError(f"'{field_name}' excede {max_length} caracteres.")
    return text


def _clean_optional(value: str | None, *, field_name: str, max_length: int) -> str | None:
    if value is None:
        return None
    text = value.strip()
    if not text:
        return None
    if len(text) > max_length:
        raise ValidationError(f"'{field_name}' excede {max_length} caracteres.")
    return text


@dataclass(slots=True)
class VocabularyEntry:
    """Um item de vocabulario: termo em ingles + traducao em portugues."""

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
        """Fabrica que garante as invariantes da entidade."""
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
        """Aplica alteracoes parciais mantendo as invariantes."""
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
        """Chave de unicidade do termo (case-insensitive)."""
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
    """Um bloco logico da frase, com o papel que ele cumpre e o porque.

    E a unidade da "Analise Estrutural": em vez de traduzir palavra por palavra, o
    aluno ve como a frase foi montada. Ex.: text="I've been",
    role="Present Perfect Continuous", explanation="acao que comecou no passado e
    continua acontecendo".
    """

    text: str
    role: str
    explanation: str

    @classmethod
    def create(cls, *, text: str, role: str, explanation: str) -> SentenceChunk:
        """Fabrica que normaliza e valida os limites de cada campo."""
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
        raise ValidationError(f"Uma frase nao pode ter mais de {MAX_CHUNKS_PER_SENTENCE} blocos.")


@dataclass(frozen=True, slots=True)
class GeneratedSentence:
    """Uma frase de exemplo em ingles com traducao e analise estrutural."""

    text: str
    translation: str
    level: ProficiencyLevel
    focus_term: str | None = None
    # Traducao do termo-alvo em portugues (ex.: "brush my teeth" -> "escovar os dentes").
    # Distinto de `translation`, que e a frase inteira.
    focus_term_translation: str | None = None
    # Vazio quando a IA nao devolveu analise utilizavel: a frase ainda serve para
    # estudar, so nao tem o "Entender Estrutura".
    chunks: list[SentenceChunk] = field(default_factory=list)

    def __post_init__(self) -> None:
        if not self.text.strip():
            raise ValidationError("A frase gerada nao pode ser vazia.")
        if not self.translation.strip():
            raise ValidationError("A traducao da frase gerada nao pode ser vazia.")
        _validate_chunks(self.chunks)


@dataclass(frozen=True, slots=True)
class SentenceRequest:
    """Pedido de geracao de frases, ja validado pelas regras do dominio."""

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
        """Fabrica que garante as invariantes do pedido."""
        if count < 1:
            raise ValidationError("Peca ao menos uma frase.")
        if count > max_count:
            raise ValidationError(f"Maximo de {max_count} frases por requisicao.")

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

        # Deduplica case-insensitive preservando a grafia original do usuario.
        unique: dict[str, str] = {}
        for term in terms:
            cleaned = term.strip()
            if not cleaned:
                continue
            if len(cleaned) > MAX_TERM_LENGTH:
                raise ValidationError(f"O termo '{cleaned[:20]}...' e longo demais.")
            unique.setdefault(cleaned.casefold(), cleaned)

        if len(unique) > MAX_TERMS_PER_REQUEST:
            raise ValidationError(f"Envie no maximo {MAX_TERMS_PER_REQUEST} termos.")
        return list(unique.values())
