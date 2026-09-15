"""Sentence generation adapter with LangChain + Gemini.

All LLM details live here. The use case only knows SentenceGenerator port.
"""

from __future__ import annotations

import logging
import re
import time

from langchain_core.language_models import BaseChatModel
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field

from modules.vocabulary.domain.entities import (
    MAX_VOCABULARY_PER_SENTENCE,
    GeneratedSentence,
    SentenceChunk,
    SentenceRequest,
    SentenceVocabularyItem,
)
from modules.vocabulary.domain.errors import SentenceGenerationFailed
from modules.vocabulary.domain.ports import SentenceGenerator
from shared.errors import ValidationError

logger = logging.getLogger(__name__)

_WHITESPACE_RE = re.compile(r"\s+")


def _collapse_spaces(value: str) -> str:
    return _WHITESPACE_RE.sub(" ", value).strip()


_SYSTEM_PROMPT = """You are an English teacher creating example sentences for a \
Brazilian Portuguese speaker who is learning English.

CEFR level: {level} ({level_label})
Level constraints: {level_guidance}

Rules:
- Produce exactly {count} sentence(s).
- Each sentence must be natural, useful in real life and strictly within the level.
- Provide a faithful Brazilian Portuguese translation for each sentence (field `translation`).
- Never explain, never add numbering, never repeat a sentence.
- {terms_instruction}
- {topic_instruction}
- For each sentence, set `focus_term_translation` to the Brazilian Portuguese translation of
  `focus_term` alone — translate the TERM, not the full sentence.
  Examples: "brush my teeth" -> "escovar os dentes", "wake up" -> "acordar",
  "make my bed" -> "arrumar minha cama", "coffee" -> "cafe".
  If focus_term is a multi-word phrase, translate the whole phrase naturally.

VOCABULARY (field `vocabulary`) - the words and expressions the student should
learn from this sentence. This is what feeds the "Words" history, so extract
EVERY meaningful item, not just one:
- Return 2 to 6 vocabulary items per sentence, IN THE ORDER they appear.
- Each item has `term` (the English word or expression, e.g. a verb phrase, a
  phrasal verb, a noun phrase or a single meaningful word) and `translation`
  (its Brazilian Portuguese translation of the TERM alone, not the full sentence).
- Prefer meaningful content words and useful expressions. Skip bare function
  words like articles, single prepositions or auxiliaries ("the", "a", "to",
  "is") unless they are part of a larger expression.
- Keep multi-word expressions together as ONE item ("brushed her teeth" ->
  "escovou os dentes", "took a quick shower" -> "tomou um banho rapido").
- The `focus_term` should also appear among the vocabulary items.
- Example for "She brushed her teeth after breakfast today.":
  vocabulary = [
    {{"term": "brushed her teeth", "translation": "escovou os dentes"}},
    {{"term": "after breakfast", "translation": "depois do cafe da manha"}},
    {{"term": "today", "translation": "hoje"}}
  ]

STRUCTURAL ANALYSIS (field `chunks`) - this is what teaches the student how the
sentence is built, so it is as important as the sentence itself:
- Split the English sentence into 2 to 6 meaningful blocks, IN ORDER.
- Keep grammatical units together: a verb tense ("I've been"), a phrasal verb
  ("looking forward to"), a noun phrase ("this moment"). Never split a block in
  the middle of a grammatical unit and never reorder the blocks.
- Concatenating every `text` with single spaces must rebuild the sentence exactly,
  including punctuation. Do not add or drop words.
- `role`: the short grammatical or syntactic label, using standard grammar
  terminology in English (examples: "Present Perfect Continuous", "Phrasal verb",
  "Subject", "Direct object", "Time adverbial", "Preposition + noun phrase").
- `explanation`: why it is used, in Brazilian Portuguese, at most 18 words, no
  terminology dump. Explain the effect on meaning (example: "acao que comecou no
  passado e continua acontecendo agora").

Example of the expected shape for "I've been looking forward to this moment":
  chunks = [
    {{"text": "I've been", "role": "Present Perfect Continuous",
      "explanation": "acao que comecou no passado e continua acontecendo"}},
    {{"text": "looking forward to", "role": "Phrasal verb",
      "explanation": "aguardar algo com expectativa, sempre seguido de substantivo"}},
    {{"text": "this moment", "role": "Direct object",
      "explanation": "o que esta sendo aguardado"}}
  ]"""

_HUMAN_PROMPT = "Generate the sentences now."


class _ChunkItem(BaseModel):
    """A block for structural analysis."""

    text: str = Field(description="The block exactly as it appears in the sentence.")
    role: str = Field(description="Short grammatical label in English.")
    explanation: str = Field(description="Why it is used, in Brazilian Portuguese, max 18 words.")


class _VocabularyItem(BaseModel):
    """A vocabulary item extracted from the sentence."""

    term: str = Field(description="An English word or expression from the sentence.")
    translation: str = Field(
        description="Brazilian Portuguese translation of the term alone, not the full sentence."
    )


class _SentenceItem(BaseModel):
    """Structured format required from the model."""

    text: str = Field(description="The sentence in English.")
    translation: str = Field(description="Brazilian Portuguese translation of the full sentence.")
    focus_term: str | None = Field(
        default=None,
        description="The vocabulary term the sentence practices, if any.",
    )
    focus_term_translation: str | None = Field(
        default=None,
        description=(
            "Brazilian Portuguese translation of focus_term alone "
            "(e.g. 'brush my teeth' -> 'escovar os dentes'). "
            "Must translate the term, NOT the full sentence."
        ),
    )
    chunks: list[_ChunkItem] = Field(
        default_factory=list,
        description="The sentence split into 2-6 ordered grammatical blocks.",
    )
    vocabulary: list[_VocabularyItem] = Field(
        default_factory=list,
        description="2-6 vocabulary items (word/expression + translation) from the sentence.",
    )


