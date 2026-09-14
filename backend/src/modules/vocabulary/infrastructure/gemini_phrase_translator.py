"""Adaptador de traducao avancada de frases usando LangChain + Gemini.

Suporta traducao nos dois sentidos:
- Ingles → Portugues brasileiro
- Portugues → Ingles

A analise estrutural de blocos e o assembly_summary sao SEMPRE sobre a frase
em INGLES — independente da direcao — porque o objetivo e ensinar ingles.

O dominio so conhece a porta PhraseTranslator; este modulo permanece isolado
na camada de infraestrutura.
"""

from __future__ import annotations

import logging
import re
import time

from langchain_core.language_models import BaseChatModel
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field

from modules.vocabulary.domain.errors import SentenceGenerationFailed
from modules.vocabulary.domain.ports import (
    PhraseTranslationResult,
    PhraseTranslator,
    TranslationChunk,
    TranslationCorrection,
)

logger = logging.getLogger(__name__)

_WHITESPACE_RE = re.compile(r"\s+")


def _collapse(value: str) -> str:
    return _WHITESPACE_RE.sub(" ", value).strip()


# ---------------------------------------------------------------------------
# Prompt
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """\
You are an expert English teacher and translator for Brazilian Portuguese learners.

The user may give you a phrase in ENGLISH or in BRAZILIAN PORTUGUESE.
Your job is always to produce:
  - The phrase in English (field `english_phrase`) — always grammatically correct
  - The phrase in Brazilian Portuguese (field `portuguese_phrase`)
  - A grammatical block analysis of the ENGLISH phrase (field `chunks`)
  - A summary in Brazilian Portuguese of how the English phrase is structured \
(field `assembly_summary`)
  - A list of grammar/spelling corrections if the INPUT was in English and contained \
errors (field `corrections`)

Rules:
1. Detect the input language automatically.
2. If the input is English, set `english_phrase` = the CORRECTED version of the input \
(fix grammar, spelling and word-order errors, keep the meaning intact) and translate to \
Brazilian Portuguese for `portuguese_phrase`.
3. If the input is Portuguese, set `portuguese_phrase` = input and translate to \
natural English for `english_phrase`. In this case `corrections` MUST be an empty list.
4. Field `corrections`: only populated when the input was English AND had errors.
   - Each item represents ONE error in the original English input.
   - `original`: the exact erroneous fragment as written by the user.
   - `corrected`: the correct form of that fragment.
   - `explanation`: why it is wrong, in Brazilian Portuguese, at most 20 words.
   - If the English input was already correct, `corrections` MUST be an empty list.
5. Split the ENGLISH phrase into 2–8 ordered grammatical blocks (field `chunks`).
   - Keep grammatical units together: verb tenses, phrasal verbs, noun phrases, \
prepositional phrases, etc.
   - The blocks MUST reconstruct `english_phrase` exactly when concatenated with \
single spaces (same words, same punctuation, same order).
   - For each block set:
     - `text`: the block exactly as it appears in `english_phrase`.
     - `role`: short grammatical/syntactic label in English \
(e.g. "Subject", "Present Perfect", "Phrasal verb", "Adverbial clause").
     - `explanation`: why this block is used, in Brazilian Portuguese, at most \
20 words, focusing on meaning and function.
6. Write `assembly_summary` in Brazilian Portuguese: 1–3 sentences explaining \
how the blocks combine to form the meaning of the English phrase. \
Mention key grammatical structures by name and what they contribute.

Be precise. Never add words not in the corrected English phrase. Never reorder blocks.\
"""

_HUMAN_PROMPT = 'Phrase to translate and analyse: """{text}"""'


# ---------------------------------------------------------------------------
# Pydantic schemas para saida estruturada
# ---------------------------------------------------------------------------

class _CorrectionOut(BaseModel):
    original: str = Field(description="The exact erroneous fragment as written by the user.")
    corrected: str = Field(description="The correct form of that fragment.")
    explanation: str = Field(
        description="Why it is wrong, in Brazilian Portuguese, max 20 words."
    )


class _ChunkOut(BaseModel):
    text: str = Field(description="Block text exactly as in english_phrase.")
    role: str = Field(description="Short grammatical label in English.")
    explanation: str = Field(
        description="Why this block is used, in Brazilian Portuguese, max 20 words."
    )


