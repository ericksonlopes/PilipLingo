"""Construction of Gemini chat model from Settings."""

from __future__ import annotations

from functools import lru_cache

from langchain_core.language_models import BaseChatModel
from langchain_google_genai import ChatGoogleGenerativeAI

from modules.vocabulary.domain.errors import SentenceGeneratorNotConfigured
from shared.config import Settings


@lru_cache(maxsize=4)
def _build(
    model: str, api_key: str, temperature: float, timeout: float, retries: int
) -> BaseChatModel:
    """Cached by configuration: client reuses connections across requests."""
    return ChatGoogleGenerativeAI(
        model=model,
        google_api_key=api_key,
        temperature=temperature,
        timeout=timeout,
        max_retries=retries,
    )


def create_chat_model(settings: Settings) -> BaseChatModel:
    """Fails explicitly (503) when API key is not configured."""
    if not settings.is_ai_configured:
        raise SentenceGeneratorNotConfigured
    assert settings.google_api_key is not None

    return _build(
        settings.gemini_model,
        settings.google_api_key.get_secret_value(),
        settings.gemini_temperature,
        settings.gemini_timeout_seconds,
        settings.gemini_max_retries,
    )
