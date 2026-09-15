"""Use case: translate a phrase with structural analysis (blocks + assembly summary)."""

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
    """Receives a phrase in any language and returns translation + block analysis."""

    def __init__(self, translator: PhraseTranslator) -> None:
        self._translator = translator

    async def execute(self, command: TranslationCommand) -> TranslationResult:
        logger.info("[translate] requesting translation | text=%r", command.text[:80])
        raw = await self._translator.translate(command.text)
        logger.info("[translate] result received | chunks=%d", len(raw.chunks))
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