class _TranslationOut(BaseModel):
    english_phrase: str = Field(description="The phrase in English, always grammatically correct.")
    portuguese_phrase: str = Field(description="The phrase in Brazilian Portuguese.")
    corrections: list[_CorrectionOut] = Field(
        default_factory=list,
        description=(
            "Grammar/spelling corrections for the original English input. "
            "Empty list if the input was Portuguese or if the English input was already correct."
        ),
    )
    chunks: list[_ChunkOut] = Field(
        description="The english_phrase split into 2-8 ordered grammatical blocks.",
    )
    assembly_summary: str = Field(
        description=(
            "1-3 sentences in Brazilian Portuguese explaining how the blocks of "
            "the English phrase combine to form the overall meaning."
        )
    )


# ---------------------------------------------------------------------------
# Adaptador
# ---------------------------------------------------------------------------

class GeminiPhraseTranslator(PhraseTranslator):
    """Implementa PhraseTranslator usando o Gemini via LangChain structured output.

    A analise de blocos e o assembly_summary sao sempre sobre a frase em ingles,
    independente de a entrada ter sido em PT ou EN.
    """

    def __init__(self, chat_model: BaseChatModel) -> None:
        self._model_name = getattr(chat_model, "model", "unknown")
        self._chain = ChatPromptTemplate.from_messages(
            [("system", _SYSTEM_PROMPT), ("human", _HUMAN_PROMPT)]
        ) | chat_model.with_structured_output(_TranslationOut)

    async def translate(self, text: str) -> PhraseTranslationResult:
        logger.info(
            "[gemini-translate] chamando API | model=%s text=%r",
            self._model_name,
            text[:80],
        )
        t0 = time.monotonic()
        try:
            result = await self._chain.ainvoke({"text": text})
            elapsed = time.monotonic() - t0
            logger.info("[gemini-translate] resposta em %.1fs", elapsed)
        except Exception as cause:  # noqa: BLE001
            elapsed = time.monotonic() - t0
            logger.warning(
                "[gemini-translate] falha apos %.1fs | %s: %s",
                elapsed,
                type(cause).__name__,
                cause,
            )
            raise SentenceGenerationFailed(
                "o provedor de IA nao respondeu como esperado"
            ) from cause

        return self._to_domain(text, result)

    @staticmethod
    def _to_domain(original_input: str, result: object) -> PhraseTranslationResult:
        if not isinstance(result, _TranslationOut):
            raise SentenceGenerationFailed("resposta vazia ou malformada do provedor de IA")
        if not result.english_phrase.strip():
            raise SentenceGenerationFailed("frase em ingles vazia retornada pelo provedor de IA")
        if not result.portuguese_phrase.strip():
            raise SentenceGenerationFailed("frase em portugues vazia retornada pelo provedor de IA")

        english = result.english_phrase.strip()
        portuguese = result.portuguese_phrase.strip()

        chunks = GeminiPhraseTranslator._build_chunks(result.chunks, sentence=english)

        corrections = [
            TranslationCorrection(
                original=c.original.strip(),
                corrected=c.corrected.strip(),
                explanation=c.explanation.strip(),
            )
            for c in (result.corrections or [])
            if c.original.strip() and c.corrected.strip()
        ]

        return PhraseTranslationResult(
            original=original_input.strip(),
            translation=portuguese if original_input.strip() != portuguese else english,
            english_phrase=english,
            portuguese_phrase=portuguese,
            corrections=corrections,
            chunks=chunks,
            assembly_summary=result.assembly_summary.strip(),
        )

    @staticmethod
    def _build_chunks(items: list[_ChunkOut], *, sentence: str) -> list[TranslationChunk]:
        """Aceita os blocos somente se reconstruirem a frase em ingles.

        Se o modelo inventar ou reordenar palavras, descarta a analise e devolve
        uma lista vazia — a traducao principal ainda fica disponivel ao usuario.
        """
        if not items:
            return []

        chunks = [
            TranslationChunk(
                text=c.text.strip(),
                role=c.role.strip(),
                explanation=c.explanation.strip(),
            )
            for c in items
            if c.text.strip()
        ]

        rebuilt = _collapse(" ".join(c.text for c in chunks))
        expected = _collapse(sentence)
        if rebuilt != expected:
            logger.info(
                "[gemini-translate] chunks descartados (nao reconstroem a frase) "
                "| esperado=%r recebido=%r",
                expected,
                rebuilt,
            )
            return []

        return chunks
