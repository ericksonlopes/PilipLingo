"""Phrase crafting adapter using LangChain + Gemini.

Analyzes user intent (typically in Brazilian Portuguese, e.g. "eu quero pizza") and
produces contextual English formulations, reusable sentence patterns, and cultural tips.
"""

from __future__ import annotations

import logging
import time

from langchain_core.language_models import BaseChatModel
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field

from modules.vocabulary.domain.errors import SentenceGenerationFailed
from modules.vocabulary.domain.ports import (
    PhraseCrafter,
    PhraseCraftResult,
    PhraseVariation,
    SentencePattern,
)

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """\
You are an expert English coach and linguist helping Brazilian Portuguese learners build \
natural, authentic English sentences.

When a learner shares an intention or phrase (for example: "eu quero pizza", "pedir a conta"):
Your job is NOT just to produce a literal translation. You must teach them HOW native \
English speakers actually formulate and construct this thought across different real-world \
contexts, registers, and social dynamics.

Your response must contain:
1. `intent_summary`: Short summary of the user's communicative goal in Brazilian Portuguese \
(e.g. "Pedir ou expressar desejo por pizza").
2. `cultural_tip`: Pragmatic and cultural advice in Brazilian Portuguese (1-3 sentences). \
Explain social nuances, politeness etiquette, and common pitfalls for Brazilians (such as \
how translating "eu quero" literally as "I want" can sound demanding, blunt, or childlike \
in restaurants or stores, and how native speakers soften requests).
3. `variations`: 3 to 5 distinct, natural English ways to formulate this thought:
   - Include options across different contexts (e.g. Polite/Ordering in a restaurant, \
Expressing craving/spontaneous desire, Casual conversation with friends, Direct/simple).
   - For each variation provide:
     - `english_phrase`: Natural, grammatically perfect English.
     - `portuguese_translation`: Natural Brazilian Portuguese translation.
     - `context`: Short context label in Portuguese (e.g. "No restaurante / Pedido educado", \
"Vontade espontânea", "Casual / Com amigos", "Direto / Simples").
     - `formality`: Formality label in Portuguese (e.g. "Educado", "Natural / Dia a dia", \
"Informal", "Direto").
     - `explanation`: Brief explanation in Portuguese (max 25 words) explaining why and \
when to choose this formulation.
4. `patterns`: 1 to 3 reusable structural formulas that the learner can use as building blocks:
   - `pattern`: The formula with clear bracketed placeholders, e.g. "I'd like [item], please" \
or "I'm in the mood for [noun / verb-ing]".
   - `explanation`: Short explanation in Portuguese (max 20 words) of how this pattern functions.
   - `examples`: 2 to 3 practical example sentences in English demonstrating the formula.

Always ensure the English sentences are authentic, idiomatic, and high quality.\
"""

_HUMAN_PROMPT = 'Help me craft this phrase in English: """{text}"""'


class _VariationOut(BaseModel):
    english_phrase: str = Field(description="Natural English sentence.")
    portuguese_translation: str = Field(description="Brazilian Portuguese translation.")
    context: str = Field(description="Context of use in Portuguese, e.g. 'No restaurante'.")
    formality: str = Field(
        description="Formality tag in Portuguese, e.g. 'Educado', 'Natural', 'Informal'."
    )
    explanation: str = Field(
        description="Why and when to use this formulation, in Portuguese, max 25 words."
    )


class _PatternOut(BaseModel):
    pattern: str = Field(
        description="Formula with bracketed placeholders, e.g. 'I\\'d like [item], please'."
    )
    explanation: str = Field(
        description="Explanation in Portuguese of how the pattern works, max 20 words."
    )
    examples: list[str] = Field(description="2 to 3 example sentences in English using pattern.")


class _PhraseCraftOut(BaseModel):
    intent_summary: str = Field(
        description="Summary of the user's intent in Brazilian Portuguese."
    )
    cultural_tip: str = Field(
        description="Pragmatic/cultural tip in Portuguese (1-3 sentences) on etiquette."
    )
    variations: list[_VariationOut] = Field(
        description="3 to 5 distinct English ways to express the idea."
    )
    patterns: list[_PatternOut] = Field(
        description="1 to 3 reusable structural patterns with placeholders."
    )


class GeminiPhraseCrafter(PhraseCrafter):
    """Implements PhraseCrafter using Gemini via LangChain structured output."""

    def __init__(self, chat_model: BaseChatModel) -> None:
        self._model_name = getattr(chat_model, "model", "unknown")
        self._chain = ChatPromptTemplate.from_messages(
            [("system", _SYSTEM_PROMPT), ("human", _HUMAN_PROMPT)]
        ) | chat_model.with_structured_output(_PhraseCraftOut)

    async def craft(self, text: str) -> PhraseCraftResult:
        logger.info(
            "[gemini-craft] calling API | model=%s text=%r",
            self._model_name,
            text[:80],
        )
        t0 = time.monotonic()
        try:
            result = await self._chain.ainvoke({"text": text})
            elapsed = time.monotonic() - t0
            logger.info("[gemini-craft] response in %.1fs", elapsed)
        except Exception as cause:  # noqa: BLE001
            elapsed = time.monotonic() - t0
            logger.warning(
                "[gemini-craft] failed after %.1fs | %s: %s",
                elapsed,
                type(cause).__name__,
                cause,
            )
            raise SentenceGenerationFailed(
                "AI provider did not respond as expected"
            ) from cause

        return self._to_domain(text, result)

    @staticmethod
    def _to_domain(original_input: str, result: object) -> PhraseCraftResult:
        if not isinstance(result, _PhraseCraftOut):
            raise SentenceGenerationFailed("empty or malformed response from AI provider")
        if not result.variations:
            raise SentenceGenerationFailed("no phrase variations returned by AI provider")

        variations = [
            PhraseVariation(
                english_phrase=v.english_phrase.strip(),
                portuguese_translation=v.portuguese_translation.strip(),
                context=v.context.strip(),
                formality=v.formality.strip(),
                explanation=v.explanation.strip(),
            )
            for v in result.variations
            if v.english_phrase.strip()
        ]

        patterns = [
            SentencePattern(
                pattern=p.pattern.strip(),
                explanation=p.explanation.strip(),
                examples=[ex.strip() for ex in p.examples if ex.strip()],
            )
            for p in (result.patterns or [])
            if p.pattern.strip()
        ]

        return PhraseCraftResult(
            original=original_input.strip(),
            intent_summary=result.intent_summary.strip() or "Expressar a ideia em inglês",
            cultural_tip=result.cultural_tip.strip(),
            variations=variations,
            patterns=patterns,
        )
