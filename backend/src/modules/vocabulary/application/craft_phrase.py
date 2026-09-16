"""Use case: craft natural English phrases from user intent with patterns and pragmatic tips."""

from __future__ import annotations

import logging

from modules.vocabulary.application.dto import (
    PhraseCraftCommand,
    PhraseCraftResultDto,
    PhraseVariationItem,
    SentencePatternItem,
)
from modules.vocabulary.domain.ports import PhraseCrafter

logger = logging.getLogger(__name__)


class CraftPhrase:
    """Receives an intent or phrase and returns contextual English formulations and patterns."""

    def __init__(self, crafter: PhraseCrafter) -> None:
        self._crafter = crafter

    async def execute(self, command: PhraseCraftCommand) -> PhraseCraftResultDto:
        logger.info("[craft-phrase] requesting phrase crafting | text=%r", command.text[:80])
        raw = await self._crafter.craft(command.text)
        logger.info(
            "[craft-phrase] result received | variations=%d patterns=%d",
            len(raw.variations),
            len(raw.patterns),
        )
        return PhraseCraftResultDto(
            original=raw.original,
            intent_summary=raw.intent_summary,
            cultural_tip=raw.cultural_tip,
            variations=[
                PhraseVariationItem(
                    english_phrase=v.english_phrase,
                    portuguese_translation=v.portuguese_translation,
                    context=v.context,
                    formality=v.formality,
                    explanation=v.explanation,
                )
                for v in raw.variations
            ],
            patterns=[
                SentencePatternItem(
                    pattern=p.pattern,
                    explanation=p.explanation,
                    examples=p.examples,
                )
                for p in raw.patterns
            ],
        )
