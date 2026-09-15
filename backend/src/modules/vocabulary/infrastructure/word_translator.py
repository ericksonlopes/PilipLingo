"""Word translation adapter using deep-translator (Google Translate)."""

from __future__ import annotations

import asyncio
import logging

from deep_translator import GoogleTranslator  # type: ignore[import-untyped]

from modules.vocabulary.domain.ports import WordTranslator

logger = logging.getLogger(__name__)

# Safe batch size to avoid oversized payloads.
_BATCH_SIZE = 20


class DeepWordTranslator(WordTranslator):
    """Translates English terms to Portuguese using Google Translate (free tier)."""

    def __init__(self) -> None:
        self._translator = GoogleTranslator(source="en", target="pt")

    async def translate_many(self, words: list[str]) -> dict[str, str]:
        if not words:
            return {}

        loop = asyncio.get_running_loop()
        results: dict[str, str] = {}

        for i in range(0, len(words), _BATCH_SIZE):
            batch = words[i : i + _BATCH_SIZE]
            try:
                translated = await loop.run_in_executor(
                    None, self._translate_batch, batch
                )
                results.update(translated)
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "[deep-translator] failed translating batch %d-%d: %s",
                    i, i + len(batch), exc,
                )

        logger.info(
            "[deep-translator] %d/%d terms translated",
            len(results), len(words),
        )
        return results

    def _translate_batch(self, words: list[str]) -> dict[str, str]:
        out: dict[str, str] = {}
        for word in words:
            try:
                translation = self._translator.translate(word)
                if translation and translation.strip():
                    out[word] = translation.strip()
            except Exception as exc:  # noqa: BLE001
                logger.debug("[deep-translator] failure on %r: %s", word, exc)
        return out
