"""Caso de uso: traduzir uma frase com analise estrutural (blocos + resumo de montagem)."""

from __future__ import annotations

import logging

from modules.vocabulary.application.dto import (
    TranslationChunkItem,
    TranslationCommand,
    TranslationCorrectionItem,
    TranslationResult,
)
from modules.vocabulary.domain.ports import PhraseTranslator

logger = logging.getLogger(__name__)


class TranslatePhrase:
    """Recebe uma frase em qualquer idioma e devolve traducao + analise de blocos."""

    def __init__(self, translator: PhraseTranslator) -> None:
        self._translator = translator

    async def execute(self, command: TranslationCommand) -> TranslationResult:
        logger.info("[translate] solicitando traducao | text=%r", command.text[:80])
        raw = await self._translator.translate(command.text)
        logger.info("[translate] resultado recebido | chunks=%d", len(raw.chunks))
        return TranslationResult(
            original=raw.original,
            translation=raw.translation,
            english_phrase=raw.english_phrase,
            portuguese_phrase=raw.portuguese_phrase,
            corrections=[
                TranslationCorrectionItem(
                    original=c.original,
                    corrected=c.corrected,
                    explanation=c.explanation,
                )
                for c in raw.corrections
            ],
            chunks=[
                TranslationChunkItem(text=c.text, role=c.role, explanation=c.explanation)
                for c in raw.chunks
            ],
            assembly_summary=raw.assembly_summary,
        )