class _SentenceBatch(BaseModel):
    sentences: list[_SentenceItem]


class GeminiSentenceGenerator(SentenceGenerator):
    """Implements port using LangChain chat model with structured output."""

    def __init__(self, chat_model: BaseChatModel) -> None:
        self._model_name = getattr(chat_model, "model", "unknown")
        self._chain = ChatPromptTemplate.from_messages(
            [("system", _SYSTEM_PROMPT), ("human", _HUMAN_PROMPT)]
        ) | chat_model.with_structured_output(_SentenceBatch)

    async def generate(self, request: SentenceRequest) -> list[GeneratedSentence]:
        logger.info(
            "[gemini] calling API | model=%s level=%s count=%d topic=%r",
            self._model_name,
            request.level.value,
            request.count,
            request.topic,
        )
        t0 = time.monotonic()
        try:
            result = await self._chain.ainvoke(
                {
                    "level": request.level.value,
                    "level_label": request.level.label,
                    "level_guidance": request.level.guidance,
                    "count": request.count,
                    "terms_instruction": self._terms_instruction(request),
                    "topic_instruction": self._topic_instruction(request),
                }
            )
            elapsed = time.monotonic() - t0
            logger.info("[gemini] response received in %.1fs", elapsed)
        except Exception as cause:  # noqa: BLE001
            elapsed = time.monotonic() - t0
            logger.warning(
                "[gemini] failed after %.1fs | %s: %s",
                elapsed, type(cause).__name__, cause,
            )
            raise SentenceGenerationFailed(
                "AI provider did not respond as expected"
            ) from cause

        return self._to_domain(result, request)

    @staticmethod
    def _terms_instruction(request: SentenceRequest) -> str:
        if not request.terms:
            return (
                "Choose useful everyday vocabulary appropriate for the level and set "
                "focus_term to the key word of each sentence."
            )
        terms = ", ".join(f"'{term}'" for term in request.terms)
        return (
            f"Each sentence must use one of these terms: {terms}. "
            "Set focus_term to the term used. Distribute the terms across the sentences."
        )

    @staticmethod
    def _topic_instruction(request: SentenceRequest) -> str:
        if not request.topic:
            return "Vary the situations across the sentences."
        return f"All sentences must relate to this topic: '{request.topic}'."

    @classmethod
    def _to_domain(cls, result: object, request: SentenceRequest) -> list[GeneratedSentence]:
        if not isinstance(result, _SentenceBatch) or not result.sentences:
            raise SentenceGenerationFailed("empty response from AI provider")

        sentences: list[GeneratedSentence] = []
        for item in result.sentences[: request.count]:
            if not item.text.strip() or not item.translation.strip():
                logger.warning("[gemini] ignored sentence: text or translation empty")
                continue
            text = item.text.strip()
            chunks = cls._build_chunks(item.chunks, sentence=text)
            vocabulary = cls._build_vocabulary(item.vocabulary)
            sentences.append(
                GeneratedSentence(
                    text=text,
                    translation=item.translation.strip(),
                    level=request.level,
                    focus_term=(item.focus_term or "").strip() or None,
                    focus_term_translation=(
                        (item.focus_term_translation or "").strip() or None
                    ),
                    chunks=chunks,
                    vocabulary=vocabulary,
                )
            )
            logger.debug(
                "[gemini] accepted sentence | focus=%r chunks=%d vocab=%d text=%r",
                (item.focus_term or "").strip() or None,
                len(chunks),
                len(vocabulary),
                text[:60],
            )

        if not sentences:
            raise SentenceGenerationFailed("no usable sentence was returned")

        logger.info(
            "[gemini] %d/%d sentences approved in _to_domain",
            len(sentences),
            len(result.sentences),
        )
        return sentences

    @staticmethod
    def _build_vocabulary(items: list[_VocabularyItem]) -> list[SentenceVocabularyItem]:
        """Converts AI vocabulary items, deduplicating by term."""
        vocabulary: list[SentenceVocabularyItem] = []
        seen: set[str] = set()
        for item in items:
            key = (item.term or "").strip().casefold()
            if not key or key in seen:
                continue
            try:
                vocabulary.append(
                    SentenceVocabularyItem.create(term=item.term, translation=item.translation)
                )
            except ValidationError as cause:
                logger.info("[gemini] vocabulary item discarded: %s", cause.message)
                continue
            seen.add(key)
            if len(vocabulary) >= MAX_VOCABULARY_PER_SENTENCE:
                break
        return vocabulary

    @staticmethod
    def _build_chunks(items: list[_ChunkItem], *, sentence: str) -> list[SentenceChunk]:
        """Accepts structural analysis only if it reconstructs original sentence."""
        if not items:
            return []

        try:
            chunks = [
                SentenceChunk.create(text=item.text, role=item.role, explanation=item.explanation)
                for item in items
            ]
        except ValidationError as cause:
            logger.info("[gemini] chunks discarded (invalid block): %s", cause.message)
            return []

        rebuilt = _collapse_spaces(" ".join(chunk.text for chunk in chunks))
        if rebuilt != _collapse_spaces(sentence):
            logger.info(
                "[gemini] chunks discarded (mismatched sentence) | expected=%r received=%r",
                _collapse_spaces(sentence),
                rebuilt,
            )
            return []
        return chunks
