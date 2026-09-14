"""Conversao entre modelo ORM e entidade de dominio."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from modules.vocabulary.domain.entities import (
    ProficiencyLevel,
    SentenceChunk,
    VocabularyEntry,
)
from modules.vocabulary.domain.study import StudyCard
from modules.vocabulary.infrastructure.models import StudyCardModel, VocabularyEntryModel


def _as_utc(value: datetime) -> datetime:
    """SQLite nao guarda timezone: reanexa UTC quando vem naive."""
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def to_domain(model: VocabularyEntryModel) -> VocabularyEntry:
    return VocabularyEntry(
        id=model.id,
        term=model.term,
        translation=model.translation,
        example=model.example,
        level=ProficiencyLevel(model.level),
        created_at=_as_utc(model.created_at),
        updated_at=_as_utc(model.updated_at),
        tags=list(model.tags or []),
    )


def to_model(entry: VocabularyEntry, *, user_id: UUID) -> VocabularyEntryModel:
    return VocabularyEntryModel(
        id=entry.id,
        user_id=user_id,
        term=entry.term,
        term_normalized=entry.normalized_term,
        translation=entry.translation,
        example=entry.example,
        level=entry.level.value,
        tags=list(entry.tags),
        created_at=entry.created_at,
        updated_at=entry.updated_at,
    )


def apply_to_model(model: VocabularyEntryModel, entry: VocabularyEntry) -> VocabularyEntryModel:
    model.term = entry.term
    model.term_normalized = entry.normalized_term
    model.translation = entry.translation
    model.example = entry.example
    model.level = entry.level.value
    model.tags = list(entry.tags)
    model.updated_at = entry.updated_at
    return model


def chunks_to_json(chunks: list[SentenceChunk]) -> list[dict[str, Any]]:
    return [
        {"text": chunk.text, "role": chunk.role, "explanation": chunk.explanation}
        for chunk in chunks
    ]


def chunks_to_domain(raw: object) -> list[SentenceChunk]:
    """Le a coluna JSON tolerando linha antiga ou payload malformado.

    A analise estrutural e conteudo gerado por IA: se um registro estiver
    incompleto, o card continua estudavel sem o "Entender Estrutura", em vez de
    derrubar a sessao inteira.
    """
    if not isinstance(raw, list):
        return []

    chunks: list[SentenceChunk] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        text = str(item.get("text") or "").strip()
        role = str(item.get("role") or "").strip()
        explanation = str(item.get("explanation") or "").strip()
        if not text or not role or not explanation:
            continue
        chunks.append(SentenceChunk(text=text, role=role, explanation=explanation))
    return chunks


def study_card_to_domain(model: StudyCardModel) -> StudyCard:
    return StudyCard(
        id=model.id,
        sentence=model.sentence,
        translation=model.translation,
        focus_term=model.focus_term,
        focus_term_translation=model.focus_term_translation,
        level=ProficiencyLevel(model.level),
        theme=model.theme,
        chunks=chunks_to_domain(model.sentence_chunks),
        repetitions=model.repetitions,
        lapses=model.lapses,
        ease_factor=model.ease_factor,
        interval_days=model.interval_days,
        due_at=_as_utc(model.due_at),
        created_at=_as_utc(model.created_at),
        updated_at=_as_utc(model.updated_at),
        reviewed_at=_as_utc(model.reviewed_at) if model.reviewed_at is not None else None,
    )


def study_card_to_model(card: StudyCard, *, user_id: UUID) -> StudyCardModel:
    return StudyCardModel(
        id=card.id,
        user_id=user_id,
        sentence=card.sentence,
        sentence_normalized=card.sentence.casefold(),
        translation=card.translation,
        focus_term=card.focus_term,
        focus_term_translation=card.focus_term_translation,
        level=card.level.value,
        theme=card.theme,
        sentence_chunks=chunks_to_json(card.chunks),
        repetitions=card.repetitions,
        lapses=card.lapses,
        ease_factor=card.ease_factor,
        interval_days=card.interval_days,
        due_at=card.due_at,
        reviewed_at=card.reviewed_at,
        created_at=card.created_at,
        updated_at=card.updated_at,
    )


def apply_to_study_card_model(model: StudyCardModel, card: StudyCard) -> StudyCardModel:
    """Só o estado de agendamento muda depois da criacao; o conteudo e imutavel."""
    model.repetitions = card.repetitions
    model.lapses = card.lapses
    model.ease_factor = card.ease_factor
    model.interval_days = card.interval_days
    model.due_at = card.due_at
    model.reviewed_at = card.reviewed_at
    model.updated_at = card.updated_at
    return model
